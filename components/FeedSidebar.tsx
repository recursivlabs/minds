import * as React from 'react';
import { View, Pressable, Platform, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Card } from './Card';
import { Avatar } from './Avatar';
import { AgentBadge } from './AgentBadge';
import { Badge, getBadges } from './Badge';
import { useAuth } from '../lib/auth';
import { ORG_ID } from '../lib/recursiv';
import { useTrendingPosts, useCommunities, useProfiles, useProfileLeaderboard, useAgents, useFollowingIds } from '../lib/hooks';
import { profileFollowerCount } from '../lib/models';
import { hotScore, cardLabel, postTitle, postThumb, dedupePosts, communityActivity, agentPopularity, computeTrendingTopics } from '../lib/discover';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';

const HIDDEN_AGENT_IDS = ['411ac3a9-dfbc-4463-8963-2e26a645211e'];

// Exclude AI agents (they have their own section) and simulator/QA/parody bot
// accounts from the human "Creators" rail — those test accounts post/engage a
// lot and used to dominate it.
function isJunkCreator(u: any): boolean {
  if (u?.is_ai || u?.isAi || u?.agent_type) return true;
  const s = `${u?.username || ''} ${u?.name || ''}`.toLowerCase();
  return /(^|[^a-z])(betabot|parody|test|qa|demo|simulator|dummy|sample|fixture|bot)([^a-z]|\d|$)/.test(s);
}

// Advances once per sidebar mount so the recommendation window rotates on
// navigation / refresh (not just on a timer). Module-scoped so it persists
// across mounts within a session.
let sidebarRotSeed = 0;

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
        {/* The whole title (icon + label) deep-links into the matching Discover
            feed — not just the "See all" affordance — so the header reads as a
            real window into discovery. */}
        <Pressable
          onPress={onSeeAll}
          disabled={!onSeeAll}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, ...(onSeeAll && Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) }}
        >
          <Ionicons name={icon as any} size={15} color={colors.accent} />
          <Text variant="label" style={{ fontSize: 13 }}>{title}</Text>
        </Pressable>
        {onSeeAll && (
          <Pressable onPress={onSeeAll} hitSlop={8} style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : undefined}>
            <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>See all</Text>
          </Pressable>
        )}
      </View>
      {children}
    </Card>
  );
}

function SidebarItem({ avatar, name, subtitle, description, onPress, badge, isAgent, action, user }: {
  avatar?: string | null;
  name: string;
  subtitle?: string;
  description?: string;
  onPress: () => void;
  badge?: string;
  // Full user row, so the item can render tier badges (Minds+/Pro/Founder).
  user?: any;
  isAgent?: boolean;
  // One-tap CTA on the right (follow a creator, join a community, message an
  // agent). `active` flips the affordance to a confirmed/done state.
  action?: { icon: string; onPress: () => void; active?: boolean; label?: string };
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
          <Text variant="body" numberOfLines={1} style={{ fontSize: 15, flexShrink: 1 }}>{name}</Text>
          {user && getBadges(user).map((b) => <Badge key={b} type={b} size="sm" />)}
          {isAgent && <AgentBadge size={13} />}
          {badge && (
            <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.xs + 2, paddingVertical: 1, borderRadius: radius.sm }}>
              <Text variant="caption" color={colors.accent} style={{ fontSize: 9 }}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle && <Text variant="caption" color={colors.textMuted} style={{ fontSize: 13 }}>{subtitle}</Text>}
        {description && <Text variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ fontSize: 13, marginTop: 1, lineHeight: 17 }}>{description}</Text>}
      </View>
      {action && (
        <Pressable
          onPress={(e: any) => { e?.stopPropagation?.(); action.onPress(); }}
          hitSlop={8}
          accessibilityLabel={action.label}
          style={({ pressed }: any) => ({
            width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
            backgroundColor: action.active ? colors.accentMuted : colors.surface,
            borderWidth: 0.5, borderColor: action.active ? colors.accent : colors.borderSubtle,
            opacity: pressed ? 0.6 : 1,
            ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
          })}
        >
          <Ionicons name={action.icon as any} size={15} color={colors.accent} />
        </Pressable>
      )}
    </Pressable>
  );
}

// Which page the rail is on — used to reorder the widgets so the most relevant
// "next step" leads. The rail shows the same 4 discovery widgets everywhere, but
// context decides which one is on top (e.g. a community page leads with more
// communities; a profile leads with more creators to follow).
export type SidebarContext = 'feed' | 'discover' | 'profile' | 'community' | 'communities' | 'wallet' | 'notifications';

export function FeedSidebar({ context = 'feed' }: { context?: SidebarContext } = {}) {
  const router = useRouter();
  const colors = useColors();
  const { sdk } = useAuth();
  // The viewer's real follow graph — so the CTA shows "following" for people you
  // already follow instead of a misleading "+".
  const { followingIds } = useFollowingIds();

  // Override maps: id -> desired state. Seeded from the real follow graph /
  // community membership; a tap writes the toggled state optimistically and
  // reverts on failure.
  const [followOverride, setFollowOverride] = React.useState<Map<string, boolean>>(new Map());
  const [joinOverride, setJoinOverride] = React.useState<Map<string, boolean>>(new Map());
  // Accepts a user row or a bare id. Priority: optimistic override → the row's
  // own server is_following flag (reliable, not subject to the 100-cap on the
  // following-list fetch) → the following-graph set as a last-resort fallback.
  const isFollowing = (u: any) => {
    const id = typeof u === 'string' ? u : u?.id;
    if (followOverride.has(id)) return !!followOverride.get(id);
    const flag = typeof u === 'object' ? (u?.is_following ?? u?.isFollowing) : undefined;
    if (flag != null) return !!flag;
    return followingIds?.has(id) ?? false;
  };
  const isJoined = (c: any) => joinOverride.has(c.id) ? !!joinOverride.get(c.id) : !!(c.is_member ?? c.isMember);
  const toggleFollow = React.useCallback((id: string, currently: boolean) => {
    if (!sdk) return;
    const next = !currently;
    setFollowOverride((p) => new Map(p).set(id, next));
    Promise.resolve(next ? sdk.profiles.follow(id) : sdk.profiles.unfollow(id))
      .catch(() => setFollowOverride((p) => new Map(p).set(id, currently)));
  }, [sdk]);
  const toggleJoin = React.useCallback((id: string, currently: boolean) => {
    if (!sdk) return;
    const next = !currently;
    setJoinOverride((p) => new Map(p).set(id, next));
    Promise.resolve(next ? (sdk as any).communities.join(id) : (sdk as any).communities.leave(id))
      .catch(() => setJoinOverride((p) => new Map(p).set(id, currently)));
  }, [sdk]);
  const message = React.useCallback(async (agentId: string) => {
    if (!sdk) return;
    try {
      const dm: any = await (sdk as any).chat.dm({ user_id: agentId, organization_id: ORG_ID || undefined });
      const convoId = dm?.data?.id;
      if (convoId) router.push(`/(tabs)/chat?id=${convoId}` as any);
    } catch {}
  }, [sdk, router]);

  // The sidebar is a mini-version of the same engagement-quality system as the
  // Feed's For You and the Discover tabs — every widget reuses the SAME hook +
  // ranking the corresponding Discover tab uses, so "popular" means one thing
  // everywhere. We fetch a real pool (not 5) so the client-side ranking has
  // something to choose from, then take the top 5.

  // Posts → useTrendingPosts: fetches the Hot path (recency-aware engagement)
  // with a guaranteed fallback to the all-time Top list when Hot returns empty,
  // so the rail is NEVER silently empty when posts exist (the root cause of the
  // blank widget — Hot was the sole source). We still re-rank by the
  // time-decayed hotScore client-side so the order favors recent, engaged posts.
  const { posts } = useTrendingPosts(20);
  // Creators → the server-ranked FOLLOWER leaderboard (real reach, the People
  // tab's authoritative top-N), hydrated with directory identity and filtered of
  // AI/bot accounts. The old post-count sort let simulator/parody accounts win.
  const { profiles } = useProfiles(120);
  const { entries: creatorBoard } = useProfileLeaderboard(100, 'followers');
  // Communities → members + recent activity (members + posts*2): the Communities
  // tab's "Most active" sort.
  const { communities } = useCommunities(60);
  // Agents → "Popular": native featured order lifted by any usage signal.
  const { agents } = useAgents(40);

  const profileById = React.useMemo(() => {
    const m = new Map<string, any>();
    for (const p of profiles || []) if (p?.id) m.set(p.id, p);
    return m;
  }, [profiles]);

  // FRESHNESS: rotate which slice of each ranked pool is shown so the rail
  // evolves instead of showing the same five forever. Primarily driven by
  // NAVIGATION — each mount advances the shared seed, so moving between pages
  // (or a refresh) surfaces new recommendations. A slow 3-min tick is a gentle
  // fallback for someone who lingers on one page. Never shuffles under the cursor.
  const [rot, setRot] = React.useState(() => ++sidebarRotSeed);
  React.useEffect(() => {
    const id = setInterval(() => setRot((r) => r + 1), 180000);
    return () => clearInterval(id);
  }, []);
  const rotateWindow = React.useCallback(<T,>(arr: T[], size: number): T[] => {
    if (arr.length <= size) return arr.slice(0, size);
    const off = (rot * size) % arr.length;
    return [...arr.slice(off), ...arr.slice(0, off)].slice(0, size);
  }, [rot]);

  // POSTS: hot-rank, dedup, then keep AT MOST ONE post per author so a single
  // prolific poster can't fill the entire rail (the "5 posts from one account"
  // problem). Fall back to raw order if hot-ranking collapses on a legacy corpus.
  const pool = posts || [];
  // X-style "Trending" — hashtags ranked by frequency across the hot posts.
  const trendingTopics = computeTrendingTopics(pool, 8);
  const rankedPosts = dedupePosts([...pool].sort((a: any, b: any) => hotScore(b) - hotScore(a)));
  const trending: any[] = [];
  const seenAuthors = new Set<string>();
  for (const p of (rankedPosts.length >= 3 ? rankedPosts : dedupePosts([...pool]))) {
    const aid = String(p?.author?.id || p?.author?.username || p?.owner_guid || p?.ownerGuid || '');
    if (aid && seenAuthors.has(aid)) continue;
    if (aid) seenAuthors.add(aid);
    trending.push(p);
    if (trending.length >= 5) break;
  }

  // CREATORS: present the follower board's exact order (already ranked, real
  // counts), hydrated with directory bio/identity, minus AI/bot/test accounts.
  const rankedPeople = ((creatorBoard || []).length
    ? (creatorBoard || []).map((row: any) => { const p = profileById.get(row?.id); return p ? { ...p, ...row } : row; })
    : [...(profiles || [])])
    .filter((u: any) => !isJunkCreator(u))
    // The official @minds channel is the network's own account, not a creator to
    // follow — keep it out of the human Creators rail.
    .filter((u: any) => (u?.username || '').toLowerCase() !== 'minds');
  const topPeople = rotateWindow(rankedPeople, 5);
  const rankedCommunities = [...(communities || [])]
    .sort((a: any, b: any) => communityActivity(b) - communityActivity(a));
  const topCommunities = rotateWindow(rankedCommunities, 5);
  const rankedAgents = (agents || [])
    .filter((a: any) => !HIDDEN_AGENT_IDS.includes(a.id))
    .sort((a: any, b: any) => agentPopularity(b) - agentPopularity(a));
  const visibleAgents = rotateWindow(rankedAgents, 5);

  // The four discovery widgets. Rendered in a context-dependent order so the
  // most relevant "next step" leads on each page (below).
  const sections: Record<string, React.ReactNode> = {
    trending: trendingTopics.length > 0 ? (
      <SidebarSection
        title="Trending"
        icon="trending-up-outline"
        onSeeAll={() => router.push('/(tabs)/discover/posts?sort=hot' as any)}
      >
        {trendingTopics.map((t) => (
          <Pressable
            key={t.tag}
            onPress={() => router.push({ pathname: '/(tabs)/discover/posts', params: { q: `#${t.tag}` } } as any)}
            style={({ pressed, hovered }: any) => ({
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.xs,
              borderRadius: radius.sm,
              backgroundColor: pressed || hovered ? colors.surfaceHover : 'transparent',
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <Text variant="bodyMedium" color={colors.text} numberOfLines={1}>#{t.tag}</Text>
            <Text variant="caption" color={colors.textMuted}>
              {t.count.toLocaleString()} {t.count === 1 ? 'post' : 'posts'}
            </Text>
          </Pressable>
        ))}
      </SidebarSection>
    ) : null,
    posts: (
      <SidebarSection
        title="Trending Posts"
        icon="flame-outline"
        onSeeAll={() => router.push('/(tabs)/discover/posts?sort=hot' as any)}
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
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="body" numberOfLines={2} style={{ fontSize: 15, lineHeight: 20 }}>
                    {cardLabel(post, postTitle(post).slice(0, 80))}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 3 }}>
                    <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 13, flexShrink: 1 }}>
                      {post.author?.name || 'Anonymous'}
                    </Text>
                    {post.author && getBadges(post.author).map((b) => <Badge key={b} type={b} size="sm" />)}
                    <Text variant="caption" color={colors.textMuted} style={{ fontSize: 13 }}>
                      · {post.score || 0} pts
                    </Text>
                  </View>
                </View>
                {(() => {
                  const thumb = postThumb(post);
                  if (!thumb.url) return null;
                  return (
                    <View style={{ width: 44, height: 44, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface }}>
                      <Image source={{ uri: thumb.url }} style={{ width: 44, height: 44 }} contentFit="cover" transition={120} />
                      {thumb.hasVideo && (
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' }}>
                          <Ionicons name="play" size={16} color="#fff" />
                        </View>
                      )}
                    </View>
                  );
                })()}
              </View>
            </Pressable>
          ))
        )}
      </SidebarSection>
    ),
    creators: topPeople.length > 0 ? (
      <SidebarSection
        title="Trending Creators"
        icon="person-outline"
        onSeeAll={() => router.push('/(tabs)/discover/people?sort=followers' as any)}
      >
        {topPeople.map((u: any) => {
          const followers = profileFollowerCount(u);
          return (
            <SidebarItem
              key={u.id}
              user={u}
              avatar={u.image}
              name={u.name || 'User'}
              subtitle={followers > 0
                ? `${followers.toLocaleString()} ${followers === 1 ? 'follower' : 'followers'}`
                : (u.username ? `@${u.username}` : undefined)}
              description={u.bio || u.description}
              onPress={() => router.push(`/(tabs)/user/${u.username || u.id}` as any)}
              action={{ icon: isFollowing(u) ? 'checkmark' : 'add', active: isFollowing(u), label: isFollowing(u) ? 'Following' : 'Follow', onPress: () => toggleFollow(u.id, isFollowing(u)) }}
            />
          );
        })}
      </SidebarSection>
    ) : null,
    communities: topCommunities.length > 0 ? (
      <SidebarSection
        title="Trending Communities"
        icon="people-outline"
        onSeeAll={() => router.push('/(tabs)/discover/communities' as any)}
      >
        {topCommunities.map((c: any) => (
          <SidebarItem
            key={c.id}
            avatar={c.image}
            name={c.name || 'Community'}
            subtitle={`${(c.memberCount || c.member_count || 0).toLocaleString()} ${(c.memberCount || c.member_count || 0) === 1 ? 'member' : 'members'}`}
            description={c.description || c.bio}
            onPress={() => router.push(`/(tabs)/community/${c.slug || c.id}` as any)}
            action={{ icon: isJoined(c) ? 'checkmark' : 'add', active: isJoined(c), label: isJoined(c) ? 'Joined' : 'Join', onPress: () => toggleJoin(c.id, isJoined(c)) }}
          />
        ))}
      </SidebarSection>
    ) : null,
    agents: visibleAgents.length > 0 ? (
      <SidebarSection
        title="Trending Agents"
        icon="hardware-chip-outline"
        onSeeAll={() => router.push('/(tabs)/discover/agents' as any)}
      >
        {visibleAgents.map((a: any) => (
          <SidebarItem
            key={a.id}
            avatar={a.image || a.avatar}
            name={a.name || 'Agent'}
            description={a.bio || a.description}
            isAgent
            onPress={() => router.push(`/(tabs)/user/${a.username || a.id}` as any)}
            action={{ icon: 'chatbubble-outline', label: 'Message', onPress: () => message(a.id) }}
          />
        ))}
      </SidebarSection>
    ) : null,
  };

  // Contextual order — lead with the most relevant "next step" for the page.
  const ORDERS: Record<SidebarContext, string[]> = {
    feed: ['trending', 'posts', 'creators', 'communities', 'agents'],
    discover: ['trending', 'posts', 'creators', 'communities', 'agents'],
    notifications: ['trending', 'posts', 'creators', 'communities', 'agents'],
    profile: ['creators', 'communities', 'posts', 'agents'],
    community: ['communities', 'creators', 'posts', 'agents'],
    communities: ['communities', 'creators', 'agents', 'posts'],
    wallet: ['trending', 'creators', 'communities', 'agents', 'posts'],
  };
  const sectionOrder = ORDERS[context] || ORDERS.feed;

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

      {sectionOrder.map((key) => (
        <React.Fragment key={key}>{sections[key]}</React.Fragment>
      ))}
    </ScrollView>
  );
}
