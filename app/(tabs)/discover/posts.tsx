import * as React from 'react';
import { View, FlatList, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, PostCard } from '../../../components';
import { usePosts, useSearchPosts } from '../../../lib/hooks';
import { spacing } from '../../../constants/theme';
import { useColors } from '../../../lib/theme';
import { postScore, postReplyCount, timestampOf } from '../../../lib/models';
import { FilterChips, hotScore, ListSkeleton } from '../../../lib/discover';

// ──────────────────────────────────────────────────────────────────────────
// Posts tab — leaderboard + filter chips, or search results when the shared
// search box has a query. Chips: Hot (engagement), New (recent), Top (all-time
// score). Reads ?q on mount (deep-link / #tag) and searches.
// ──────────────────────────────────────────────────────────────────────────

type PostSort = 'hot' | 'new' | 'top';
const CHIPS: { key: PostSort; label: string }[] = [
  { key: 'hot', label: 'Hot' },
  { key: 'new', label: 'New' },
  { key: 'top', label: 'Top' },
];

export default function DiscoverPosts() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const colors = useColors();
  const query = (params.q || '').trim();
  const isSearching = query.length > 0;

  const [sort, setSort] = React.useState<PostSort>('hot');

  // 'new' needs chronological order; hot/top rank a score-sorted pool.
  const { posts: scorePosts, loading: scoreLoading, loadMore: loadMoreScore, hasMore: hasMoreScore } = usePosts('score', 40);
  const { posts: latestPosts, loading: latestLoading, loadMore: loadMoreLatest, hasMore: hasMoreLatest } = usePosts('latest', 40);
  const { results: searchResults, loading: searchLoading } = useSearchPosts(query);

  const ranked = React.useMemo(() => {
    if (sort === 'new') {
      return [...(latestPosts || [])].sort((a, b) =>
        new Date(timestampOf(b)).getTime() - new Date(timestampOf(a)).getTime());
    }
    if (sort === 'top') {
      return [...(scorePosts || [])].sort((a, b) =>
        (postScore(b) + postReplyCount(b)) - (postScore(a) + postReplyCount(a)));
    }
    // hot — engagement decayed by age, so recent high-engagement posts beat
    // ancient all-time bangers (the server's `sort=score` is all-time top).
    return [...(scorePosts || [])].sort((a, b) => hotScore(b) - hotScore(a));
  }, [sort, scorePosts, latestPosts]);

  const data = isSearching ? searchResults : ranked;
  const loading = isSearching
    ? searchLoading
    : (sort === 'new' ? latestLoading : scoreLoading) && data.length === 0;

  const onEndReached = isSearching ? undefined : (sort === 'new' ? loadMoreLatest : loadMoreScore);
  const hasMore = isSearching ? false : (sort === 'new' ? hasMoreLatest : hasMoreScore);

  if (loading) {
    return <ListSkeleton />;
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item: any, i) => `p-${item.id || i}`}
      renderItem={({ item }) => <PostCard post={item} compact />}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          {!isSearching && <FilterChips chips={CHIPS} active={sort} onChange={setSort} />}
          {data.length > 0 && (
            <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}>
              <Text variant="caption" color={colors.textMuted}>
                {isSearching ? `${data.length} result${data.length !== 1 ? 's' : ''}` : `${data.length} posts`}
              </Text>
            </View>
          )}
        </>
      }
      ListFooterComponent={hasMore && data.length > 0 ? (
        <View style={{ padding: spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}
      ListEmptyComponent={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
          <Ionicons name="newspaper-outline" size={40} color={colors.accent} />
          <Text variant="h2" color={colors.text} align="center">{isSearching ? 'No Results' : 'Discover Posts'}</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
            {isSearching ? 'Try a different search term.' : 'Be the first to create something.'}
          </Text>
          {!isSearching && <Button onPress={() => router.push('/(tabs)/create')} size="sm" style={{ marginTop: spacing.md }}>Create</Button>}
        </View>
      }
    />
  );
}
