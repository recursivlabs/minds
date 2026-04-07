import * as React from 'react';
import { View, ScrollView, FlatList, TextInput, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Avatar, Skeleton, Button, PostCard } from '../../components';
import { Container } from '../../components/Container';
import { usePosts, useCommunities, useAgents, useSearchPosts, useProfiles } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { colors, spacing, radius, typography } from '../../constants/theme';

const HIDDEN_AGENT_IDS = ['411ac3a9-dfbc-4463-8963-2e26a645211e'];

/**
 * Explore — a single unified feed of the most interesting things on the network.
 * No categories, no horizontal scrollers. Just a vertical feed that
 * interleaves trending posts with suggested people, communities, and agents.
 * Like Twitter Explore meets TikTok For You — content-first discovery.
 */
export default function ExploreScreen() {
  const router = useRouter();
  const { sdk } = useAuth();
  const [query, setQuery] = React.useState('');

  const { posts, loading: postsLoading } = usePosts('score', 20);
  const { communities, loading: commLoading } = useCommunities(10);
  const { agents, loading: agentsLoading } = useAgents(10);
  const { profiles, loading: profilesLoading } = useProfiles(10);
  const { results: searchResults, loading: searchLoading } = useSearchPosts(query);

  const isSearching = query.trim().length > 0;
  const loading = postsLoading && profilesLoading && commLoading && agentsLoading;

  const handleFollow = async (userId: string) => {
    if (!sdk) return;
    try { await sdk.profiles.follow(userId); } catch {}
  };

  const visibleAgents = (agents || []).filter((a: any) => !HIDDEN_AGENT_IDS.includes(a.id));

  // Build a unified discovery feed: interleave posts with people/community/agent suggestions
  const feedItems = React.useMemo(() => {
    const items: { type: string; data: any; id: string }[] = [];
    const trendingPosts = posts || [];
    const suggestedPeople = profiles || [];
    const suggestedCommunities = communities || [];
    const suggestedAgents = visibleAgents;

    let pi = 0, ui = 0, ci = 0, ai = 0;

    // Pattern: 3 posts, then 1 suggestion card, repeat
    while (pi < trendingPosts.length || ui < suggestedPeople.length || ci < suggestedCommunities.length || ai < suggestedAgents.length) {
      // 3 posts
      for (let i = 0; i < 3 && pi < trendingPosts.length; i++) {
        items.push({ type: 'post', data: trendingPosts[pi], id: `post-${trendingPosts[pi].id}` });
        pi++;
      }

      // 1 suggestion — rotate between people, communities, agents
      const suggestionType = items.filter(i => i.type !== 'post').length % 3;
      if (suggestionType === 0 && ui < suggestedPeople.length) {
        // Show a group of 3 people
        const peopleBatch = suggestedPeople.slice(ui, ui + 3);
        if (peopleBatch.length > 0) {
          items.push({ type: 'people-group', data: peopleBatch, id: `people-${ui}` });
          ui += peopleBatch.length;
        }
      } else if (suggestionType === 1 && ci < suggestedCommunities.length) {
        items.push({ type: 'community', data: suggestedCommunities[ci], id: `comm-${suggestedCommunities[ci].id}` });
        ci++;
      } else if (suggestionType === 2 && ai < suggestedAgents.length) {
        items.push({ type: 'agent', data: suggestedAgents[ai], id: `agent-${suggestedAgents[ai].id}` });
        ai++;
      }
    }

    return items;
  }, [posts, profiles, communities, visibleAgents]);

  const renderItem = ({ item }: { item: { type: string; data: any; id: string } }) => {
    if (item.type === 'post') {
      return <PostCard key={item.data.id} post={item.data} compact />;
    }

    if (item.type === 'people-group') {
      const people = item.data as any[];
      return (
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
          <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
            Suggested for you
          </Text>
          {people.map((person: any) => {
            const name = person.name || 'Unknown';
            const username = person.username;
            const bio = person.bio || person.description || '';
            const avatar = person.image || person.avatar;
            return (
              <Pressable
                key={person.id}
                onPress={() => router.push(`/(tabs)/user/${username || person.id}` as any)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.sm + 2,
                  backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                  borderRadius: radius.md,
                })}
              >
                <Avatar uri={avatar} name={name} size="md" />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" numberOfLines={1}>{name}</Text>
                  {username && <Text variant="caption" color={colors.textMuted}>@{username}</Text>}
                  {bio ? <Text variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ marginTop: 2 }}>{bio}</Text> : null}
                </View>
                <FollowButton onFollow={() => handleFollow(person.id)} />
              </Pressable>
            );
          })}
        </View>
      );
    }

    if (item.type === 'community') {
      const c = item.data;
      const name = c.name || 'Community';
      const description = c.description || c.bio || '';
      const avatar = c.image || c.avatar;
      const memberCount = c.memberCount || c.member_count || 0;
      return (
        <Pressable
          onPress={() => router.push(`/(tabs)/community/${c.slug || c.id}` as any)}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.lg,
            backgroundColor: pressed ? colors.surfaceHover : 'transparent',
            borderBottomWidth: 0.5,
            borderBottomColor: 'rgba(255,255,255,0.06)',
          })}
        >
          <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
            Community
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar uri={avatar} name={name} size="lg" />
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">{name}</Text>
              <Text variant="caption" color={colors.textMuted}>{memberCount} member{memberCount !== 1 ? 's' : ''}</Text>
              {description ? (
                <Text variant="body" color={colors.textSecondary} numberOfLines={2} style={{ marginTop: spacing.xs, lineHeight: 20 }}>
                  {description}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      );
    }

    if (item.type === 'agent') {
      const a = item.data;
      const name = a.name || 'Agent';
      const bio = a.bio || a.description || '';
      const avatar = a.image || a.avatar;
      const model = a.model?.split('/').pop() || '';
      return (
        <Pressable
          onPress={() => router.push(`/(tabs)/user/${a.username || a.id}` as any)}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.lg,
            backgroundColor: pressed ? colors.surfaceHover : 'transparent',
            borderBottomWidth: 0.5,
            borderBottomColor: 'rgba(255,255,255,0.06)',
          })}
        >
          <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
            Agent
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar uri={avatar} name={name} size="lg" />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="bodyMedium" style={{ flex: 1 }}>{name}</Text>
                <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm }}>
                  <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>AI</Text>
                </View>
              </View>
              {model ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Ionicons name="hardware-chip-outline" size={11} color={colors.textMuted} />
                  <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>{model}</Text>
                </View>
              ) : null}
              {bio ? (
                <Text variant="body" color={colors.textSecondary} numberOfLines={2} style={{ marginTop: spacing.xs, lineHeight: 20 }}>
                  {bio}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      );
    }

    return null;
  };

  return (
    <Container safeTop padded={false}>
      {/* Search */}
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 0.5,
            borderColor: colors.glassBorder,
            paddingHorizontal: spacing.md,
            gap: spacing.sm,
          }}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Search Minds..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            style={{
              flex: 1,
              color: colors.text,
              ...typography.body,
              paddingVertical: 12,
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
            }}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {isSearching ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PostCard key={item.id} post={item} compact />}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}>
              <Text variant="caption" color={colors.textMuted}>
                {searchLoading ? 'Searching...' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`}
              </Text>
            </View>
          }
          ListEmptyComponent={
            !searchLoading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['6xl'], gap: spacing['2xl'] }}>
                <Ionicons name="search-outline" size={40} color={colors.accent} />
                <Text variant="h2" color={colors.text} align="center">No Results</Text>
                <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
                  Try searching for something else.
                </Text>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      ) : loading ? (
        <View style={{ padding: spacing.xl, gap: spacing.xl }}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                <Skeleton width={40} height={40} borderRadius={20} />
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Skeleton width={140} height={14} />
                  <Skeleton width={80} height={12} />
                </View>
              </View>
              <Skeleton width="100%" height={50} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['6xl'], gap: spacing['2xl'] }}>
              <Ionicons name="compass-outline" size={40} color={colors.accent} />
              <Text variant="h2" color={colors.text} align="center">Explore</Text>
              <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
                Nothing to discover yet. Be the first to post.
              </Text>
              <Button onPress={() => router.push('/(tabs)/create')} size="sm">Create a post</Button>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </Container>
  );
}

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
      <Text variant="caption" color={followed ? colors.textSecondary : colors.accent} style={{ fontWeight: '500' }}>
        {followed ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  );
}
