import * as React from 'react';
import { View, FlatList, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Avatar, Skeleton } from '../../components';
import { Container } from '../../components/Container';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useCommunities } from '../../lib/hooks';
import { spacing, radius } from '../../constants/theme';
import { useColors } from '../../lib/theme';

// Dedicated "your communities" list — the communities equivalent of the full
// chat page. The sidebar "See all" links here (NOT Discover, which is every
// community on the network). Shows only the communities you've JOINED.
export default function CommunitiesScreen() {
  const router = useRouter();
  const colors = useColors();
  const { communities, loading, fetchedOnce } = useCommunities(100);

  // Gate on fetchedOnce so a stale cached is_member=true can't flash a community
  // you've left (mirrors the sidebar's guard).
  const mine = (fetchedOnce ? (communities || []) : [])
    .filter((c: any) => c.is_member === true || c.isMember === true);

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
          {(item.member_count || item.memberCount || 0)} members
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title="Communities" />

      {loading && mine.length === 0 ? (
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
      ) : (
        <FlatList
          data={mine}
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
    </Container>
  );
}
