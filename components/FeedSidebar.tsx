import * as React from 'react';
import { View, Pressable, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Card } from './Card';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { useProfiles, usePosts, useCommunities, useAgents } from '../lib/hooks';
import { colors, spacing, radius } from '../constants/theme';

// ─── Wallet Summary ─────────────────────────────────────────
function WalletSummary() {
  const router = useRouter();
  return (
    <Card>
      <Pressable
        onPress={() => router.push('/(tabs)/wallet')}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
          ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="diamond" size={20} color={colors.token} />
            <Text variant="bodyMedium" style={{ fontSize: 14 }}>Wallet</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
        <Text variant="h1" color={colors.token} style={{ marginTop: spacing.md }}>
          0 MINDS
        </Text>
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
          Post and engage to earn tokens
        </Text>
      </Pressable>
    </Card>
  );
}

// ─── Boosted Content ────────────────────────────────────────
function BoostedContent() {
  const router = useRouter();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="rocket" size={16} color={colors.boost} />
          <Text variant="bodyMedium" style={{ fontSize: 14 }}>Boosted</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/boost')}>
          <Text variant="label" color={colors.accent} style={{ fontSize: 12 }}>Boost yours</Text>
        </Pressable>
      </View>
      <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
        <Text variant="caption" color={colors.textMuted}>No boosted content yet</Text>
      </View>
    </Card>
  );
}

// ─── Trending Posts ──────────────────────────────────────────
function TrendingPosts() {
  const { posts } = usePosts('score', 5);
  const router = useRouter();
  const trending = posts.slice(0, 5);

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="trending-up" size={16} color={colors.accent} />
          <Text variant="bodyMedium" style={{ fontSize: 14 }}>Trending</Text>
        </View>
      </View>
      {trending.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
          <Text variant="caption" color={colors.textMuted}>No trending posts yet</Text>
        </View>
      ) : (
        trending.map((post: any, i: number) => (
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
        ))
      )}
    </Card>
  );
}

// ─── Trending Communities ────────────────────────────────────
function TrendingCommunities() {
  const { communities } = useCommunities(5);
  const router = useRouter();

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="people" size={16} color={colors.accent} />
          <Text variant="bodyMedium" style={{ fontSize: 14 }}>Communities</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/explore')}>
          <Text variant="label" color={colors.accent} style={{ fontSize: 12 }}>See all</Text>
        </Pressable>
      </View>
      {communities.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
          <Text variant="caption" color={colors.textMuted}>No communities yet</Text>
        </View>
      ) : (
        communities.slice(0, 5).map((c: any, i: number) => (
          <Pressable
            key={c.id}
            onPress={() => router.push(`/(tabs)/community/${c.id}` as any)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.sm,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: colors.borderSubtle,
              opacity: pressed ? 0.7 : 1,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <Avatar uri={c.image} name={c.name} size="sm" />
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" numberOfLines={1} style={{ fontSize: 13 }}>{c.name}</Text>
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>
                {c.memberCount || 0} members
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </Card>
  );
}

// ─── Trending Agents ─────────────────────────────────────────
function TrendingAgents() {
  const { agents } = useAgents(5);
  const router = useRouter();

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="flash" size={16} color={colors.accent} />
          <Text variant="bodyMedium" style={{ fontSize: 14 }}>Agents</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/explore')}>
          <Text variant="label" color={colors.accent} style={{ fontSize: 12 }}>See all</Text>
        </Pressable>
      </View>
      {agents.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
          <Text variant="caption" color={colors.textMuted}>No agents yet</Text>
        </View>
      ) : (
        agents.slice(0, 5).map((a: any, i: number) => (
          <Pressable
            key={a.id}
            onPress={() => router.push(`/(tabs)/explore` as any)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.sm,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: colors.borderSubtle,
              opacity: pressed ? 0.7 : 1,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <Avatar uri={a.image} name={a.name} size="sm" />
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" numberOfLines={1} style={{ fontSize: 13 }}>{a.name}</Text>
              <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 11 }}>
                {a.bio?.slice(0, 40) || 'AI Agent'}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </Card>
  );
}

// ─── Trending Apps ───────────────────────────────────────────
function TrendingApps() {
  const router = useRouter();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="cube" size={16} color={colors.accent} />
          <Text variant="bodyMedium" style={{ fontSize: 14 }}>Apps</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/explore')}>
          <Text variant="label" color={colors.accent} style={{ fontSize: 12 }}>See all</Text>
        </Pressable>
      </View>
      <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
        <Text variant="caption" color={colors.textMuted}>No apps yet</Text>
        <Pressable onPress={() => router.push('/(tabs)/explore')} style={{ marginTop: spacing.sm }}>
          <Text variant="label" color={colors.accent} style={{ fontSize: 12 }}>Build one</Text>
        </Pressable>
      </View>
    </Card>
  );
}

// ─── Main Sidebar ────────────────────────────────────────────
export function FeedSidebar() {
  return (
    <ScrollView
      style={{
        width: '100%' as any,
        ...(Platform.OS === 'web'
          ? {
              position: 'sticky' as any,
              top: 0,
              maxHeight: '100vh' as any,
            }
          : {}),
      }}
      contentContainerStyle={{
        gap: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing['4xl'],
      }}
      showsVerticalScrollIndicator={false}
    >
      <WalletSummary />
      <BoostedContent />
      <TrendingPosts />
      <TrendingCommunities />
      <TrendingAgents />
      <TrendingApps />
    </ScrollView>
  );
}
