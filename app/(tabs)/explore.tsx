import * as React from 'react';
import { View, ScrollView, FlatList, TextInput, Platform, Pressable, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, Text, Skeleton, Card, Button, Avatar } from '../../components';
import { Container } from '../../components/Container';
import { usePosts, useCommunities, useAgents, useSearchPosts, useProfiles } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { colors, spacing, radius, typography } from '../../constants/theme';

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
      }}
    >
      <Text variant="h3">{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text variant="label" color={colors.accent}>See all</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.accent} />
        </Pressable>
      )}
    </View>
  );
}

function useGridWidth() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const itemWidth = isDesktop ? '31%' : '48%';
  return { isDesktop, itemWidth };
}

// Compact post card for trending grid
function TrendingPostCard({ post, onPress }: { post: any; onPress: () => void }) {
  const title = post.title || post.content?.slice(0, 80) || 'Untitled';
  const author = post.author?.name || post.user?.name || 'Anonymous';
  const score = post.score || 0;

  return (
    <Pressable onPress={onPress}>
      <Card variant="raised" padding="md">
        <View style={{ gap: spacing.sm }}>
          <Text variant="bodyMedium" numberOfLines={2}>{title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{author}</Text>
            {score > 0 && (
              <View
                style={{
                  backgroundColor: colors.accentMuted,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                  borderRadius: radius.sm,
                }}
              >
                <Text variant="caption" color={colors.accent}>{score}</Text>
              </View>
            )}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

// Compact community card for grid
function TrendingCommunityCard({ community, onPress }: { community: any; onPress: () => void }) {
  const memberCount = community.memberCount || community.member_count || 0;

  return (
    <Pressable onPress={onPress}>
      <Card variant="raised" padding="md">
        <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}>
          <Avatar uri={community.avatar || community.image} name={community.name} size="lg" />
          <Text variant="bodyMedium" numberOfLines={1} align="center">{community.name}</Text>
          <Text variant="caption" color={colors.textMuted}>
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

// Compact agent card for grid
function TrendingAgentCard({ agent, onPress }: { agent: any; onPress: () => void }) {
  const bio = agent.bio || agent.description || '';

  return (
    <Pressable onPress={onPress}>
      <Card variant="raised" padding="md">
        <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}>
          <Avatar uri={agent.avatar || agent.image} name={agent.name} size="lg" />
          <Text variant="bodyMedium" numberOfLines={1} align="center">{agent.name}</Text>
          {bio ? (
            <Text variant="caption" color={colors.textMuted} numberOfLines={1} align="center">{bio}</Text>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

// Compact person card for grid
function TrendingPersonCard({
  user,
  onPress,
  onFollow,
}: {
  user: any;
  onPress: () => void;
  onFollow: () => void;
}) {
  const username = user.username || user.email?.split('@')[0] || '';

  return (
    <Pressable onPress={onPress}>
      <Card variant="raised" padding="md">
        <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}>
          <Avatar uri={user.avatar || user.image} name={user.name} size="lg" />
          <Text variant="bodyMedium" numberOfLines={1} align="center">{user.name || 'Anonymous'}</Text>
          {username ? (
            <Text variant="caption" color={colors.textMuted} numberOfLines={1}>@{username}</Text>
          ) : null}
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onFollow();
            }}
            style={{
              backgroundColor: colors.accentMuted,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radius.full,
              marginTop: 2,
            }}
          >
            <Text variant="caption" color={colors.accent}>Follow</Text>
          </Pressable>
        </View>
      </Card>
    </Pressable>
  );
}

// Grid wrapper with flexWrap
function Grid({ children, itemWidth }: { children: React.ReactNode; itemWidth: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
      }}
    >
      {React.Children.map(children, (child) =>
        child ? (
          <View style={{ width: itemWidth as any }}>{child}</View>
        ) : null,
      )}
    </View>
  );
}

function SkeletonGrid({ count, itemWidth }: { count: number; itemWidth: string }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: itemWidth as any }}>
          <Skeleton width="100%" height={120} borderRadius={radius.md} />
        </View>
      ))}
    </View>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const { sdk } = useAuth();
  const { itemWidth, isDesktop } = useGridWidth();
  const [query, setQuery] = React.useState('');

  const { posts, loading: postsLoading } = usePosts('score', 6);
  const { communities, loading: commLoading } = useCommunities(6);
  const { agents, loading: agentsLoading } = useAgents(6);
  const { profiles, loading: profilesLoading } = useProfiles(6);
  const { results: searchResults, loading: searchLoading } = useSearchPosts(query);

  const isSearching = query.trim().length > 0;

  const handleFollow = async (userId: string) => {
    if (!sdk) return;
    try {
      await sdk.profiles.follow(userId);
    } catch {}
  };

  const itemCount = isDesktop ? 6 : 4;

  return (
    <Container safeTop padded={false}>
      <Header />

      {/* Search bar */}
      <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.lg,
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
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.textMuted}
              onPress={() => setQuery('')}
            />
          )}
        </View>
      </View>

      {isSearching ? (
        /* Search results */
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl }}
          renderItem={({ item }) => (
            <View style={{ marginBottom: spacing.md }}>
              <TrendingPostCard
                post={item}
                onPress={() => router.push(`/post/${item.id}`)}
              />
            </View>
          )}
          ListHeaderComponent={
            <View style={{ paddingVertical: spacing.md }}>
              <Text variant="label" color={colors.textMuted}>
                {searchLoading ? 'Searching...' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`}
              </Text>
            </View>
          }
          ListEmptyComponent={
            !searchLoading ? (
              <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
                <Ionicons name="search-outline" size={40} color={colors.textMuted} />
                <Text variant="body" color={colors.textMuted} align="center">
                  No results found
                </Text>
                <Button onPress={() => setQuery('')} size="sm" variant="secondary">
                  Clear search
                </Button>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] }}
        >
          {/* Trending Posts */}
          <View style={{ paddingTop: spacing.lg }}>
            <SectionHeader
              title="Trending Posts"
              onSeeAll={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'posts' } })}
            />
            {postsLoading ? (
              <SkeletonGrid count={4} itemWidth={itemWidth} />
            ) : posts.length === 0 ? (
              <Card variant="raised">
                <View style={{ alignItems: 'center', padding: spacing.lg, gap: spacing.md }}>
                  <Ionicons name="newspaper-outline" size={32} color={colors.textMuted} />
                  <Text variant="body" color={colors.textMuted}>No posts yet</Text>
                </View>
              </Card>
            ) : (
              <Grid itemWidth={itemWidth}>
                {posts.slice(0, itemCount).map((post: any) => (
                  <TrendingPostCard
                    key={post.id}
                    post={post}
                    onPress={() => router.push(`/post/${post.id}`)}
                  />
                ))}
              </Grid>
            )}
          </View>

          {/* Trending Communities */}
          <View style={{ paddingTop: spacing['3xl'] }}>
            <SectionHeader
              title="Trending Communities"
              onSeeAll={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'communities' } })}
            />
            {commLoading ? (
              <SkeletonGrid count={4} itemWidth={itemWidth} />
            ) : communities.length === 0 ? (
              <Card variant="raised">
                <View style={{ alignItems: 'center', padding: spacing.lg, gap: spacing.md }}>
                  <Ionicons name="people-outline" size={32} color={colors.textMuted} />
                  <Text variant="body" color={colors.textMuted}>No communities yet</Text>
                  <Button
                    onPress={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'communities' } })}
                    size="sm"
                  >
                    Create a community
                  </Button>
                </View>
              </Card>
            ) : (
              <Grid itemWidth={itemWidth}>
                {communities.slice(0, itemCount).map((c: any) => (
                  <TrendingCommunityCard
                    key={c.id}
                    community={c}
                    onPress={() => router.push(`/community/${c.slug || c.id}`)}
                  />
                ))}
              </Grid>
            )}
          </View>

          {/* Trending Agents */}
          <View style={{ paddingTop: spacing['3xl'] }}>
            <SectionHeader
              title="Trending Agents"
              onSeeAll={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'agents' } })}
            />
            {agentsLoading ? (
              <SkeletonGrid count={4} itemWidth={itemWidth} />
            ) : agents.length === 0 ? (
              <Card variant="raised">
                <View style={{ alignItems: 'center', padding: spacing.lg, gap: spacing.md }}>
                  <Ionicons name="sparkles-outline" size={32} color={colors.textMuted} />
                  <Text variant="body" color={colors.textMuted}>No agents yet</Text>
                </View>
              </Card>
            ) : (
              <Grid itemWidth={itemWidth}>
                {agents.slice(0, itemCount).map((agent: any) => (
                  <TrendingAgentCard
                    key={agent.id}
                    agent={agent}
                    onPress={() => router.push(`/agent/${agent.id}`)}
                  />
                ))}
              </Grid>
            )}
          </View>

          {/* Trending People */}
          <View style={{ paddingTop: spacing['3xl'] }}>
            <SectionHeader
              title="Trending People"
              onSeeAll={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'people' } })}
            />
            {profilesLoading ? (
              <SkeletonGrid count={4} itemWidth={itemWidth} />
            ) : profiles.length === 0 ? (
              <Card variant="raised">
                <View style={{ alignItems: 'center', padding: spacing.lg, gap: spacing.md }}>
                  <Ionicons name="person-outline" size={32} color={colors.textMuted} />
                  <Text variant="body" color={colors.textMuted}>Be the first! Invite your friends</Text>
                </View>
              </Card>
            ) : (
              <Grid itemWidth={itemWidth}>
                {profiles.slice(0, itemCount).map((user: any) => (
                  <TrendingPersonCard
                    key={user.id}
                    user={user}
                    onPress={() => router.push(`/profile/${user.username || user.id}`)}
                    onFollow={() => handleFollow(user.id)}
                  />
                ))}
              </Grid>
            )}
          </View>

          {/* Apps */}
          <View style={{ paddingTop: spacing['3xl'] }}>
            <SectionHeader
              title="Apps"
              onSeeAll={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'apps' } })}
            />
            <Card variant="raised">
              <View style={{ alignItems: 'center', padding: spacing.xl }}>
                <Ionicons name="apps-outline" size={40} color={colors.textMuted} />
                <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>
                  No apps yet — build one!
                </Text>
                <Text
                  variant="caption"
                  color={colors.textMuted}
                  align="center"
                  style={{ marginTop: spacing.xs }}
                >
                  Build apps on the Minds platform
                </Text>
                <View style={{ marginTop: spacing.lg }}>
                  <Button onPress={() => {}} size="sm">
                    Build Your First App
                  </Button>
                </View>
              </View>
            </Card>
          </View>
        </ScrollView>
      )}
    </Container>
  );
}
