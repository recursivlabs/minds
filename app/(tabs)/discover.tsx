import * as React from 'react';
import { View, FlatList, TextInput, Platform, Pressable, ActivityIndicator } from 'react-native';
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

type DiscoverTab = 'posts' | 'blogs' | 'people' | 'communities' | 'agents' | 'apps';

const TABS: { key: DiscoverTab; label: string }[] = [
  { key: 'posts', label: 'Posts' },
  { key: 'blogs', label: 'Blogs' },
  { key: 'people', label: 'People' },
  { key: 'communities', label: 'Communities' },
  { key: 'agents', label: 'Agents' },
  { key: 'apps', label: 'Apps' },
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm, flexWrap: 'wrap' }}>
          {followerCount > 0 && <Text variant="caption" color={colors.textMuted}>{followerCount} follower{followerCount !== 1 ? 's' : ''}</Text>}
          {(person.postCount || person.post_count) ? <Text variant="caption" color={colors.textMuted}>· {person.postCount || person.post_count} posts</Text> : null}
          {(person.createdAt || person.created_at) && <Text variant="caption" color={colors.textMuted}>· Joined {timeAgoShort(person.createdAt || person.created_at)}</Text>}
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
  const createdAt = community.createdAt || community.created_at;

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm, flexWrap: 'wrap' }}>
          <Text variant="caption" color={colors.textMuted}>{memberCount} member{memberCount !== 1 ? 's' : ''}</Text>
          {postCount > 0 && <Text variant="caption" color={colors.textMuted}>· {postCount} post{postCount !== 1 ? 's' : ''}</Text>}
          {createdAt && <Text variant="caption" color={colors.textMuted}>· Created {timeAgoShort(createdAt)}</Text>}
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

export default function DiscoverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; mode?: string; userId?: string; q?: string }>();
  const { sdk } = useAuth();
  const [activeTab, setActiveTab] = React.useState<DiscoverTab>(
    (params.tab as DiscoverTab) || 'posts'
  );
  const [searchQuery, setSearchQuery] = React.useState(params.q || '');

  // Followers/following mode
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

  // Fetch apps (projects with deployments)
  const [apps, setApps] = React.useState<any[]>([]);
  const [appsLoading, setAppsLoading] = React.useState(false);
  React.useEffect(() => {
    if (activeTab !== 'apps' || !sdk) return;
    let cancelled = false;
    setAppsLoading(true);
    (async () => {
      try {
        const res = await sdk.projects.list({ limit: 50, organization_id: ORG_ID || undefined } as any);
        if (!cancelled) setApps(res.data || []);
      } catch {}
      if (!cancelled) setAppsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeTab, sdk]);

  // Search people via SDK when searching
  const [searchedPeople, setSearchedPeople] = React.useState<any[]>([]);
  const [searchPeopleLoading, setSearchPeopleLoading] = React.useState(false);
  React.useEffect(() => {
    if (!searchQuery.trim() || activeTab !== 'people' || !sdk) { setSearchedPeople([]); return; }
    let cancelled = false;
    setSearchPeopleLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await sdk.profiles.search({ q: searchQuery, limit: 20 });
        if (!cancelled) setSearchedPeople(res.data || []);
      } catch {
        // Fall back to client-side filter
        if (!cancelled) setSearchedPeople([]);
      }
      if (!cancelled) setSearchPeopleLoading(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery, activeTab, sdk]);

  const handleFollow = async (userId: string) => {
    if (!sdk) return;
    try {
      if (followMode) {
        // In following list — toggle (unfollow)
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
    if (activeTab === 'blogs') {
      const blogs = (posts || []).filter((p: any) => p.title);
      const filtered = isSearching ? searchResults.filter((p: any) => p.title) : filterByQuery(blogs, ['title', 'content']);
      return filtered.map((p: any, i: number) => ({ type: 'post', data: p, key: `b-${p.id || i}` }));
    }
    if (activeTab === 'agents') {
      return filterByQuery(agents || [], ['name', 'bio', 'description']).map((a: any, i: number) => ({ type: 'agent', data: a, key: `a-${a.id || i}` }));
    }
    if (activeTab === 'apps') {
      return filterByQuery(apps || [], ['name', 'slug']).map((a: any, i: number) => ({ type: 'app', data: a, key: `app-${a.id || i}` }));
    }
    return [];
  };

  const loading = activeTab === 'posts' || activeTab === 'blogs' ? (isSearching ? searchLoading : postsLoading)
    : activeTab === 'people' ? (followMode ? followListLoading : profilesLoading)
    : activeTab === 'communities' ? commLoading
    : activeTab === 'apps' ? appsLoading
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
    if (item.type === 'app') {
      const app = item.data;
      const deployUrl = app.slug ? `https://${app.slug}.on.recursiv.io` : null;
      return (
        <Pressable
          onPress={() => deployUrl && (Platform.OS === 'web' ? window.open(deployUrl, '_blank') : import('react-native').then(m => m.Linking.openURL(deployUrl)))}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
            borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="rocket-outline" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" numberOfLines={1}>{app.name}</Text>
              <Text variant="caption" color={colors.textMuted}>{app.slug}.on.recursiv.io</Text>
            </View>
            {deployUrl && <Ionicons name="open-outline" size={16} color={colors.textMuted} />}
          </View>
          {app.organization?.name && (
            <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.xs, marginLeft: 56 }}>
              by {app.organization.name}
            </Text>
          )}
        </Pressable>
      );
    }
    return null;
  };

  return (
    <Container safeTop padded={false}>
      {/* Header + Search + Tabs — solid bg so content doesn't bleed through */}
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

        {/* Search */}
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
              placeholder="Search..."
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

        {/* Tabs */}
        <TabBar tabs={TABS} active={activeTab} onChange={(k) => setActiveTab(k as DiscoverTab)} scrollable />
      </View>

      {/* List */}
      {loading ? (
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
          ListHeaderComponent={items.length > 0 ? (
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
          ) : null}
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
