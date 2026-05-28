import * as React from 'react';
import { View, FlatList, TextInput, Platform, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Avatar, Button, Skeleton, PostCard } from '../../components';
import { Container } from '../../components/Container';
import { TabBar } from '../../components/TabBar';
import { usePosts, useCommunities, useAgents, useProfiles, useSearchPosts } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { colors, spacing, radius, typography } from '../../constants/theme';

function FollowUnfollowButton({ isFollowed, onPress }: { isFollowed?: boolean; onPress: (e?: any) => void }) {
  const [toggled, setToggled] = React.useState(!!isFollowed);
  return (
    <Pressable
      onPress={(e) => { setToggled(!toggled); onPress(e); }}
      style={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xs + 2,
        borderRadius: radius.full,
        backgroundColor: toggled ? colors.surface : colors.accentMuted,
        borderWidth: toggled ? 1 : 0,
        borderColor: colors.borderSubtle,
      }}
    >
      <Text variant="caption" color={toggled ? colors.textSecondary : colors.accent}>
        {toggled ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  );
}

type DiscoverTab = 'posts' | 'people' | 'communities' | 'agents';

const TABS: { key: DiscoverTab; label: string }[] = [
  { key: 'posts', label: 'Posts' },
  { key: 'people', label: 'People' },
  { key: 'communities', label: 'Communities' },
  { key: 'agents', label: 'Agents' },
];

function PersonCard({ person, onPress, onFollow, isFollowed }: { person: any; onPress: () => void; onFollow: () => void; isFollowed?: boolean }) {
  const name = person.name || 'Unknown';
  const username = person.username;
  const bio = person.bio || person.description || '';
  const avatar = person.image || person.avatar;
  const followerCount = person.followerCount || person.follower_count || 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
      })}
    >
      <Avatar uri={avatar} name={name} size="lg" />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium">{name}</Text>
            {username && <Text variant="caption" color={colors.textMuted}>@{username}</Text>}
          </View>
          <FollowUnfollowButton isFollowed={isFollowed} onPress={(e: any) => { e?.stopPropagation?.(); onFollow(); }} />
        </View>
        {bio ? (
          <Text variant="body" color={colors.textSecondary} numberOfLines={4} style={{ marginTop: spacing.xs, lineHeight: 20 }}>
            {bio}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' }}>
          {followerCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="people-outline" size={11} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{followerCount.toLocaleString()}</Text>
            </View>
          )}
          {(person.postCount || person.post_count) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="newspaper-outline" size={11} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{(person.postCount || person.post_count).toLocaleString()}</Text>
            </View>
          ) : null}
          {(person.createdAt || person.created_at) && (() => {
            const joined = new Date(person.createdAt || person.created_at).getTime();
            const newish = Date.now() - joined < 7 * 86_400_000;
            return newish ? (
              <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: 4 }}>
                <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>NEW</Text>
              </View>
            ) : (
              <Text variant="caption" color={colors.textMuted}>Joined {timeAgoShort(person.createdAt || person.created_at)}</Text>
            );
          })()}
        </View>
      </View>
    </Pressable>
  );
}

function timeAgoShort(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function CommunityCard({ community, onPress }: { community: any; onPress: () => void }) {
  const name = community.name || 'Unnamed';
  const description = community.description || community.bio || '';
  const avatar = community.image || community.avatar;
  const memberCount = community.memberCount || community.member_count || 0;
  const postCount = community.postCount || community.post_count || 0;
  const privacy = community.privacy;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
      })}
    >
      <Avatar uri={avatar} name={name} size="lg" />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>{name}</Text>
          {privacy === 'private' && (
            <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
          )}
        </View>
        {description ? (
          <Text variant="body" color={colors.textSecondary} numberOfLines={3} style={{ marginTop: spacing.xs, lineHeight: 20 }}>
            {description}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="people-outline" size={11} color={colors.textMuted} />
            <Text variant="caption" color={colors.textMuted}>{memberCount.toLocaleString()}</Text>
          </View>
          {postCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="newspaper-outline" size={11} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{postCount.toLocaleString()}</Text>
            </View>
          )}
          {postCount >= 50 && (
            <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: 4 }}>
              <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>ACTIVE</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function AgentCard({ agent, onPress }: { agent: any; onPress: () => void }) {
  const name = agent.name || 'Agent';
  const bio = agent.bio || agent.description || agent.system_prompt?.slice(0, 120) || '';
  const avatar = agent.image || agent.avatar;
  const model = agent.model?.split('/').pop() || '';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
      })}
    >
      <Avatar uri={avatar} name={name} size="lg" />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>{name}</Text>
          <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm }}>
            <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>AI</Text>
          </View>
        </View>
        {bio ? (
          <Text variant="body" color={colors.textSecondary} numberOfLines={4} style={{ marginTop: spacing.xs, lineHeight: 20 }}>
            {bio}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm, flexWrap: 'wrap' }}>
          {model && <Text variant="caption" color={colors.textMuted}>Powered by {model}</Text>}
          <Text variant="caption" color={colors.accent}>Chat now →</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ── Compact carousel tiles used on the editorial canvas. ──
// These are deliberately smaller than the full row cards above so a
// horizontal scroll preview fits three to four items on a phone and six
// on web without feeling cramped.

const TILE_WIDTH = 220;

function PersonTile({ person, onPress }: { person: any; onPress: () => void }) {
  const name = person.name || 'Unknown';
  const username = person.username;
  const bio = person.bio || person.description || '';
  const avatar = person.image || person.avatar;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: TILE_WIDTH,
        padding: spacing.lg,
        marginRight: spacing.md,
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
      })}
    >
      <Avatar uri={avatar} name={name} size="lg" />
      <Text variant="bodyMedium" numberOfLines={1} style={{ marginTop: spacing.sm }}>{name}</Text>
      {username && <Text variant="caption" color={colors.textMuted} numberOfLines={1}>@{username}</Text>}
      {bio ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={3} style={{ marginTop: spacing.xs, lineHeight: 18 }}>
          {bio}
        </Text>
      ) : null}
    </Pressable>
  );
}

function CommunityTile({ community, onPress }: { community: any; onPress: () => void }) {
  const name = community.name || 'Unnamed';
  const description = community.description || community.bio || '';
  const avatar = community.image || community.avatar;
  const memberCount = community.memberCount || community.member_count || 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: TILE_WIDTH,
        padding: spacing.lg,
        marginRight: spacing.md,
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
      })}
    >
      <Avatar uri={avatar} name={name} size="lg" />
      <Text variant="bodyMedium" numberOfLines={1} style={{ marginTop: spacing.sm }}>{name}</Text>
      {description ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={3} style={{ marginTop: spacing.xs, lineHeight: 18 }}>
          {description}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm }}>
        <Ionicons name="people-outline" size={11} color={colors.textMuted} />
        <Text variant="caption" color={colors.textMuted}>{memberCount.toLocaleString()} members</Text>
      </View>
    </Pressable>
  );
}

function AgentTile({ agent, onPress }: { agent: any; onPress: () => void }) {
  const name = agent.name || 'Agent';
  const bio = agent.bio || agent.description || agent.system_prompt?.slice(0, 120) || '';
  const avatar = agent.image || agent.avatar;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: TILE_WIDTH,
        padding: spacing.lg,
        marginRight: spacing.md,
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Avatar uri={avatar} name={name} size="lg" />
        <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm }}>
          <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>AI</Text>
        </View>
      </View>
      <Text variant="bodyMedium" numberOfLines={1} style={{ marginTop: spacing.sm }}>{name}</Text>
      {bio ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={3} style={{ marginTop: spacing.xs, lineHeight: 18 }}>
          {bio}
        </Text>
      ) : null}
      <Text variant="caption" color={colors.accent} style={{ marginTop: spacing.sm }}>Chat now →</Text>
    </Pressable>
  );
}

function SectionHeader({ title, subtitle, onSeeAll }: { title: string; subtitle?: string; onSeeAll?: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
        paddingTop: spacing['2xl'],
        paddingBottom: spacing.md,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="h3">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>{subtitle}</Text>
        ) : null}
      </View>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text variant="caption" color={colors.accent}>See all →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function HorizontalCarousel({ children, loading }: { children: React.ReactNode; loading?: boolean }) {
  if (loading) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}
      >
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              width: TILE_WIDTH,
              height: 160,
              marginRight: spacing.md,
              borderRadius: radius.lg,
            }}
          >
            <Skeleton width={TILE_WIDTH} height={160} borderRadius={radius.lg} />
          </View>
        ))}
      </ScrollView>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}
    >
      {children}
    </ScrollView>
  );
}

export default function DiscoverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; mode?: string; userId?: string; q?: string }>();
  const { sdk } = useAuth();
  const [activeTab, setActiveTab] = React.useState<DiscoverTab>(
    (params.tab as DiscoverTab) || 'posts'
  );
  const [searchQuery, setSearchQuery] = React.useState(params.q || '');

  // Followers/following mode — kept as-is, takes over the screen
  const [followList, setFollowList] = React.useState<any[]>([]);
  const [followListLoading, setFollowListLoading] = React.useState(false);
  const followMode = params.mode as 'followers' | 'following' | undefined;
  const followUserId = params.userId;

  React.useEffect(() => {
    if (!followMode || !followUserId || !sdk) return;
    setFollowListLoading(true);
    (async () => {
      try {
        const res = followMode === 'followers'
          ? await sdk.profiles.followers(followUserId, { limit: 100 })
          : await sdk.profiles.following(followUserId, { limit: 100 });
        setFollowList(res.data || []);
      } catch {}
      finally { setFollowListLoading(false); }
    })();
  }, [followMode, followUserId, sdk]);

  const { posts, loading: postsLoading, loadMore: loadMorePosts, hasMore: hasMorePosts } = usePosts('score', 20);
  const { communities, loading: commLoading } = useCommunities(50);
  const { agents, loading: agentsLoading } = useAgents(50);
  const { profiles, loading: profilesLoading } = useProfiles(50);
  const { results: searchResults, loading: searchLoading } = useSearchPosts(searchQuery);

  // Search people via SDK when searching
  const [searchedPeople, setSearchedPeople] = React.useState<any[]>([]);
  React.useEffect(() => {
    if (!searchQuery.trim() || activeTab !== 'people' || !sdk) { setSearchedPeople([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await sdk.profiles.search({ q: searchQuery, limit: 20 });
        if (!cancelled) setSearchedPeople(res.data || []);
      } catch {
        if (!cancelled) setSearchedPeople([]);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery, activeTab, sdk]);

  const handleFollow = async (userId: string) => {
    if (!sdk) return;
    try {
      if (followMode) {
        await sdk.profiles.unfollow(userId);
      } else {
        await sdk.profiles.follow(userId);
      }
    } catch {}
  };

  const filterByQuery = (items: any[], fields: string[]) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) =>
      fields.some((f) => (item[f] || '').toLowerCase().includes(q))
    );
  };

  const isSearching = searchQuery.trim().length > 0;

  // ── Editorial canvas view (no search query, no follow mode) ──
  const renderCanvas = () => {
    const trendingPosts = (posts || []).slice(0, 3);
    const featuredCommunities = (communities || []).slice(0, 8);
    const featuredAgents = (agents || []).slice(0, 8);
    const featuredPeople = (profiles || []).slice(0, 8);

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing['3xl'] }}>
        {/* Trending posts — vertical list, lead card on top */}
        <SectionHeader
          title="Trending on Minds"
          subtitle="What people are reading and talking about"
          onSeeAll={() => setActiveTab('posts')}
        />
        {postsLoading && trendingPosts.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                  <Skeleton width={36} height={36} borderRadius={18} />
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Skeleton width={140} height={12} />
                    <Skeleton width={80} height={10} />
                  </View>
                </View>
                <Skeleton width="100%" height={50} />
              </View>
            ))}
          </View>
        ) : trendingPosts.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.lg }}>
            <Text variant="body" color={colors.textMuted}>No trending posts yet.</Text>
          </View>
        ) : (
          trendingPosts.map((p: any, index: number) => {
            if (index === 0) {
              return (
                <View key={p.id} style={{ borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle }}>
                  <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
                    <View style={{ alignSelf: 'flex-start', backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 4, marginBottom: spacing.sm }}>
                      <Text variant="caption" color={colors.accent} style={{ fontSize: 10, letterSpacing: 0.5 }}>TRENDING NOW</Text>
                    </View>
                  </View>
                  <PostCard post={p} />
                </View>
              );
            }
            return <PostCard key={p.id} post={p} compact />;
          })
        )}

        {/* Communities */}
        <SectionHeader
          title="Communities to join"
          subtitle="Find your people"
          onSeeAll={() => setActiveTab('communities')}
        />
        <HorizontalCarousel loading={commLoading && featuredCommunities.length === 0}>
          {featuredCommunities.map((c: any) => (
            <CommunityTile
              key={c.id}
              community={c}
              onPress={() => router.push(`/(tabs)/community/${c.slug || c.id}` as any)}
            />
          ))}
          <Pressable
            onPress={() => router.push('/(tabs)/create?mode=community' as any)}
            style={({ pressed }) => ({
              width: TILE_WIDTH,
              padding: spacing.lg,
              marginRight: spacing.md,
              backgroundColor: pressed ? colors.surfaceHover : colors.surface,
              borderRadius: radius.lg,
              borderWidth: 0.5,
              borderColor: colors.borderSubtle,
              borderStyle: 'dashed',
              alignItems: 'flex-start',
              justifyContent: 'center',
              minHeight: 160,
            })}
          >
            <View style={{ width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={22} color={colors.accent} />
            </View>
            <Text variant="bodyMedium" color={colors.accent} style={{ marginTop: spacing.sm }}>Start a community</Text>
            <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>Gather people around an interest</Text>
          </Pressable>
        </HorizontalCarousel>

        {/* Agents */}
        <SectionHeader
          title="Agents to chat with"
          subtitle="AIs people on Minds have built"
          onSeeAll={() => setActiveTab('agents')}
        />
        <HorizontalCarousel loading={agentsLoading && featuredAgents.length === 0}>
          {featuredAgents.map((a: any) => (
            <AgentTile
              key={a.id}
              agent={a}
              onPress={() => router.push(`/(tabs)/user/${a.username || a.id}` as any)}
            />
          ))}
        </HorizontalCarousel>

        {/* People */}
        <SectionHeader
          title="People to follow"
          subtitle="New voices on the network"
          onSeeAll={() => setActiveTab('people')}
        />
        <HorizontalCarousel loading={profilesLoading && featuredPeople.length === 0}>
          {featuredPeople.map((p: any) => (
            <PersonTile
              key={p.id}
              person={p}
              onPress={() => router.push(`/(tabs)/user/${p.username || p.id}` as any)}
            />
          ))}
        </HorizontalCarousel>
      </ScrollView>
    );
  };

  // ── List view (search results or specific tab) ──
  const getData = (): { type: string; data: any; key: string }[] => {
    if (activeTab === 'posts') {
      const filtered = isSearching ? searchResults : filterByQuery(posts || [], ['content', 'title']);
      return filtered.map((p: any, i: number) => ({ type: 'post', data: p, key: `p-${p.id || i}` }));
    }
    if (activeTab === 'people') {
      if (followMode) {
        return filterByQuery(followList, ['name', 'username', 'bio']).map((p: any, i: number) => ({ type: 'person', data: p, key: `u-${p.id || i}` }));
      }
      const source = isSearching && searchedPeople.length > 0 ? searchedPeople : filterByQuery(profiles || [], ['name', 'username', 'bio']);
      return source.map((p: any, i: number) => ({ type: 'person', data: p, key: `u-${p.id || i}` }));
    }
    if (activeTab === 'communities') {
      return filterByQuery(communities || [], ['name', 'description']).map((c: any, i: number) => ({ type: 'community', data: c, key: `c-${c.id || i}` }));
    }
    if (activeTab === 'agents') {
      return filterByQuery(agents || [], ['name', 'bio', 'description']).map((a: any, i: number) => ({ type: 'agent', data: a, key: `a-${a.id || i}` }));
    }
    return [];
  };

  const loading = activeTab === 'posts' ? (isSearching ? searchLoading : postsLoading)
    : activeTab === 'people' ? (followMode ? followListLoading : profilesLoading)
    : activeTab === 'communities' ? commLoading
    : agentsLoading;

  const items = getData();

  const renderItem = ({ item }: { item: { type: string; data: any; key: string } }) => {
    if (item.type === 'post') {
      return <PostCard post={item.data} compact />;
    }
    if (item.type === 'person') {
      return (
        <PersonCard
          person={item.data}
          isFollowed={!!followMode}
          onPress={() => router.push(`/(tabs)/user/${item.data.username || item.data.id}` as any)}
          onFollow={() => handleFollow(item.data.id)}
        />
      );
    }
    if (item.type === 'community') {
      return (
        <CommunityCard
          community={item.data}
          onPress={() => router.push(`/(tabs)/community/${item.data.slug || item.data.id}` as any)}
        />
      );
    }
    if (item.type === 'agent') {
      return (
        <AgentCard
          agent={item.data}
          onPress={() => router.push(`/(tabs)/user/${item.data.username || item.data.id}` as any)}
        />
      );
    }
    return null;
  };

  // Show the editorial canvas when we're on the default landing — no
  // search, no follow-list, no explicit tab filter. Once the user types,
  // taps a tab via "See all", or navigates here as a followers list,
  // fall through to the existing tab + list shape.
  const showCanvas = !isSearching && !followMode && !params.tab;

  return (
    <Container safeTop padded={false}>
      <View style={{ backgroundColor: colors.bg, zIndex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.borderSubtle,
          }}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3" style={{ flex: 1 }}>{followMode === 'followers' ? 'Followers' : followMode === 'following' ? 'Following' : 'Discover'}</Text>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}>
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
              placeholder="Search posts, people, communities, agents..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                flex: 1,
                color: colors.text,
                ...typography.body,
                paddingVertical: 10,
                ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
              }}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {!showCanvas && (
          <TabBar tabs={TABS} active={activeTab} onChange={(k) => setActiveTab(k as DiscoverTab)} scrollable />
        )}
      </View>

      {showCanvas ? (
        renderCanvas()
      ) : loading ? (
        <View style={{ padding: spacing.xl, gap: spacing.xl }}>
          {[1, 2, 3, 4, 5].map(i => (
            <View key={i} style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                <Skeleton width={44} height={44} borderRadius={22} />
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Skeleton width={160} height={14} />
                  <Skeleton width={100} height={12} />
                </View>
              </View>
              <Skeleton width="100%" height={40} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          onEndReached={activeTab === 'posts' && !isSearching ? loadMorePosts : undefined}
          onEndReachedThreshold={0.5}
          ListFooterComponent={activeTab === 'posts' && !isSearching && hasMorePosts && items.length > 0 ? (
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null}
          ListHeaderComponent={
            <>
              {activeTab === 'communities' && !isSearching && (
                <Pressable
                  onPress={() => router.push('/(tabs)/create?mode=community' as any)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
                    borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle,
                    backgroundColor: pressed ? colors.surfaceHover : colors.surface,
                  })}
                >
                  <View style={{ width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="add" size={22} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium" color={colors.accent}>Start a community</Text>
                    <Text variant="caption" color={colors.textMuted}>Gather people around a shared interest</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              )}
              {items.length > 0 && (
                <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}>
                  <Text variant="caption" color={colors.textMuted}>
                    {isSearching
                      ? `${items.length} result${items.length !== 1 ? 's' : ''}`
                      : activeTab === 'posts' ? `${items.length} trending posts`
                      : activeTab === 'people' ? `${items.length} people on the network`
                      : activeTab === 'communities' ? `${items.length} communities to join`
                      : `${items.length} agents you can chat with`
                    }
                  </Text>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
              <Ionicons
                name={
                  activeTab === 'communities' ? 'people-outline'
                  : activeTab === 'agents' ? 'hardware-chip-outline'
                  : activeTab === 'people' ? 'person-outline'
                  : activeTab === 'posts' ? 'newspaper-outline'
                  : 'compass-outline'
                }
                size={40}
                color={colors.accent}
              />
              <Text variant="h2" color={colors.text} align="center">
                {searchQuery ? 'No Results' : `Discover ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
              </Text>
              <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
                {searchQuery ? 'Try a different search term.' : 'Be the first to create something.'}
              </Text>
              {!searchQuery && (
                <Button onPress={() => router.push('/(tabs)/create')} size="sm" style={{ marginTop: spacing.md }}>Create</Button>
              )}
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </Container>
  );
}
