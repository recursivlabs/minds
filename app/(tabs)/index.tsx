import * as React from 'react';
import { View, FlatList, Pressable, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, FeedTabs, PostCard, Text, Container, FeedSidebar, Button, Avatar } from '../../components';
import { FeedSkeletons } from '../../components/PostSkeleton';
import { OnboardingFlow, useOnboarding } from '../../components/Onboarding';
import { useToast } from '../../components/Toast';
import { ORG_ID } from '../../lib/recursiv';
import { useAuth } from '../../lib/auth';
import { usePosts, useProfiles, useCommunities, useAgents } from '../../lib/hooks';
import { colors, spacing, radius } from '../../constants/theme';

type FeedTab = 'foryou' | 'latest' | 'following' | 'trending';

const HIDDEN_AGENT_IDS = ['411ac3a9-dfbc-4463-8963-2e26a645211e'];

function FollowButton({ onFollow }: { onFollow: () => void }) {
  const [followed, setFollowed] = React.useState(false);
  return (
    <Pressable
      onPress={() => { if (!followed) { setFollowed(true); onFollow(); } }}
      style={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xs + 2,
        borderRadius: radius.full,
        backgroundColor: followed ? colors.surface : colors.accentMuted,
        borderWidth: followed ? 0.5 : 0,
        borderColor: colors.glassBorder,
      }}
    >
      <Text variant="caption" color={followed ? colors.textSecondary : colors.accent} style={{ fontFamily: 'Geist-Regular' }}>
        {followed ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const { sdk, user } = useAuth();
  const { showOnboarding, completeOnboarding } = useOnboarding();
  const [activeTab, setActiveTab] = React.useState<FeedTab>('foryou');

  // Posts for all tabs — trending sorts by score (same data, different presentation)
  const sortMap = { foryou: 'score', latest: 'latest', following: 'following', trending: 'score' } as const;
  const { posts, setPosts, loading: postsLoading, refreshing, refresh, loadMore, hasMore } = usePosts(sortMap[activeTab] as any);

  // Extra data for For You tab — always use same limit to avoid hook churn
  const isForYou = activeTab === 'foryou';
  const { profiles } = useProfiles(10);
  const { communities } = useCommunities(10);
  const { agents } = useAgents(10);
  const visibleAgents = React.useMemo(
    () => (agents || []).filter((a: any) => !HIDDEN_AGENT_IDS.includes(a.id)),
    [agents]
  );

  const toast = useToast();

  const handleFollow = async (userId: string) => {
    if (!sdk) return;
    try {
      await sdk.profiles.follow(userId);
      toast.show('Followed');
    } catch {
      toast.show('Failed to follow', 'error');
    }
  };

  // Build unified "For You" feed: posts interleaved with suggestions
  const forYouItems = React.useMemo(() => {
    if (activeTab !== 'foryou') return [];
    const items: { type: string; data: any; id: string }[] = [];
    const allPosts = posts || [];
    const people = profiles || [];
    const comms = communities || [];
    const agts = visibleAgents;

    let pi = 0, ui = 0, ci = 0, ai = 0;
    let suggestionRound = 0;

    // Safety: max 200 items to prevent infinite loops
    while (items.length < 200 && (pi < allPosts.length || ui < people.length || ci < comms.length || ai < agts.length)) {
      // Add up to 3 posts
      let addedPosts = false;
      for (let i = 0; i < 3 && pi < allPosts.length; i++) {
        items.push({ type: 'post', data: allPosts[pi], id: `post-${allPosts[pi].id}` });
        pi++;
        addedPosts = true;
      }

      // Add one suggestion, rotating type
      const round = suggestionRound % 3;
      let addedSuggestion = false;
      if (round === 0 && ui < people.length) {
        const batch = people.slice(ui, ui + 3);
        if (batch.length) { items.push({ type: 'people', data: batch, id: `people-${ui}` }); ui += batch.length; addedSuggestion = true; }
      } else if (round === 1 && ci < comms.length) {
        items.push({ type: 'community', data: comms[ci], id: `comm-${comms[ci].id}` }); ci++; addedSuggestion = true;
      } else if (round === 2 && ai < agts.length) {
        items.push({ type: 'agent', data: agts[ai], id: `agent-${agts[ai].id}` }); ai++; addedSuggestion = true;
      }
      suggestionRound++;

      // If we couldn't add posts or suggestions, we're done
      if (!addedPosts && !addedSuggestion) break;
    }
    return items;
  }, [activeTab, posts, profiles, communities, visibleAgents]);

  const renderForYouItem = React.useCallback(({ item }: { item: { type: string; data: any; id: string } }) => {
    if (item.type === 'post') {
      return (
        <PostCard
          post={item.data}
          compact
          onVoteChange={(postId, newScore, newVote) => {
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, score: newScore, userReaction: newVote } : p));
          }}
        />
      );
    }
    if (item.type === 'people') {
      return (
        <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Ionicons name="sparkles" size={13} color={colors.accent} />
            <Text variant="caption" color={colors.accent} style={{ fontSize: 12 }}>Suggested for you</Text>
          </View>
          {(item.data as any[]).map((person: any, idx: number) => (
            <Pressable
              key={person.id}
              onPress={() => router.push(`/(tabs)/user/${person.username || person.id}` as any)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                paddingVertical: spacing.sm + 2,
                backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                borderTopWidth: idx > 0 ? 0.5 : 0, borderTopColor: 'rgba(255,255,255,0.04)',
              })}
            >
              <Avatar uri={person.image || person.avatar} name={person.name} size="md" />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" numberOfLines={1}>{person.name || 'Unknown'}</Text>
                {person.username && <Text variant="caption" color={colors.textMuted}>@{person.username}</Text>}
                {(person.bio || person.description) ? (
                  <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ marginTop: 2, lineHeight: 17 }}>{person.bio || person.description}</Text>
                ) : null}
              </View>
              <FollowButton onFollow={() => handleFollow(person.id)} />
            </Pressable>
          ))}
        </View>
      );
    }
    if (item.type === 'community') {
      const c = item.data;
      const memberCount = c.memberCount || c.member_count || 0;
      return (
        <Pressable
          onPress={() => router.push(`/(tabs)/community/${c.slug || c.id}` as any)}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
            backgroundColor: pressed ? colors.surfaceHover : 'transparent',
            borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Ionicons name="people" size={13} color={colors.accent} />
            <Text variant="caption" color={colors.accent} style={{ fontSize: 12 }}>Community</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
            <Avatar uri={c.image || c.avatar} name={c.name} size="md" />
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">{c.name}</Text>
              <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>{memberCount} member{memberCount !== 1 ? 's' : ''}</Text>
              {(c.description || c.bio) ? (
                <Text variant="body" color={colors.textSecondary} numberOfLines={3} style={{ marginTop: spacing.xs, lineHeight: 20 }}>{c.description || c.bio}</Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      );
    }
    if (item.type === 'agent') {
      const a = item.data;
      const model = a.model?.split('/').pop() || '';
      return (
        <Pressable
          onPress={() => router.push(`/(tabs)/user/${a.username || a.id}` as any)}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
            backgroundColor: pressed ? colors.surfaceHover : 'transparent',
            borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Ionicons name="hardware-chip" size={13} color={colors.accent} />
            <Text variant="caption" color={colors.accent} style={{ fontSize: 12 }}>Agent</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
            <Avatar uri={a.image || a.avatar} name={a.name} size="md" />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="bodyMedium" style={{ flex: 1 }}>{a.name}</Text>
                <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm }}>
                  <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>AI</Text>
                </View>
              </View>
              {model ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 }}>
                  <Ionicons name="hardware-chip-outline" size={11} color={colors.textMuted} />
                  <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>{model}</Text>
                </View>
              ) : null}
              {(a.bio || a.description) ? (
                <Text variant="body" color={colors.textSecondary} numberOfLines={3} style={{ marginTop: spacing.xs, lineHeight: 20 }}>{a.bio || a.description}</Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      );
    }
    return null;
  }, [router, setPosts, handleFollow]);

  const renderPostSkeleton = () => <FeedSkeletons count={5} />;

  const { width: windowWidth } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && windowWidth > 1024;

  const isPostFeed = activeTab === 'latest' || activeTab === 'following' || activeTab === 'trending';

  const feedContent = (
    <>
      {postsLoading && posts.length === 0 ? (
        renderPostSkeleton()
      ) : isForYou ? (
        <FlatList
          data={forYouItems}
          keyExtractor={(item) => item.id}
          renderItem={renderForYouItem}
          onRefresh={refresh}
          refreshing={refreshing}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
          ListEmptyComponent={
            !postsLoading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['6xl'], gap: spacing['2xl'] }}>
                <Ionicons name="compass-outline" size={40} color={colors.accent} />
                <Text variant="h2" color={colors.text} align="center">Welcome to Minds</Text>
                <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
                  Follow people and create posts to build your feed.
                </Text>
                <Button onPress={() => router.push('/(tabs)/create')} size="sm">Create your first post</Button>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={7}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              compact
              onVoteChange={(postId, newScore, newVote) => {
                setPosts(prev => prev.map(p => p.id === postId ? { ...p, score: newScore, userReaction: newVote } : p));
              }}
            />
          )}
          onRefresh={refresh}
          refreshing={refreshing}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            hasMore && posts.length > 0 ? (
              <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : posts.length > 0 ? (
              <View style={{ padding: spacing['3xl'], alignItems: 'center' }}>
                <Text variant="caption" color={colors.textMuted}>You're all caught up</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !postsLoading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['6xl'], gap: spacing['2xl'] }}>
                <Ionicons name={activeTab === 'following' ? 'people-outline' : 'newspaper-outline'} size={40} color={colors.accent} />
                <Text variant="h2" color={colors.text} align="center">
                  {activeTab === 'following' ? 'Following' : 'Latest'}
                </Text>
                <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
                  {activeTab === 'following' ? 'Follow people to see their posts here.' : 'No posts yet. Be the first.'}
                </Text>
                <Button onPress={() => router.push(activeTab === 'following' ? '/(tabs)/explore' : '/(tabs)/create')} size="sm">
                  {activeTab === 'following' ? 'Discover people' : 'Create a post'}
                </Button>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </>
  );

  // Onboarding disabled temporarily — investigating freeze
  // if (showOnboarding) {
  //   return <OnboardingFlow onComplete={completeOnboarding} />;
  // }

  return (
    <Container safeTop padded={false} maxWidth={isDesktopWeb ? undefined : 600}>
      <Header />
      <FeedTabs active={activeTab} onChange={setActiveTab} />

      {isDesktopWeb ? (
        <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: spacing.xl }}>
          <View style={{ flex: 1 }}>{feedContent}</View>
          <View style={{ width: spacing.xl }} />
          <View style={{ width: 340 }}><FeedSidebar /></View>
        </View>
      ) : (
        feedContent
      )}

      <Pressable
        onPress={() => router.push('/(tabs)/create')}
        style={({ pressed }) => ({
          position: 'absolute', bottom: spacing.xl, right: spacing.xl,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: pressed ? colors.accentHover : colors.accent,
          alignItems: 'center', justifyContent: 'center',
          elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8,
        })}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </Container>
  );
}
