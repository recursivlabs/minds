import { Redirect, useLocalSearchParams } from 'expo-router';

// ──────────────────────────────────────────────────────────────────────────
// Discover defaults to Posts. "For You" lives on the main Feed now — Discover
// is a pure search/directory console. The bare /discover route just forwards
// to the Posts tab, carrying any deep-link query (?q / ?sort / ?range / ?tag).
// ──────────────────────────────────────────────────────────────────────────
export default function DiscoverIndex() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: '/(tabs)/discover/posts', params } as any} />;
}
