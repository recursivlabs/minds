import * as React from 'react';
import { View, FlatList, Pressable, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, FeedTabs, PostCard, Text, Container, FeedSidebar, Button, Avatar } from '../../components';
import { FeedSkeletons } from '../../components/PostSkeleton';
import { ORG_ID } from '../../lib/recursiv';
import { useAuth } from '../../lib/auth';
import { usePosts } from '../../lib/hooks';
import { getPreference } from '../../lib/preferences';
import { registerShortcut } from '../../lib/keyboard';
import { getItem, setItem } from '../../lib/storage';
import { colors, spacing } from '../../constants/theme';

const PROFILE_NUDGE_DISMISSED_KEY = 'minds:profileNudge:dismissed';

type FeedTab = 'foryou' | 'latest' | 'following' | 'trending';

export default function FeedScreen() {
  const router = useRouter();
  const { sdk, user } = useAuth();
  const [activeTab, setActiveTab] = React.useState<FeedTab>('foryou');
  const [nudgeDismissed, setNudgeDismissed] = React.useState(true); // start true to avoid flash before storage read

  // Load persisted nudge dismissal so it stays dismissed across refreshes.
  React.useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const stored = await getItem(`${PROFILE_NUDGE_DISMISSED_KEY}:${user.id}`);
      setNudgeDismissed(stored === 'true');
    })();
  }, [user?.id]);

  const dismissNudge = React.useCallback(() => {
    setNudgeDismissed(true);
    if (user?.id) {
      setItem(`${PROFILE_NUDGE_DISMISSED_KEY}:${user.id}`, 'true');
    }
  }, [user?.id]);

  // For You uses the personal-agent curator feed. When the user has
  // disabled AI in Settings, fall back to chronological so they still
  // see content but no agent surfaces.
  const aiEnabled = getPreference('aiEnabled');
  const sortMap = {
    foryou: aiEnabled ? 'personal' : 'latest',
    latest: 'latest',
    following: 'following',
    trending: 'score',
  } as const;
  const { posts, setPosts, loading: postsLoading, refreshing, refresh, recurate, loadMore, hasMore } = usePosts(sortMap[activeTab] as any);

  // Tap the Feed tab while already on Feed → scroll the list to the top.
  // Standard X / Twitter / Instagram behavior.
  const listRef = React.useRef<FlatList<any> | null>(null);
  const navigation = useNavigation();
  React.useEffect(() => {
    const unsub = (navigation as any).addListener?.('tabPress', () => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return unsub;
  }, [navigation]);


  // Keyboard shortcuts
  React.useEffect(() => {
    const unsubs = [
      registerShortcut('n', () => router.push('/(tabs)/create')),
      registerShortcut('/', () => router.push('/(tabs)/discover' as any)),
      registerShortcut('g', () => router.push('/(tabs)/chat')),
      registerShortcut('escape', () => refresh()),
    ];
    return () => unsubs.forEach(u => u());
  }, [router, refresh]);

  // Refetch posts when returning from create screen
  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  const { width: windowWidth } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && windowWidth > 1024;

  // Show nudge when EITHER avatar or bio is missing (not both). Auto-hides
  // when profile is fully populated, regardless of whether the user
  // previously dismissed.
  const profileIncomplete = Boolean(user && (!user.image || !user.bio?.trim()));

  const feedContent = (
    <>
      {postsLoading && posts.length === 0 ? (
        <FeedSkeletons count={5} />
      ) : (
        <FlatList
          ref={listRef}
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
          ListHeaderComponent={
            <>
              {profileIncomplete && !nudgeDismissed && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
                  backgroundColor: colors.surface,
                  borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
                }}>
                  <Pressable onPress={() => { const slug = user?.username || user?.id; router.push(slug ? `/(tabs)/user/${slug}` as any : '/(tabs)/profile'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                    <Ionicons name="person-circle-outline" size={28} color={colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium" color={colors.text}>Complete your profile</Text>
                      <Text variant="caption" color={colors.textMuted}>Add a photo and bio so people can find you</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={dismissNudge} hitSlop={12}>
                    <Ionicons name="close" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              )}
              <Pressable
                onPress={() => router.push('/(tabs)/create')}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
                  borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
                  backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                })}
              >
                <Avatar uri={user?.image} name={user?.name} size="sm" />
                <Text variant="body" color={colors.textMuted}>What's on your mind?</Text>
              </Pressable>
            </>
          }
          onRefresh={recurate}
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
                  {activeTab === 'following' ? 'Following' : activeTab === 'foryou' ? 'Your agent is warming up' : 'Latest'}
                </Text>
                <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
                  {activeTab === 'following' ? 'Follow people to see their posts here.' : activeTab === 'foryou' ? 'Pull to refresh and your agent will curate fresh links from the open web.' : 'No posts yet. Be the first.'}
                </Text>
                <View style={{ alignSelf: 'center' }}>
                  <Button onPress={() => router.push(activeTab === 'following' ? '/(tabs)/explore' : '/(tabs)/create')} size="sm">
                    {activeTab === 'following' ? 'Discover people' : 'Write a post'}
                  </Button>
                </View>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </>
  );

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

    </Container>
  );
}
