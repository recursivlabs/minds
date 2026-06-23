import * as React from 'react';
import { View, FlatList, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, PostCard } from '../../../components';
import { useDiscoverPosts, useSearchPosts, useTags } from '../../../lib/hooks';
import { spacing } from '../../../constants/theme';
import { useColors } from '../../../lib/theme';
import { postScore, postReplyCount, timestampOf, dedupePosts } from '../../../lib/models';
import {
  FilterMenu,
  FilterBar,
  TopicChips,
  hotScore,
  withinRange,
  sinceForRange,
  TIME_RANGE_CHIPS,
  ListSkeleton,
  type TimeRange,
} from '../../../lib/discover';

// ──────────────────────────────────────────────────────────────────────────
// Posts tab — the master search console's default. ALL posts, paginated
// (infinite scroll), with filters that change the SERVER query:
//
//   sort chips:  New  → recency (server default order)
//                Top  → ?sort=score (all-time)
//                Hot  → recency pages, re-ranked client-side by hotScore
//   time range:  Today / This week / This month / All time
//                → computes a `since` ISO passed as ?since= (server filter,
//                  coming soon) AND client-filters created_at as the fallback
//   topic chips: a row of tag chips → ?tag_ids=<id> (lights up once tags
//                backfill; renders nothing while the tags table is empty)
//
// When the shared search box has a query, server FTS (/posts/search?q=) takes
// over and results render in the same list. All of sort/range/tag/q live in
// the URL so deep-links + back/forward work.
// ──────────────────────────────────────────────────────────────────────────

type PostSort = 'new' | 'top' | 'hot';
const SORT_CHIPS: { key: PostSort; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'top', label: 'Top' },
  { key: 'hot', label: 'Hot' },
];

export default function DiscoverPosts() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; sort?: string; range?: string; tag?: string }>();
  const colors = useColors();

  const query = (params.q || '').trim();
  const isSearching = query.length > 0;

  // Filter state lives in the URL so deep-links + filters are shareable.
  // Default sort is Top (highest-scoring) — absent param → 'top'.
  const sort: PostSort = (params.sort === 'new' || params.sort === 'hot') ? params.sort : 'top';
  // Default time range is This Week (fresh content) — absent param → 'week'.
  const range: TimeRange =
    (params.range === 'today' || params.range === 'month' || params.range === 'all') ? params.range : 'week';
  const tagId = typeof params.tag === 'string' && params.tag ? params.tag : null;

  const setParam = React.useCallback((patch: Record<string, string | undefined>) => {
    router.setParams(patch as any);
  }, [router]);

  // The server date window — passed as ?since= (and client-filtered as fallback).
  const since = React.useMemo(() => sinceForRange(range), [range]);

  // Available topic tags (empty until backfilled → TopicChips renders nothing).
  const { tags } = useTags(50);

  // The paginated feed. 'hot' pages recency just like 'new' (it re-ranks
  // client-side), so they share a server query; only 'top' asks for ?sort=score.
  const { posts, loading, hasMore, loadMore } = useDiscoverPosts({
    order: sort,
    since,
    tagId: tagId || undefined,
    limit: 30,
  });

  // Server FTS when searching. Topic filter narrows the search too (?tag_ids).
  const { results: searchResults, loading: searchLoading } = useSearchPosts(query);

  // Rank + window the fetched pages. Dedup collapses repost/remind noise.
  const ranked = React.useMemo(() => {
    let list = dedupePosts([...(posts || [])]);
    // Client-side time window (fallback until the server honors ?since).
    if (range !== 'all') list = list.filter((p: any) => withinRange(p, range));
    if (sort === 'hot') {
      list.sort((a, b) => hotScore(b) - hotScore(a));
    } else if (sort === 'top') {
      list.sort((a, b) => (postScore(b) + postReplyCount(b)) - (postScore(a) + postReplyCount(a)));
    } else {
      // new — strict recency.
      list.sort((a, b) => new Date(timestampOf(b)).getTime() - new Date(timestampOf(a)).getTime());
    }
    return list;
  }, [posts, sort, range]);

  // Search results honor the topic filter + the same dedup.
  const searched = React.useMemo(() => {
    let list = dedupePosts([...(searchResults || [])]);
    if (tagId) {
      list = list.filter((p: any) => {
        const ids = Array.isArray(p.tags) ? p.tags.map((t: any) => t?.id ?? t) : [];
        return ids.includes(tagId);
      });
    }
    if (range !== 'all') list = list.filter((p: any) => withinRange(p, range));
    return list;
  }, [searchResults, tagId, range]);

  const data = isSearching ? searched : ranked;
  const firstLoad = (isSearching ? searchLoading : loading) && data.length === 0;

  // When a client-side filter (time range / topic) thins the fetched pages to
  // very few rows, the short list can't scroll, so onEndReached never fires and
  // the user is stranded. Auto-pull more pages (bounded by hasMore) until we
  // have a screenful or run out. Drops out for free once the server honors the
  // filters and returns full pages. Search is a fixed FTS top-N — skip it.
  React.useEffect(() => {
    if (isSearching || loading || !hasMore) return;
    if ((range !== 'all' || tagId) && data.length < 12) {
      loadMore();
    }
  }, [isSearching, loading, hasMore, range, tagId, data.length, loadMore]);

  // Pagination only drives the non-search feed (search is a fixed top-N FTS).
  const onEndReached = isSearching ? undefined : loadMore;
  const showFooter = !isSearching && hasMore && data.length > 0;

  if (firstLoad) return <ListSkeleton />;

  return (
    <FlatList
      data={data}
      keyExtractor={(item: any, i) => `p-${item.id || i}`}
      renderItem={({ item }) => <PostCard post={item} compact />}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          <TopicChips
            tags={tags as any}
            activeId={tagId}
            onPick={(id) => setParam({ tag: id || undefined })}
          />
          {!isSearching && (
            <FilterBar>
              <FilterMenu
                options={SORT_CHIPS}
                value={sort}
                icon="swap-vertical"
                onChange={(k) => setParam({ sort: k === 'top' ? undefined : k })}
              />
              <FilterMenu
                options={TIME_RANGE_CHIPS}
                value={range}
                icon="time-outline"
                onChange={(k) => setParam({ range: k === 'all' ? undefined : k })}
              />
            </FilterBar>
          )}
          {data.length > 0 && (
            <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}>
              <Text variant="caption" color={colors.textMuted}>
                {isSearching
                  ? `${data.length} result${data.length !== 1 ? 's' : ''}`
                  : `${data.length}${hasMore ? '+' : ''} post${data.length !== 1 ? 's' : ''}`}
              </Text>
            </View>
          )}
        </>
      }
      ListFooterComponent={showFooter ? (
        <View style={{ padding: spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}
      ListEmptyComponent={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
          <Ionicons name="newspaper-outline" size={40} color={colors.accent} />
          <Text variant="h2" color={colors.text} align="center">{isSearching ? 'No Results' : 'Discover Posts'}</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
            {isSearching ? 'Try a different search term.' : (range !== 'all' || tagId) ? 'Nothing in this filter yet — try widening the range.' : 'Be the first to create something.'}
          </Text>
          {!isSearching && <Button onPress={() => router.push('/(tabs)/create')} size="sm" style={{ marginTop: spacing.md }}>Create</Button>}
        </View>
      }
    />
  );
}
