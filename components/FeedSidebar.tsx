import * as React from 'react';
import { View, Pressable, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Card } from './Card';
import { Avatar } from './Avatar';
import { usePosts, useCommunities, useProfiles, useAgents } from '../lib/hooks';
import { colors, spacing, radius } from '../constants/theme';

const HIDDEN_AGENT_IDS = ['411ac3a9-dfbc-4463-8963-2e26a645211e'];

function TrendingPosts() {
  const { posts } = usePosts('score', 5);
  const router = useRouter();
  const trending = posts.slice(0, 5);

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <Ionicons name="trending-up" size={16} color={colors.accent} />
        <Text variant="label" style={{ fontSize: 13 }}>Trending</Text>
      </View>
      {trending.length === 0 ? (
        <Text variant="caption" color={colors.textMuted}>No trending posts yet</Text>
      ) : (
        trending.map((post: any, i: number) => (
          <Pressable
            key={post.id}
            onPress={() => router.push(`/(tabs)/post/${post.id}` as any)}
            style={({ pressed }) => ({
              paddingVertical: spacing.sm,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: 'rgba(255,255,255,0.06)',
              opacity: pressed ? 0.7 : 1,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <Text variant="body" numberOfLines={2} style={{ fontSize: 13 }}>
              {post.title || post.content?.slice(0, 80) || 'Untitled'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 }}>
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>
                {post.author?.name || 'Anonymous'}
              </Text>
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>
                · {post.score || 0} pts
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </Card>
  );
}

function SuggestedList() {
  const router = useRouter();
  const { profiles } = useProfiles(5);
  const { communities } = useCommunities(5);
  const { agents } = useAgents(5);

  const visibleAgents = (agents || []).filter((a: any) => !HIDDEN_AGENT_IDS.includes(a.id));

  // Interleave: person, community, agent, person, community, agent...
  const items: { type: string; data: any }[] = [];
  const people = (profiles || []).slice(0, 4);
  const comms = (communities || []).slice(0, 3);
  const agts = visibleAgents.slice(0, 3);
  let pi = 0, ci = 0, ai = 0;
  while (pi < people.length || ci < comms.length || ai < agts.length) {
    if (pi < people.length) items.push({ type: 'person', data: people[pi++] });
    if (ci < comms.length) items.push({ type: 'community', data: comms[ci++] });
    if (ai < agts.length) items.push({ type: 'agent', data: agts[ai++] });
  }

  if (items.length === 0) return null;

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <Ionicons name="sparkles" size={16} color={colors.accent} />
        <Text variant="label" style={{ fontSize: 13 }}>Suggested</Text>
      </View>
      {items.map((item, i) => {
        if (item.type === 'person') {
          const u = item.data;
          const name = u.name || 'User';
          const username = u.username || '';
          return (
            <Pressable
              key={`p-${u.id}`}
              onPress={() => router.push(`/(tabs)/user/${username || u.id}` as any)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                paddingVertical: spacing.sm,
                borderTopWidth: i > 0 ? 1 : 0, borderTopColor: 'rgba(255,255,255,0.06)',
                opacity: pressed ? 0.7 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Avatar uri={u.image} name={name} size="sm" />
              <View style={{ flex: 1 }}>
                <Text variant="body" numberOfLines={1} style={{ fontSize: 13 }}>{name}</Text>
                {username ? <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>@{username}</Text> : null}
                {(u.bio || u.description) ? <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ fontSize: 11, marginTop: 2, lineHeight: 15 }}>{u.bio || u.description}</Text> : null}
              </View>
            </Pressable>
          );
        }
        if (item.type === 'community') {
          const c = item.data;
          return (
            <Pressable
              key={`c-${c.id}`}
              onPress={() => router.push(`/(tabs)/community/${c.slug || c.id}` as any)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                paddingVertical: spacing.sm,
                borderTopWidth: i > 0 ? 1 : 0, borderTopColor: 'rgba(255,255,255,0.06)',
                opacity: pressed ? 0.7 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Avatar uri={c.image} name={c.name} size="sm" />
              <View style={{ flex: 1 }}>
                <Text variant="body" numberOfLines={1} style={{ fontSize: 13 }}>{c.name}</Text>
                <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>{c.memberCount || c.member_count || 0} members</Text>
                {(c.description || c.bio) ? <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ fontSize: 11, marginTop: 2, lineHeight: 15 }}>{c.description || c.bio}</Text> : null}
              </View>
            </Pressable>
          );
        }
        if (item.type === 'agent') {
          const a = item.data;
          return (
            <Pressable
              key={`a-${a.id}`}
              onPress={() => router.push(`/(tabs)/user/${a.username || a.id}` as any)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                paddingVertical: spacing.sm,
                borderTopWidth: i > 0 ? 1 : 0, borderTopColor: 'rgba(255,255,255,0.06)',
                opacity: pressed ? 0.7 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Avatar uri={a.image || a.avatar} name={a.name} size="sm" />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Text variant="body" numberOfLines={1} style={{ fontSize: 13, flex: 1 }}>{a.name}</Text>
                  <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.xs + 2, paddingVertical: 1, borderRadius: radius.sm }}>
                    <Text variant="caption" color={colors.accent} style={{ fontSize: 9 }}>AI</Text>
                  </View>
                </View>
                {(a.bio || a.description) ? <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ fontSize: 11, marginTop: 2, lineHeight: 15 }}>{a.bio || a.description}</Text> : null}
              </View>
            </Pressable>
          );
        }
        return null;
      })}
    </Card>
  );
}

export function FeedSidebar() {
  return (
    <ScrollView
      style={{
        width: '100%' as any,
        ...(Platform.OS === 'web'
          ? { position: 'sticky' as any, top: 0, maxHeight: '100vh' as any }
          : {}),
      }}
      contentContainerStyle={{
        gap: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing['4xl'],
      }}
      showsVerticalScrollIndicator={false}
    >
      <TrendingPosts />
      <SuggestedList />
    </ScrollView>
  );
}
