import * as React from 'react';
import { View, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Card } from './Card';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { useProfiles, usePosts } from '../lib/hooks';
import { colors, spacing, radius } from '../constants/theme';

// ─── Quick Nav ───────────────────────────────────────────────
function QuickNav({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();

  const links: { label: string; icon: keyof typeof Ionicons.glyphMap; route: string; adminOnly?: boolean }[] = [
    { label: 'My Communities', icon: 'people-outline', route: '/(tabs)/explore' },
    { label: 'Trending', icon: 'trending-up-outline', route: '/(tabs)/explore' },
    { label: 'Wallet', icon: 'diamond-outline', route: '/(tabs)/wallet' },
    { label: 'Boost Dashboard', icon: 'rocket-outline', route: '/(tabs)/boost' },
    { label: 'Admin', icon: 'shield-outline', route: '/(tabs)/admin', adminOnly: true },
  ];

  return (
    <Card>
      <Text variant="h3" style={{ marginBottom: spacing.md }}>Quick Nav</Text>
      {links
        .filter((l) => !l.adminOnly || isAdmin)
        .map((link) => (
          <Pressable
            key={link.label}
            onPress={() => router.push(link.route as any)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.sm + 2,
              opacity: pressed ? 0.7 : 1,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <Ionicons name={link.icon} size={18} color={colors.textSecondary} />
            <Text variant="body" color={colors.textSecondary}>{link.label}</Text>
          </Pressable>
        ))}
    </Card>
  );
}

// ─── Trending Now ────────────────────────────────────────────
function TrendingNow() {
  const { posts } = usePosts('score', 5);
  const router = useRouter();

  const trending = posts.slice(0, 5);

  if (trending.length === 0) {
    return (
      <Card>
        <Text variant="h3" style={{ marginBottom: spacing.md }}>Trending Now</Text>
        <View style={{ alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm }}>
          <Ionicons name="trending-up-outline" size={24} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted}>No trending posts yet</Text>
          <Pressable onPress={() => router.push('/(tabs)/create')}>
            <Text variant="label" color={colors.accent} style={{ fontSize: 12 }}>Create a post</Text>
          </Pressable>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <Text variant="h3" style={{ marginBottom: spacing.md }}>Trending Now</Text>
      {trending.map((post: any, i: number) => (
        <Pressable
          key={post.id}
          onPress={() => router.push(`/(tabs)/post/${post.id}` as any)}
          style={({ pressed }) => ({
            paddingVertical: spacing.sm,
            borderTopWidth: i > 0 ? 1 : 0,
            borderTopColor: colors.borderSubtle,
            opacity: pressed ? 0.7 : 1,
            ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
          })}
        >
          <Text variant="bodyMedium" numberOfLines={1} style={{ fontSize: 13 }}>
            {post.title || post.content?.slice(0, 60) || 'Untitled'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 }}>
            <Text variant="caption" color={colors.textMuted} style={{ fontSize: 12 }}>
              {post.author?.name || post.author?.username || 'Unknown'}
            </Text>
            <Text variant="caption" color={colors.accent} style={{ fontSize: 12 }}>
              {post.score || 0} pts
            </Text>
          </View>
        </Pressable>
      ))}
    </Card>
  );
}

// ─── Suggested People ────────────────────────────────────────
function SuggestedPeople() {
  const { profiles } = useProfiles(6);
  const router = useRouter();

  if (profiles.length === 0) {
    return (
      <Card>
        <Text variant="h3" style={{ marginBottom: spacing.md }}>Suggested People</Text>
        <View style={{ alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm }}>
          <Ionicons name="person-add-outline" size={24} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted}>No suggestions yet</Text>
          <Pressable onPress={() => router.push('/(tabs)/explore')}>
            <Text variant="label" color={colors.accent} style={{ fontSize: 12 }}>Invite friends to Minds</Text>
          </Pressable>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <Text variant="h3" style={{ marginBottom: spacing.md }}>Suggested People</Text>
      {profiles.slice(0, 3).map((profile: any) => (
        <Pressable
          key={profile.id}
          onPress={() => router.push(`/user/${profile.username}` as any)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingVertical: spacing.sm,
            opacity: pressed ? 0.7 : 1,
            ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
          })}
        >
          <Avatar
            uri={profile.image || profile.avatar}
            name={profile.name || profile.username}
            size="sm"
          />
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium" numberOfLines={1} style={{ fontSize: 13 }}>
              {profile.name || profile.username || 'User'}
            </Text>
            <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 12 }}>
              @{profile.username || 'user'}
            </Text>
          </View>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={({ pressed }) => ({
              paddingVertical: 4,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              backgroundColor: pressed ? colors.accentHover : colors.accent,
            })}
          >
            <Text variant="label" color={colors.textInverse} style={{ fontSize: 11 }}>
              Follow
            </Text>
          </Pressable>
        </Pressable>
      ))}
    </Card>
  );
}

// ─── Active Boosts ───────────────────────────────────────────
function ActiveBoosts() {
  const router = useRouter();
  return (
    <Card>
      <Text variant="h3" style={{ marginBottom: spacing.md }}>Active Boosts</Text>
      <View style={{ alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm }}>
        <Ionicons name="rocket-outline" size={24} color={colors.textMuted} />
        <Text variant="caption" color={colors.textMuted}>
          No active boosts
        </Text>
        <Pressable onPress={() => router.push('/(tabs)/boost')}>
          <Text variant="label" color={colors.accent} style={{ fontSize: 12 }}>Boost your content</Text>
        </Pressable>
      </View>
    </Card>
  );
}

// ─── Main Sidebar ────────────────────────────────────────────
export function FeedSidebar() {
  // Simple admin check — in production, check role from org membership
  const isAdmin = true;

  return (
    <View
      style={{
        width: '100%' as any,
        gap: spacing.lg,
        ...(Platform.OS === 'web'
          ? {
              position: 'sticky' as any,
              top: 0,
              maxHeight: '100vh' as any,
              overflowY: 'auto' as any,
              paddingTop: spacing.lg,
              paddingBottom: spacing['4xl'],
            }
          : {}),
      }}
    >
      <QuickNav isAdmin={isAdmin} />
      <TrendingNow />
      <SuggestedPeople />
      <ActiveBoosts />
    </View>
  );
}
