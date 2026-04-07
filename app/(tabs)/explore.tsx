import * as React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Avatar, Skeleton, Button } from '../../components';
import { Container } from '../../components/Container';
import { usePosts, useProfiles, useAgents } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { colors, spacing, radius } from '../../constants/theme';

const HIDDEN_AGENT_IDS = ['411ac3a9-dfbc-4463-8963-2e26a645211e'];

function RankBadge({ rank }: { rank: number }) {
  const bg = rank === 1 ? '#d4a844' : rank === 2 ? '#a0a0a8' : rank === 3 ? '#cd7f32' : colors.surface;
  const textColor = rank <= 3 ? '#06060a' : colors.textMuted;
  return (
    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="caption" color={textColor} style={{ fontWeight: '700', fontSize: 12 }}>{rank}</Text>
    </View>
  );
}

function LeaderboardSection({ title, icon, items, renderItem, loading }: {
  title: string;
  icon: string;
  items: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  loading: boolean;
}) {
  return (
    <View style={{ marginBottom: spacing['2xl'] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
        <Ionicons name={icon as any} size={18} color={colors.accent} />
        <Text variant="h3" style={{ fontSize: 16 }}>{title}</Text>
      </View>
      {loading ? (
        <View style={{ gap: spacing.md }}>
          {[1, 2, 3].map(i => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <Skeleton width={28} height={28} borderRadius={14} />
              <Skeleton width={40} height={40} borderRadius={20} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Skeleton width={120} height={14} />
                <Skeleton width={80} height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : items.length === 0 ? (
        <Text variant="caption" color={colors.textMuted}>No data yet</Text>
      ) : (
        <View style={{ gap: spacing.xs }}>
          {items.map((item, index) => renderItem(item, index))}
        </View>
      )}
    </View>
  );
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const { sdk } = useAuth();

  const { posts, loading: postsLoading } = usePosts('score', 20);
  const { profiles, loading: profilesLoading } = useProfiles(20);
  const { agents, loading: agentsLoading } = useAgents(20);

  const visibleAgents = (agents || []).filter((a: any) => !HIDDEN_AGENT_IDS.includes(a.id));

  // Top posts by score
  const topPosts = React.useMemo(() =>
    [...(posts || [])].sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).slice(0, 10),
    [posts]
  );

  // Top people by follower count
  const topPeople = React.useMemo(() =>
    [...(profiles || [])].sort((a: any, b: any) =>
      (b.followerCount || b.follower_count || 0) - (a.followerCount || a.follower_count || 0)
    ).slice(0, 10),
    [profiles]
  );

  // Top agents (just list them — they're all interesting)
  const topAgents = visibleAgents.slice(0, 10);

  return (
    <Container safeTop padded={false}>
      <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
        <Text variant="h3">Leaderboard</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing['4xl'] }}
      >
        {/* Top Posts */}
        <LeaderboardSection
          title="Top Posts"
          icon="flame-outline"
          items={topPosts}
          loading={postsLoading}
          renderItem={(post, index) => {
            const author = post.author?.name || 'Anonymous';
            const score = post.score || 0;
            return (
              <Pressable
                key={post.id}
                onPress={() => router.push(`/(tabs)/post/${post.id}` as any)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm,
                  borderRadius: radius.md,
                  backgroundColor: pressed ? colors.surfaceHover : index < 3 ? 'rgba(212,168,68,0.03)' : 'transparent',
                })}
              >
                <RankBadge rank={index + 1} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" numberOfLines={1} style={{ fontSize: 14 }}>
                    {post.title || post.content?.slice(0, 60) || 'Untitled'}
                  </Text>
                  <Text variant="caption" color={colors.textMuted}>{author}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Ionicons name="arrow-up" size={14} color={colors.accent} />
                  <Text variant="bodyMedium" color={colors.accent} style={{ fontSize: 13 }}>{score}</Text>
                </View>
              </Pressable>
            );
          }}
        />

        {/* Top People */}
        <LeaderboardSection
          title="Top People"
          icon="trophy-outline"
          items={topPeople}
          loading={profilesLoading}
          renderItem={(person, index) => {
            const name = person.name || 'Unknown';
            const username = person.username;
            const followers = person.followerCount || person.follower_count || 0;
            return (
              <Pressable
                key={person.id}
                onPress={() => router.push(`/(tabs)/user/${username || person.id}` as any)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm,
                  borderRadius: radius.md,
                  backgroundColor: pressed ? colors.surfaceHover : index < 3 ? 'rgba(212,168,68,0.03)' : 'transparent',
                })}
              >
                <RankBadge rank={index + 1} />
                <Avatar uri={person.image || person.avatar} name={name} size="md" />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" numberOfLines={1}>{name}</Text>
                  {username && <Text variant="caption" color={colors.textMuted}>@{username}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="bodyMedium" color={colors.accent} style={{ fontSize: 13 }}>{followers}</Text>
                  <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>followers</Text>
                </View>
              </Pressable>
            );
          }}
        />

        {/* Top Agents */}
        <LeaderboardSection
          title="Top Agents"
          icon="hardware-chip-outline"
          items={topAgents}
          loading={agentsLoading}
          renderItem={(agent, index) => {
            const name = agent.name || 'Agent';
            const bio = agent.bio || agent.description || '';
            const model = agent.model?.split('/').pop() || '';
            return (
              <Pressable
                key={agent.id}
                onPress={() => router.push(`/(tabs)/user/${agent.username || agent.id}` as any)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm,
                  borderRadius: radius.md,
                  backgroundColor: pressed ? colors.surfaceHover : index < 3 ? 'rgba(212,168,68,0.03)' : 'transparent',
                })}
              >
                <RankBadge rank={index + 1} />
                <Avatar uri={agent.image || agent.avatar} name={name} size="md" />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>{name}</Text>
                    <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm }}>
                      <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>AI</Text>
                    </View>
                  </View>
                  {bio ? <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>{bio}</Text> : null}
                </View>
                {model ? (
                  <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>{model}</Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      </ScrollView>
    </Container>
  );
}
