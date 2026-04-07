import * as React from 'react';
import { View, ScrollView, FlatList, TextInput, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Avatar, Skeleton } from '../../components';
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
        marginTop: spacing.xl,
      }}
    >
      <Text variant="bodyMedium" color={colors.textSecondary}>{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text variant="caption" color={colors.accent}>See all</Text>
        </Pressable>
      )}
    </View>
  );
}

function SmallItem({ name, avatar, onPress }: { name: string; avatar?: string | null; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ alignItems: 'center', width: 72, marginRight: spacing.md }}
    >
      <Avatar uri={avatar} name={name} size="lg" />
      <Text
        variant="caption"
        color={colors.textSecondary}
        numberOfLines={1}
        align="center"
        style={{ marginTop: spacing.xs, width: 72 }}
      >
        {name}
      </Text>
    </Pressable>
  );
}

function TrendingItem({ post, onPress }: { post: any; onPress: () => void }) {
  const title = post.title || post.content?.slice(0, 60) || 'Untitled';
  const author = post.author?.name || 'Anonymous';

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 180,
        marginRight: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        borderWidth: 0.5,
        borderColor: colors.glassBorder,
      }}
    >
      <Text variant="bodyMedium" numberOfLines={2} style={{ fontSize: 13 }}>
        {title}
      </Text>
      <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ marginTop: spacing.xs }}>
        {author}
      </Text>
    </Pressable>
  );
}

function FederatedSection({ sdk }: { sdk: any }) {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!sdk) { setLoading(false); return; }
    (async () => {
      try {
        const res = await (sdk as any).protocols.search({ query: '', limit: 10 });
        setItems(Array.isArray(res) ? res : res?.results || []);
      } catch {}
      setLoading(false);
    })();
  }, [sdk]);

  if (!loading && items.length === 0) return null;

  return (
    <>
      <SectionHeader title="Federated" />
      {loading ? (
        <View style={{ flexDirection: 'row' }}>
          {[1, 2, 3].map(i => <Skeleton key={i} width={200} height={80} borderRadius={radius.md} style={{ marginRight: spacing.md }} />)}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {items.map((item: any, i: number) => (
            <View
              key={item.id || i}
              style={{
                width: 200,
                marginRight: spacing.md,
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: spacing.md,
                borderWidth: 0.5,
                borderColor: colors.glassBorder,
              }}
            >
              <Text variant="bodyMedium" numberOfLines={2} style={{ fontSize: 13 }}>
                {item.title || item.content?.slice(0, 80) || 'Untitled'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
                {item.protocol && (
                  <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.xs, paddingVertical: 1, borderRadius: 4 }}>
                    <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>{item.protocol}</Text>
                  </View>
                )}
                <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
                  {item.author || item.source || 'Unknown'}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const { sdk } = useAuth();
  const [query, setQuery] = React.useState('');

  const { posts, loading: postsLoading } = usePosts('score', 10);
  const { communities, loading: commLoading } = useCommunities(10);
  const { agents, loading: agentsLoading } = useAgents(10);
  const { profiles, loading: profilesLoading } = useProfiles(10);
  const { results: searchResults, loading: searchLoading } = useSearchPosts(query);

  const isSearching = query.trim().length > 0;

  const handleFollow = async (userId: string) => {
    if (!sdk) return;
    try { await sdk.profiles.follow(userId); } catch {}
  };

  return (
    <Container safeTop padded={false}>
      {/* Search bar */}
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
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(tabs)/post/${item.id}` as any)}
              style={{
                paddingVertical: spacing.md,
                borderBottomWidth: 0.5,
                borderBottomColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <Text variant="bodyMedium" numberOfLines={2}>
                {item.title || item.content?.slice(0, 100) || 'Untitled'}
              </Text>
              <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
                {item.author?.name || 'Anonymous'}
              </Text>
            </Pressable>
          )}
          ListHeaderComponent={
            <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
              {searchLoading ? 'Searching...' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`}
            </Text>
          }
          ListEmptyComponent={
            !searchLoading ? (
              <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
                <Text variant="body" color={colors.textMuted}>No results found</Text>
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
          {/* Trending */}
          <SectionHeader
            title="Trending"
            onSeeAll={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'posts' } })}
          />
          {postsLoading ? (
            <View style={{ flexDirection: 'row' }}>
              {[1, 2, 3].map(i => <Skeleton key={i} width={180} height={70} borderRadius={radius.md} style={{ marginRight: spacing.md }} />)}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {posts.slice(0, 8).map((post: any) => (
                <TrendingItem
                  key={post.id}
                  post={post}
                  onPress={() => router.push(`/(tabs)/post/${post.id}` as any)}
                />
              ))}
            </ScrollView>
          )}

          {/* People */}
          <SectionHeader
            title="People"
            onSeeAll={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'people' } })}
          />
          {profilesLoading ? (
            <View style={{ flexDirection: 'row' }}>
              {[1, 2, 3].map(i => <Skeleton key={i} width={56} height={56} borderRadius={28} style={{ marginRight: spacing.md }} />)}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {profiles.slice(0, 10).map((u: any) => (
                <SmallItem
                  key={u.id}
                  name={u.name || 'User'}
                  avatar={u.image || u.avatar}
                  onPress={() => router.push(`/(tabs)/user/${u.username || u.id}` as any)}
                />
              ))}
            </ScrollView>
          )}

          {/* Communities */}
          <SectionHeader
            title="Communities"
            onSeeAll={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'communities' } })}
          />
          {commLoading ? (
            <View style={{ flexDirection: 'row' }}>
              {[1, 2, 3].map(i => <Skeleton key={i} width={56} height={56} borderRadius={28} style={{ marginRight: spacing.md }} />)}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {communities.slice(0, 10).map((c: any) => (
                <SmallItem
                  key={c.id}
                  name={c.name}
                  avatar={c.image || c.avatar}
                  onPress={() => router.push(`/(tabs)/community/${c.slug || c.id}` as any)}
                />
              ))}
            </ScrollView>
          )}

          {/* Agents */}
          <SectionHeader
            title="Agents"
            onSeeAll={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'agents' } })}
          />
          {agentsLoading ? (
            <View style={{ flexDirection: 'row' }}>
              {[1, 2, 3].map(i => <Skeleton key={i} width={56} height={56} borderRadius={28} style={{ marginRight: spacing.md }} />)}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {agents.slice(0, 10).map((a: any) => (
                <SmallItem
                  key={a.id}
                  name={a.name}
                  avatar={a.image || a.avatar}
                  onPress={() => router.push(`/(tabs)/explore` as any)}
                />
              ))}
            </ScrollView>
          )}

          {/* Federated Content */}
          <FederatedSection sdk={sdk} />
        </ScrollView>
      )}
    </Container>
  );
}
