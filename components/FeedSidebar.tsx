import type * as React from 'react';
import { View, Pressable, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Card } from './Card';
import { Avatar } from './Avatar';
import { usePosts, useCommunities, useProfiles, useAgents } from '../lib/hooks';
import { profileFollowerCount, postScore } from '../lib/models';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';

// Activity score for a community: members carry the most signal, post count is
// the liveliness multiplier. Pure client sort over the loaded list.
function communityActivity(c: any): number {
  const members = c.memberCount || c.member_count || 0;
  const posts = c.postCount || c.post_count || 0;
  return members + posts * 2;
}

const HIDDEN_AGENT_IDS = ['411ac3a9-dfbc-4463-8963-2e26a645211e'];

function SidebarSection({ title, icon, children, onSeeAll }: {
  title: string;
  icon: string;
  children: React.ReactNode;
  onSeeAll?: () => void;
}) {
  const colors = useColors();
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
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }: any) => ({
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingVertical: spacing.sm,
        marginHorizontal: -spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.sm,
        backgroundColor: hovered ? colors.glass : 'transparent',
        opacity: pressed ? 0.7 : 1,
        ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color 0.15s ease' } as any : {}),
      })}
    >
      <Avatar uri={avatar} name={name} size="sm" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text variant="body" numberOfLines={1} style={{ fontSize: 13, flex: 1 }}>{name}</Text>
          {badge && (
            <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.xs + 2, paddingVertical: 1, borderRadius: radius.sm }}>
              <Text variant="caption" color={colors.accent} style={{ fontSize: 9 }}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle && <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>{subtitle}</Text>}
        {description && <Text variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ fontSize: 11, marginTop: 1, lineHeight: 15 }}>{description}</Text>}
      </View>
    </Pressable>
  );
}

export function FeedSidebar() {
  const router = useRouter();
  const colors = useColors();
  // Fetch a real pool (not 5) for each list so the client-side ranking has
  // something to choose from — fetching only 5 means "trending" was just the
  // server's default order. usePosts('score') is already score-ranked; we
  // explicitly rank people by followers and communities by activity below, then
  // take the top 5. (Agents have no engagement signal in the payload yet — see
  // the note in the discover PR; left in native discoverable order for now.)
  const { posts } = usePosts('score', 20);
  const { profiles } = useProfiles(30);
  const { communities } = useCommunities(30);
  const { agents } = useAgents(20);

  const trending = [...(posts || [])]
    .sort((a: any, b: any) => postScore(b) - postScore(a))
    .slice(0, 5);
  const topPeople = [...(profiles || [])]
    .sort((a: any, b: any) => profileFollowerCount(b) - profileFollowerCount(a))
    .slice(0, 5);
  const topCommunities = [...(communities || [])]
    .sort((a: any, b: any) => communityActivity(b) - communityActivity(a))
    .slice(0, 5);
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
        paddingBottom: spacing['4xl'],
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Search — opens the global Cmd+K command palette. Sits at the top of
         the right rail like X, so discovery lives with the trends column. */}
      {Platform.OS === 'web' && (
        <Pressable
          onPress={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
            }
          }}
          style={({ pressed, hovered }: any) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.sm + 2,
            paddingHorizontal: spacing.md,
            borderRadius: radius.full,
            backgroundColor: pressed || hovered ? colors.surfaceHover : colors.surface,
            borderWidth: 0.5,
            borderColor: colors.borderSubtle,
            ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color 0.15s ease' } as any : {}),
          })}
        >
          <Ionicons name="search" size={15} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted} style={{ flex: 1 }}>Search anywhere</Text>
          <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.xs, borderWidth: 0.5, borderColor: colors.borderSubtle }}>
            <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>⌘K</Text>
          </View>
        </Pressable>
      )}

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
              style={({ pressed, hovered }: any) => ({
                paddingVertical: spacing.sm,
                marginHorizontal: -spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.sm,
                backgroundColor: hovered ? colors.glass : 'transparent',
                opacity: pressed ? 0.7 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color 0.15s ease' } as any : {}),
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

      {/* Trending People — ranked by follower count */}
      {topPeople.length > 0 && (
        <SidebarSection
          title="Trending People"
          icon="person-outline"
          onSeeAll={() => router.push({ pathname: '/(tabs)/explore', params: { tab: 'people' } } as any)}
        >
          {topPeople.map((u: any) => {
            const followers = profileFollowerCount(u);
            return (
              <SidebarItem
                key={u.id}
                avatar={u.image}
                name={u.name || 'User'}
                subtitle={followers > 0
                  ? `${followers.toLocaleString()} followers`
                  : (u.username ? `@${u.username}` : undefined)}
                description={u.bio || u.description}
                onPress={() => router.push(`/(tabs)/user/${u.username || u.id}` as any)}
              />
            );
          })}
        </SidebarSection>
      )}

      {/* Trending Communities — ranked by members + activity */}
      {topCommunities.length > 0 && (
        <SidebarSection
          title="Trending Communities"
          icon="people-outline"
          onSeeAll={() => router.push({ pathname: '/(tabs)/explore', params: { tab: 'communities' } } as any)}
        >
          {topCommunities.map((c: any) => (
            <SidebarItem
              key={c.id}
              avatar={c.image}
              name={c.name || 'Community'}
              subtitle={`${(c.memberCount || c.member_count || 0).toLocaleString()} members`}
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
