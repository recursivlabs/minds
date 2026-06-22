import * as React from 'react';
import { View, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../../components';
import { useProfiles, useProfileLeaderboard, useTags } from '../../../lib/hooks';
import { useAuth } from '../../../lib/auth';
import { ORG_ID } from '../../../lib/recursiv';
import { spacing } from '../../../constants/theme';
import { useColors } from '../../../lib/theme';
import { profileFollowerCount, profilePostCount } from '../../../lib/models';
import { FilterChips, TopicChips, PersonRow, ListSkeleton } from '../../../lib/discover';

// ──────────────────────────────────────────────────────────────────────────
// People tab — leaderboard + filter chips, or search results when the shared
// search box has a query. Chips: Most followers / Most active (post count) /
// Suggested (network-closeness when the payload carries it, else followers).
//
// Data note: the /profiles list (server max 200) returns identity columns only
// — NO follower/post counts — ordered by signup date. So "Most active" can't
// rank on the list payload; we enrich it with the /profiles/leaderboard
// endpoint (server-ranked post_count + engagement) joined by user id. A TRUE
// cross-corpus follower leaderboard would need a server sort the list endpoint
// doesn't expose (and can't ship right now), so "Most followers" ranks whatever
// follower signal individual profiles carry, falling back to the active order.
// ──────────────────────────────────────────────────────────────────────────

type PeopleSort = 'followers' | 'active' | 'suggested';
const CHIPS: { key: PeopleSort; label: string }[] = [
  { key: 'followers', label: 'Most followers' },
  { key: 'active', label: 'Most active' },
  { key: 'suggested', label: 'Suggested' },
];

export default function DiscoverPeople() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; sort?: string; tag?: string }>();
  const colors = useColors();
  const { sdk } = useAuth();
  const query = (params.q || '').trim();
  const isSearching = query.length > 0;

  // Sort lives in the URL so it deep-links + survives back/forward.
  const sort: PeopleSort = (params.sort === 'active' || params.sort === 'suggested') ? params.sort : 'followers';
  const setSort = React.useCallback((k: PeopleSort) => router.setParams({ sort: k === 'followers' ? undefined : k } as any), [router]);
  const tagId = typeof params.tag === 'string' && params.tag ? params.tag : null;
  // Topic chips light up once tags backfill; profiles carry no tag field yet, so
  // a picked tag narrows nothing today — wired so it filters for free the moment
  // profiles return tag ids (graceful no-op until then).
  const { tags } = useTags(50);
  // 200 is the server's max for /profiles — fetch the largest pool it allows so
  // the directory + leaderboard re-rank the whole corpus, not just ~60.
  const { profiles, loading: profilesLoading } = useProfiles(200);
  // Engagement signal (post_count) joined by id, so "Most active" really ranks.
  const { byId: engagementById } = useProfileLeaderboard(100);

  // Search people via the SDK (the same path the old discover used).
  const [searchedPeople, setSearchedPeople] = React.useState<any[]>([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  React.useEffect(() => {
    if (!isSearching || !sdk) { setSearchedPeople([]); setSearchLoading(false); return; }
    let cancelled = false;
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await sdk.profiles.search({ q: query, limit: 20, organization_id: ORG_ID || undefined } as any);
        if (!cancelled) setSearchedPeople(res.data || []);
      } catch {
        if (!cancelled) setSearchedPeople([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, isSearching, sdk]);

  // Post count for "Most active": prefer any count on the profile payload, else
  // the leaderboard's post_count joined by id.
  const activityScore = React.useCallback((p: any): number => {
    const own = profilePostCount(p);
    if (own) return own;
    return engagementById.get(p?.id)?.engagement ?? engagementById.get(p?.id)?.postCount ?? 0;
  }, [engagementById]);

  const ranked = React.useMemo(() => {
    let list = [...(profiles || [])];
    // Topic filter: no-op until profile payloads carry tag ids, then filters
    // for free (profiles with the picked tag in their `tags` array).
    if (tagId) {
      list = list.filter((p: any) => {
        const ids = Array.isArray(p.tags) ? p.tags.map((t: any) => t?.id ?? t) : null;
        return ids ? ids.includes(tagId) : true;
      });
    }
    if (sort === 'active') {
      return list.sort((a, b) => activityScore(b) - activityScore(a));
    }
    if (sort === 'suggested') {
      // No closeness signal in the directory payload, so "Suggested" surfaces the
      // most active+followed first (a sensible fallback): engagement, then
      // followers, then signup recency (newest, which is the list's native order).
      return list.sort((a, b) => {
        const e = activityScore(b) - activityScore(a);
        if (e) return e;
        return profileFollowerCount(b) - profileFollowerCount(a);
      });
    }
    // Most followers — ranks the follower signal profiles carry; ties fall back
    // to activity so the list still orders meaningfully when followers are 0.
    return list.sort((a, b) => {
      const f = profileFollowerCount(b) - profileFollowerCount(a);
      if (f) return f;
      return activityScore(b) - activityScore(a);
    });
  }, [profiles, sort, activityScore, tagId]);

  const data = isSearching ? searchedPeople : ranked;
  const loading = (isSearching ? searchLoading : profilesLoading) && data.length === 0;

  const handleFollow = async (userId: string) => {
    if (!sdk) return;
    try { await sdk.profiles.follow(userId); } catch {}
  };
  const toUser = (u: any) => router.push(`/(tabs)/user/${u.username || u.id}` as any);

  if (loading) return <ListSkeleton />;

  return (
    <FlatList
      data={data}
      keyExtractor={(item: any, i) => `u-${item.id || i}`}
      renderItem={({ item }) => (
        <PersonRow person={item} onPress={() => toUser(item)} onFollow={() => handleFollow(item.id)} />
      )}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          {!isSearching && <FilterChips chips={CHIPS} active={sort} onChange={setSort} />}
          <TopicChips tags={tags as any} activeId={tagId} onPick={(id) => router.setParams({ tag: id || undefined } as any)} />
          {data.length > 0 && (
            <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}>
              <Text variant="caption" color={colors.textMuted}>
                {isSearching ? `${data.length} result${data.length !== 1 ? 's' : ''}` : `${data.length}${data.length >= 200 ? '+' : ''} people on the network`}
              </Text>
            </View>
          )}
        </>
      }
      ListEmptyComponent={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
          <Ionicons name="person-outline" size={40} color={colors.accent} />
          <Text variant="h2" color={colors.text} align="center">{isSearching ? 'No Results' : 'Discover People'}</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
            {isSearching ? 'Try a different search term.' : 'As people join, they show up here.'}
          </Text>
        </View>
      }
    />
  );
}
