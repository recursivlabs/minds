import * as React from 'react';
import { View, FlatList, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../../components';
import { useCommunities, useTags } from '../../../lib/hooks';
import { spacing, radius } from '../../../constants/theme';
import { useColors } from '../../../lib/theme';
import { timestampOf } from '../../../lib/models';
import { FilterChips, TopicChips, CommunityRow, ListSkeleton, communityMemberCount, communityActivity } from '../../../lib/discover';

// ──────────────────────────────────────────────────────────────────────────
// Communities tab — leaderboard + filter chips. There's no community search
// endpoint, so a query client-filters the loaded list. Chips: Most members /
// Most active (members + posts*2) / Newest (created_at). The list payload
// carries member_count + created_at but not post_count, so "Most active"
// currently tracks membership — it gains the post weighting for free the moment
// the list endpoint starts returning post_count (no client change needed).
// ──────────────────────────────────────────────────────────────────────────

type CommSort = 'members' | 'active' | 'newest';
const CHIPS: { key: CommSort; label: string }[] = [
  { key: 'members', label: 'Most members' },
  { key: 'active', label: 'Most active' },
  { key: 'newest', label: 'Newest' },
];

export default function DiscoverCommunities() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; sort?: string; tag?: string }>();
  const colors = useColors();
  const query = (params.q || '').trim();
  const isSearching = query.length > 0;

  // Sort lives in the URL so it deep-links + survives back/forward.
  const sort: CommSort = (params.sort === 'active' || params.sort === 'newest') ? params.sort : 'members';
  const setSort = React.useCallback((k: CommSort) => router.setParams({ sort: k === 'members' ? undefined : k } as any), [router]);
  const tagId = typeof params.tag === 'string' && params.tag ? params.tag : null;
  const { tags } = useTags(50);
  // 100 is the server's max for /communities — fetch the whole set (~95 live) so
  // the count is accurate and the chips re-sort the FULL corpus, not a page.
  const { communities, loading } = useCommunities(100);

  const ranked = React.useMemo(() => {
    let list = [...(communities || [])];
    if (isSearching) {
      const q = query.toLowerCase();
      list = list.filter((c: any) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q));
    }
    // Topic filter: no-op until community payloads carry tag ids, then filters
    // for free (communities with the picked tag in their `tags` array).
    if (tagId) {
      list = list.filter((c: any) => {
        const ids = Array.isArray(c.tags) ? c.tags.map((t: any) => t?.id ?? t) : null;
        return ids ? ids.includes(tagId) : true;
      });
    }
    if (sort === 'newest') {
      return list.sort((a, b) => new Date(timestampOf(b)).getTime() - new Date(timestampOf(a)).getTime());
    }
    if (sort === 'active') {
      return list.sort((a, b) => communityActivity(b) - communityActivity(a));
    }
    return list.sort((a, b) => communityMemberCount(b) - communityMemberCount(a));
  }, [communities, sort, isSearching, query, tagId]);

  const toCommunity = (c: any) => router.push(`/(tabs)/community/${c.slug || c.id}` as any);

  if (loading && (communities || []).length === 0) return <ListSkeleton />;

  return (
    <FlatList
      data={ranked}
      keyExtractor={(item: any, i) => `c-${item.id || i}`}
      renderItem={({ item }) => <CommunityRow community={item} onPress={() => toCommunity(item)} />}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          {!isSearching && (
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
          {!isSearching && <FilterChips chips={CHIPS} active={sort} onChange={setSort} />}
          <TopicChips tags={tags as any} activeId={tagId} onPick={(id) => router.setParams({ tag: id || undefined } as any)} />
          {ranked.length > 0 && (
            <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}>
              <Text variant="caption" color={colors.textMuted}>
                {isSearching ? `${ranked.length} result${ranked.length !== 1 ? 's' : ''}` : `${ranked.length} communities to join`}
              </Text>
            </View>
          )}
        </>
      }
      ListEmptyComponent={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
          <Ionicons name="people-outline" size={40} color={colors.accent} />
          <Text variant="h2" color={colors.text} align="center">{isSearching ? 'No Results' : 'Discover Communities'}</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
            {isSearching ? 'Try a different search term.' : 'Be the first to start one.'}
          </Text>
        </View>
      }
    />
  );
}
