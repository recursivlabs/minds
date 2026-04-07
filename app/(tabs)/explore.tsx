import * as React from 'react';
import { View, FlatList, TextInput, Platform, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Avatar, Skeleton, Button, PostCard } from '../../components';
import { Container } from '../../components/Container';
import { usePosts, useCommunities, useAgents, useProfiles, useSearchPosts } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/Toast';
import { colors, spacing, radius, typography } from '../../constants/theme';

const HIDDEN_AGENT_IDS = ['411ac3a9-dfbc-4463-8963-2e26a645211e'];

type Category = 'posts' | 'people' | 'communities' | 'agents';
type SubTab = 'trending' | 'suggested' | 'new';

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'posts', label: 'Posts', icon: 'newspaper-outline' },
  { key: 'people', label: 'People', icon: 'person-outline' },
  { key: 'communities', label: 'Communities', icon: 'people-outline' },
  { key: 'agents', label: 'Agents', icon: 'hardware-chip-outline' },
];

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'trending', label: 'Trending' },
  { key: 'suggested', label: 'Suggested' },
  { key: 'new', label: 'New' },
];

function FollowButton({ onFollow }: { onFollow: () => void }) {
  const [followed, setFollowed] = React.useState(false);
  return (
    <Pressable
      onPress={() => { if (!followed) { setFollowed(true); onFollow(); } }}
      style={{
        paddingHorizontal: spacing.lg, paddingVertical: spacing.xs + 2,
        borderRadius: radius.full,
        backgroundColor: followed ? colors.surface : colors.accentMuted,
        borderWidth: followed ? 0.5 : 0, borderColor: colors.glassBorder,
      }}
    >
      <Text variant="caption" color={followed ? colors.textSecondary : colors.accent} style={{ fontFamily: 'Geist-Regular' }}>
        {followed ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  );
}

export default function DiscoverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { sdk } = useAuth();
  const toast = useToast();
  const [category, setCategory] = React.useState<Category>((params.tab as Category) || 'posts');
  const [subTab, setSubTab] = React.useState<SubTab>('trending');
  const [query, setQuery] = React.useState('');

  const { posts: trendingPosts, loading: postsLoading } = usePosts('score', 30);
  const { posts: latestPosts, loading: latestLoading } = usePosts('latest', 30);
  const { communities, loading: commLoading } = useCommunities(50);
  const { agents, loading: agentsLoading } = useAgents(50);
  const { profiles, loading: profilesLoading } = useProfiles(50);
  const { results: searchResults, loading: searchLoading } = useSearchPosts(query);

  const visibleAgents = React.useMemo(
    () => (agents || []).filter((a: any) => !HIDDEN_AGENT_IDS.includes(a.id)),
    [agents]
  );

  const isSearching = query.trim().length > 0;

  const handleFollow = async (userId: string) => {
    if (!sdk) return;
    try { await sdk.profiles.follow(userId); toast.show('Followed'); } catch {}
  };

  const getData = (): any[] => {
    if (isSearching) {
      if (category === 'posts') return searchResults;
      if (category === 'people') {
        const q = query.toLowerCase();
        return (profiles || []).filter((p: any) => (p.name || '').toLowerCase().includes(q) || (p.username || '').toLowerCase().includes(q));
      }
      if (category === 'communities') {
        const q = query.toLowerCase();
        return (communities || []).filter((c: any) => (c.name || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q));
      }
      if (category === 'agents') {
        const q = query.toLowerCase();
        return visibleAgents.filter((a: any) => (a.name || '').toLowerCase().includes(q) || (a.bio || '').toLowerCase().includes(q));
      }
    }

    if (category === 'posts') {
      if (subTab === 'trending') return trendingPosts || [];
      if (subTab === 'new') return latestPosts || [];
      return trendingPosts || []; // suggested = trending for now
    }
    if (category === 'people') {
      const all = profiles || [];
      if (subTab === 'trending') return [...all].sort((a: any, b: any) => (b.followerCount || b.follower_count || 0) - (a.followerCount || a.follower_count || 0));
      if (subTab === 'new') return [...all].sort((a: any, b: any) => new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime());
      return all;
    }
    if (category === 'communities') {
      const all = communities || [];
      if (subTab === 'trending') return [...all].sort((a: any, b: any) => (b.memberCount || b.member_count || 0) - (a.memberCount || a.member_count || 0));
      if (subTab === 'new') return [...all].sort((a: any, b: any) => new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime());
      return all;
    }
    if (category === 'agents') {
      return visibleAgents;
    }
    return [];
  };

  const loading = category === 'posts' ? (isSearching ? searchLoading : postsLoading)
    : category === 'people' ? profilesLoading
    : category === 'communities' ? commLoading
    : agentsLoading;

  const data = getData();

  const renderItem = ({ item }: { item: any }) => {
    if (category === 'posts') {
      return <PostCard post={item} compact />;
    }
    if (category === 'people') {
      return (
        <Pressable
          onPress={() => router.push(`/(tabs)/user/${item.username || item.id}` as any)}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: spacing.md,
            paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
            backgroundColor: pressed ? colors.surfaceHover : 'transparent',
            borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
          })}
        >
          <Avatar uri={item.image || item.avatar} name={item.name} size="md" />
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium" numberOfLines={1}>{item.name || 'Unknown'}</Text>
            {item.username && <Text variant="caption" color={colors.textMuted}>@{item.username}</Text>}
            {(item.bio || item.description) && (
              <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ marginTop: 2, lineHeight: 17 }}>{item.bio || item.description}</Text>
            )}
            {(item.followerCount || item.follower_count) ? (
              <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>{item.followerCount || item.follower_count} followers</Text>
            ) : null}
          </View>
          <FollowButton onFollow={() => handleFollow(item.id)} />
        </Pressable>
      );
    }
    if (category === 'communities') {
      return (
        <Pressable
          onPress={() => router.push(`/(tabs)/community/${item.slug || item.id}` as any)}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
            paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
            backgroundColor: pressed ? colors.surfaceHover : 'transparent',
            borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
          })}
        >
          <Avatar uri={item.image || item.avatar} name={item.name} size="md" />
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium" numberOfLines={1}>{item.name}</Text>
            <Text variant="caption" color={colors.textMuted}>{item.memberCount || item.member_count || 0} members</Text>
            {(item.description || item.bio) && (
              <Text variant="body" color={colors.textSecondary} numberOfLines={3} style={{ marginTop: spacing.xs, lineHeight: 20 }}>{item.description || item.bio}</Text>
            )}
          </View>
        </Pressable>
      );
    }
    if (category === 'agents') {
      return (
        <Pressable
          onPress={() => router.push(`/(tabs)/user/${item.username || item.id}` as any)}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
            paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
            backgroundColor: pressed ? colors.surfaceHover : 'transparent',
            borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
          })}
        >
          <Avatar uri={item.image || item.avatar} name={item.name} size="md" />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>{item.name}</Text>
              <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm }}>
                <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>AI</Text>
              </View>
            </View>
            {item.model && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 }}>
                <Ionicons name="hardware-chip-outline" size={11} color={colors.textMuted} />
                <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>{item.model.split('/').pop()}</Text>
              </View>
            )}
            {(item.bio || item.description) && (
              <Text variant="body" color={colors.textSecondary} numberOfLines={3} style={{ marginTop: spacing.xs, lineHeight: 20 }}>{item.bio || item.description}</Text>
            )}
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
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: colors.surface, borderRadius: radius.md,
          borderWidth: 0.5, borderColor: colors.glassBorder,
          paddingHorizontal: spacing.md, gap: spacing.sm,
        }}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Search..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            style={{
              flex: 1, color: colors.text, ...typography.body, paddingVertical: 12,
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

      {/* Category tabs */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.xs }}
        style={{ flexGrow: 0, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' }}
      >
        {CATEGORIES.map(cat => (
          <Pressable
            key={cat.key}
            onPress={() => setCategory(cat.key)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
              paddingVertical: spacing.md, paddingHorizontal: spacing.md,
              borderBottomWidth: 2, borderBottomColor: category === cat.key ? colors.accent : 'transparent',
            }}
          >
            <Ionicons name={cat.icon as any} size={15} color={category === cat.key ? colors.accent : colors.textMuted} />
            <Text variant="label" color={category === cat.key ? colors.accent : colors.textMuted}>{cat.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Sub-tabs */}
      {!isSearching && (
        <View style={{ flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.md, paddingVertical: spacing.sm }}>
          {SUB_TABS.map(st => (
            <Pressable
              key={st.key}
              onPress={() => setSubTab(st.key)}
              style={{
                paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
                borderRadius: radius.full,
                backgroundColor: subTab === st.key ? colors.accentSubtle : 'transparent',
              }}
            >
              <Text variant="caption" color={subTab === st.key ? colors.accent : colors.textMuted} style={{ fontSize: 12 }}>
                {st.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Results */}
      {loading ? (
        <View style={{ padding: spacing.xl, gap: spacing.xl }}>
          {[1, 2, 3, 4, 5].map(i => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <Skeleton width={40} height={40} borderRadius={20} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Skeleton width={160} height={14} />
                <Skeleton width={100} height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => item.id || `${i}`}
          renderItem={renderItem}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['6xl'], gap: spacing['2xl'] }}>
              <Ionicons name={CATEGORIES.find(c => c.key === category)?.icon as any || 'search-outline'} size={40} color={colors.accent} />
              <Text variant="h2" color={colors.text} align="center">
                {isSearching ? 'No Results' : `No ${category}`}
              </Text>
              <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
                {isSearching ? 'Try a different search.' : `Be the first to contribute.`}
              </Text>
              {!isSearching && (
                <Button onPress={() => router.push('/(tabs)/create')} size="sm">Create</Button>
              )}
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </Container>
  );
}
