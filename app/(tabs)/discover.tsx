import * as React from 'react';
import { View, FlatList, TextInput, Platform, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Avatar, Button, Skeleton, PostCard } from '../../components';
import { Container } from '../../components/Container';
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
        borderBottomColor: 'rgba(255,255,255,0.04)',
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm }}>
          {followerCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Ionicons name="people-outline" size={12} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{followerCount}</Text>
            </View>
          )}
          {(person.postCount || person.post_count) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Ionicons name="newspaper-outline" size={12} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{person.postCount || person.post_count}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function CommunityCard({ community, onPress }: { community: any; onPress: () => void }) {
  const name = community.name || 'Unnamed';
  const description = community.description || community.bio || '';
  const avatar = community.image || community.avatar;
  const memberCount = community.memberCount || community.member_count || 0;
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
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255,255,255,0.04)',
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
          <Text variant="body" color={colors.textSecondary} numberOfLines={4} style={{ marginTop: spacing.xs, lineHeight: 20 }}>
            {description}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Ionicons name="people-outline" size={12} color={colors.textMuted} />
            <Text variant="caption" color={colors.textMuted}>{memberCount}</Text>
          </View>
          {(community.postCount || community.post_count) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Ionicons name="newspaper-outline" size={12} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{community.postCount || community.post_count}</Text>
            </View>
          ) : null}
        </View>
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs, display: 'none' as any }}>
          {memberCount} member{memberCount !== 1 ? 's' : ''}
        </Text>
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
        borderBottomColor: 'rgba(255,255,255,0.04)',
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm }}>
          {model ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Ionicons name="hardware-chip-outline" size={12} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{model}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Ionicons name="chatbubble-outline" size={12} color={colors.textMuted} />
            <Text variant="caption" color={colors.textMuted}>Chat</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function DiscoverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; mode?: string; userId?: string }>();
  const { sdk } = useAuth();
  const [activeTab, setActiveTab] = React.useState<DiscoverTab>(
    (params.tab as DiscoverTab) || 'posts'
  );
  const [searchQuery, setSearchQuery] = React.useState('');

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

  const { posts, loading: postsLoading } = usePosts('score', 30);
  const { communities, loading: commLoading } = useCommunities(50);
  const { agents, loading: agentsLoading } = useAgents(50);
  const { profiles, loading: profilesLoading } = useProfiles(50);
  const { results: searchResults, loading: searchLoading } = useSearchPosts(searchQuery);

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
      const source = followMode ? followList : profiles || [];
      return filterByQuery(source, ['name', 'username', 'bio']).map((p: any, i: number) => ({ type: 'person', data: p, key: `u-${p.id || i}` }));
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

  return (
    <Container safeTop padded={false}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(255,255,255,0.06)',
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          gap: spacing.xs,
        }}
        style={{
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(255,255,255,0.06)',
          flexGrow: 0,
        }}
      >
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => { setActiveTab(tab.key); }}
            style={{
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.md,
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab.key ? colors.accent : 'transparent',
            }}
          >
            <Text
              variant="label"
              color={activeTab === tab.key ? colors.accent : colors.textMuted}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

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
