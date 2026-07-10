import * as React from 'react';
import { View, FlatList, Pressable, Platform, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Avatar, Skeleton, RightRailLayout } from '../../components';
import { Container } from '../../components/Container';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useCommunities } from '../../lib/hooks';
import { formatCount } from '../../lib/discover';
import { spacing, radius } from '../../constants/theme';
import { useColors } from '../../lib/theme';

// Dedicated "your communities" list — the communities equivalent of the full
// chat page. The sidebar "See all" links here (NOT Discover, which is every
// community on the network). Shows only the communities you've JOINED.
export default function CommunitiesScreen() {
  const router = useRouter();
  const colors = useColors();
  // memberOnly: the server returns exactly the caller's accepted communities.
  // At 96K network communities, "mine" can't be derived client-side anymore —
  // the caller's groups are almost never in page one of the directory.
  const { communities, loading, fetchedOnce } = useCommunities(100, { memberOnly: true });

  // Gate on fetchedOnce so a stale cached is_member=true can't flash a community
  // you've left (mirrors the sidebar's guard). is_member filter kept as belt —
  // server rows are already all-mine.
  const mine = (fetchedOnce ? (communities || []) : [])
    .filter((c: any) => c.is_member === true || c.isMember === true);

  // Client-side search over the caller's joined communities (the list is small
  // enough — the server returns exactly "mine", capped at 100).
  const [query, setQuery] = React.useState('');
  const q = query.trim().toLowerCase();
  const filtered = q
    ? mine.filter((c: any) => (c.name || '').toLowerCase().includes(q))
    : mine;

  const renderRow = ({ item }: { item: any }) => (
    <Pressable
      onPress={() => router.push(`/(tabs)/community/${item.slug || item.id}` as any)}
      style={({ hovered, pressed }: any) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        backgroundColor: hovered || pressed ? colors.glass : 'transparent',
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      })}
    >
      <Avatar uri={item.image || item.avatar} name={item.name} size="lg" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyMedium" numberOfLines={1}>{item.name || 'Community'}</Text>
        <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
          {formatCount(item.member_count || item.memberCount || 0)} members
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );

  // "+ New Community" header button — matches the discover/communities directory
  // button styling (accent pill, caption + add icon). Routes into the create flow.
  const newCommunityButton = (
    <Pressable
      onPress={() => router.push('/(tabs)/create?mode=community' as any)}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingLeft: spacing.md, paddingRight: spacing.md, paddingVertical: 7,
        borderRadius: radius.full, backgroundColor: colors.accent,
        opacity: pressed ? 0.85 : 1,
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      })}
    >
      <Ionicons name="add" size={16} color={colors.textOnAccent} />
      <Text variant="caption" color={colors.textOnAccent} style={{ fontFamily: 'Roboto-Medium' }}>New Community</Text>
    </Pressable>
  );

  const searchBar = mine.length > 0 && (
    <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xs }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.glass, borderRadius: radius.full,
        paddingHorizontal: spacing.md, paddingVertical: 9,
        borderWidth: 0.5, borderColor: colors.glassBorder,
      }}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search your communities"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          returnKeyType="search"
          style={{ flex: 1, color: colors.text, paddingVertical: 0, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8} style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : undefined}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <Container safeTop padded={false}>
      <RightRailLayout context="communities">
      <ScreenHeader title="Communities" right={newCommunityButton} />

      {searchBar}

      {/* Show the skeleton until the FIRST fetch actually resolves (fetchedOnce),
         not just while `loading` — otherwise the empty state flashes for a frame
         before the joined list arrives. */}
      {(!fetchedOnce || loading) && mine.length === 0 ? (
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
              <Skeleton width={48} height={48} borderRadius={24} />
              <View style={{ flex: 1, gap: spacing.sm }}>
                <Skeleton width={160} height={15} />
                <Skeleton width={90} height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : mine.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl }}>
          <Ionicons name="people-outline" size={40} color={colors.accent} />
          <Text variant="h3" color={colors.text}>No communities yet</Text>
          <Text variant="body" color={colors.textSecondary} style={{ maxWidth: 320, textAlign: 'center' }}>
            Communities you join show up here. Find ones to join in Discover.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/discover/communities' as any)}
            style={({ hovered }: any) => ({
              flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
              backgroundColor: hovered ? colors.accentHover : colors.accent,
              paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.full,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <Ionicons name="search" size={16} color={colors.bg} />
            <Text variant="bodyMedium" color={colors.bg}>Discover communities</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing['3xl'], paddingHorizontal: spacing.xl }}>
          <Ionicons name="search" size={28} color={colors.textMuted} />
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
            No communities match “{query}”.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          contentContainerStyle={{ paddingVertical: spacing.sm }}
          ListFooterComponent={
            <Pressable
              onPress={() => router.push('/(tabs)/discover/communities' as any)}
              style={({ hovered }: any) => ({
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Ionicons name="search" size={16} color={colors.accent} />
              <Text variant="bodyMedium" color={colors.accent}>Discover more communities</Text>
            </Pressable>
          }
        />
      )}
      </RightRailLayout>
    </Container>
  );
}
