import * as React from 'react';
import { View, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../../components';
import { useProfiles } from '../../../lib/hooks';
import { useAuth } from '../../../lib/auth';
import { ORG_ID } from '../../../lib/recursiv';
import { spacing } from '../../../constants/theme';
import { useColors } from '../../../lib/theme';
import { profileFollowerCount, profilePostCount } from '../../../lib/models';
import { FilterChips, PersonRow, ListSkeleton } from '../../../lib/discover';

// ──────────────────────────────────────────────────────────────────────────
// People tab — leaderboard + filter chips, or search results when the shared
// search box has a query. Chips: Most followers / Most active (post count) /
// Suggested (network-closeness when the payload carries it, else followers).
// ──────────────────────────────────────────────────────────────────────────

type PeopleSort = 'followers' | 'active' | 'suggested';
const CHIPS: { key: PeopleSort; label: string }[] = [
  { key: 'followers', label: 'Most followers' },
  { key: 'active', label: 'Most active' },
  { key: 'suggested', label: 'Suggested' },
];

// Network-closeness score, when the payload exposes it; otherwise followers act
// as the proxy so "Suggested" still ranks something sensible.
function closeness(p: any): number {
  return Number(
    p?.closeness ?? p?.relevance ?? p?.mutualCount ?? p?.mutual_count ?? p?.affinity ?? 0,
  ) || profileFollowerCount(p);
}

export default function DiscoverPeople() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const colors = useColors();
  const { sdk } = useAuth();
  const query = (params.q || '').trim();
  const isSearching = query.length > 0;

  const [sort, setSort] = React.useState<PeopleSort>('followers');
  const { profiles, loading: profilesLoading } = useProfiles(60);

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

  const ranked = React.useMemo(() => {
    const list = [...(profiles || [])];
    if (sort === 'active') return list.sort((a, b) => profilePostCount(b) - profilePostCount(a));
    if (sort === 'suggested') return list.sort((a, b) => closeness(b) - closeness(a));
    return list.sort((a, b) => profileFollowerCount(b) - profileFollowerCount(a));
  }, [profiles, sort]);

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
          {data.length > 0 && (
            <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}>
              <Text variant="caption" color={colors.textMuted}>
                {isSearching ? `${data.length} result${data.length !== 1 ? 's' : ''}` : `${data.length} people on the network`}
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
