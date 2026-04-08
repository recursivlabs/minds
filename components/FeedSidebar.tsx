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

function SidebarSection({ title, icon, children, onSeeAll }: {
  title: string;
  icon: string;
  children: React.ReactNode;
  onSeeAll?: () => void;
}) {
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name={icon as any} size={15} color={colors.accent} />
          <Text variant="label" style={{ fontSize: 13 }}>{title}</Text>
        </View>
        {onSeeAll && (
          <Pressable onPress={onSeeAll} hitSlop={8}>
            <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>See all</Text>
          </Pressable>
        )}
      </View>
      {children}
    </Card>
  );
}

function SidebarItem({ avatar, name, subtitle, description, onPress, badge }: {
  avatar?: string | null;
  name: string;
  subtitle?: string;
  description?: string;
  onPress: () => void;
  badge?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingVertical: spacing.sm,
        opacity: pressed ? 0.7 : 1,
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      })}
    >
      <Avatar uri={avatar} name={name} size="sm" />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text variant="body" numberOfLines={1} style={{ fontSize: 13, flex: 1 }}>{name}</Text>
          {badge && (
            <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.xs + 2, paddingVertical: 1, borderRadius: radius.sm }}>
              <Text variant="caption" color={colors.accent} style={{ fontSize: 9 }}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle && <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>{subtitle}</Text>}
        {description && <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ fontSize: 11, marginTop: 1, lineHeight: 15 }}>{description}</Text>}
      </View>
    </Pressable>
  );
}

export function FeedSidebar() {
  const router = useRouter();
  const { posts } = usePosts('score', 5);
  const { profiles } = useProfiles(5);
  const { communities } = useCommunities(5);
  const { agents } = useAgents(5);

  const trending = posts.slice(0, 5);
  const visibleAgents = (agents || []).filter((a: any) => !HIDDEN_AGENT_IDS.includes(a.id)).slice(0, 5);

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
      {/* Trending Posts */}
      <SidebarSection
        title="Trending Posts"
        icon="flame-outline"
        onSeeAll={() => router.push({ pathname: '/(tabs)/explore', params: { tab: 'posts' } } as any)}
      >
        {trending.length === 0 ? (
          <Text variant="caption" color={colors.textMuted}>No trending posts yet</Text>
        ) : (
          trending.map((post: any) => (
            <Pressable
              key={post.id}
              onPress={() => router.push(`/(tabs)/post/${post.id}` as any)}
              style={({ pressed }) => ({
                paddingVertical: spacing.sm,
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
      </SidebarSection>

      {/* Trending People */}
      {(profiles || []).length > 0 && (
        <SidebarSection
          title="Trending People"
          icon="person-outline"
          onSeeAll={() => router.push({ pathname: '/(tabs)/explore', params: { tab: 'people' } } as any)}
        >
          {(profiles || []).slice(0, 5).map((u: any) => (
            <SidebarItem
              key={u.id}
              avatar={u.image}
              name={u.name || 'User'}
              subtitle={u.username ? `@${u.username}` : undefined}
              description={u.bio || u.description}
              onPress={() => router.push(`/(tabs)/user/${u.username || u.id}` as any)}
            />
          ))}
        </SidebarSection>
      )}

      {/* Trending Communities */}
      {(communities || []).length > 0 && (
        <SidebarSection
          title="Trending Communities"
          icon="people-outline"
          onSeeAll={() => router.push({ pathname: '/(tabs)/explore', params: { tab: 'communities' } } as any)}
        >
          {(communities || []).slice(0, 5).map((c: any) => (
            <SidebarItem
              key={c.id}
              avatar={c.image}
              name={c.name || 'Community'}
              subtitle={`${c.memberCount || c.member_count || 0} members`}
              description={c.description || c.bio}
              onPress={() => router.push(`/(tabs)/community/${c.slug || c.id}` as any)}
            />
          ))}
        </SidebarSection>
      )}

      {/* Trending Agents */}
      {visibleAgents.length > 0 && (
        <SidebarSection
          title="Trending Agents"
          icon="hardware-chip-outline"
          onSeeAll={() => router.push({ pathname: '/(tabs)/explore', params: { tab: 'agents' } } as any)}
        >
          {visibleAgents.map((a: any) => (
            <SidebarItem
              key={a.id}
              avatar={a.image || a.avatar}
              name={a.name || 'Agent'}
              description={a.bio || a.description}
              badge="AI"
              onPress={() => router.push(`/(tabs)/user/${a.username || a.id}` as any)}
            />
          ))}
        </SidebarSection>
      )}
    </ScrollView>
  );
}
