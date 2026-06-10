import * as React from 'react';
import { View, Pressable, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { ORG_ID } from '../lib/recursiv';
import { useTheme } from '../lib/theme';
import { conversationUnreadCount } from '../lib/models';
import { useConversations, useCommunities } from '../lib/hooks';
import { ensureIntroDM } from '../lib/agentIntro';
import { invalidate } from '../lib/cache';
import { getPreference } from '../lib/preferences';
import { useActiveConvoId } from '../lib/activeConvo';
import { colors as defaultColors, spacing, radius } from '../constants/theme';

const COLLAPSED_WIDTH = 68;
const EXPANDED_WIDTH = 264;
const AUTO_COLLAPSE_WIDTH = 1024;

type NavItem = { name: string; label: string; icon: string; activeIcon: string };

const NAV_ITEMS: NavItem[] = [
  { name: 'index', label: 'Feed', icon: 'newspaper-outline', activeIcon: 'newspaper' },
  { name: 'discover', label: 'Discover', icon: 'search-outline', activeIcon: 'search' },
  { name: 'create', label: 'Create', icon: 'add-circle-outline', activeIcon: 'add-circle' },
  { name: 'wallet', label: 'Wallet', icon: 'wallet-outline', activeIcon: 'wallet' },
  { name: 'notifications', label: 'Notifications', icon: 'notifications-outline', activeIcon: 'notifications' },
  { name: 'admin', label: 'Admin', icon: 'shield-outline', activeIcon: 'shield' },
];

const BOTTOM_ITEMS: NavItem[] = [];

export function useSidebarState() {
  const { width: windowWidth } = useWindowDimensions();
  // Auto-collapse below the breakpoint only. No manual toggle — collapsing a
  // full-size desktop nav by hand looked odd, so it's width-driven.
  const collapsed = windowWidth < AUTO_COLLAPSE_WIDTH;
  const toggle = React.useCallback(() => {}, []);
  return { collapsed, toggle, width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH };
}

interface SideNavProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function SideNav({ collapsed, onToggle }: SideNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, sdk } = useAuth();
  const { colors } = useTheme();
  const { conversations, refresh: refreshConvos } = useConversations();
  const { communities } = useCommunities(5);
  // Unread DM dots are STICKY: a dot is only ever cleared by OPENING the thread,
  // never by a server refresh. Two things ADD a dot — a live WS message, or the
  // server's read-cursor count on load/refresh (back-fills threads that went
  // unread before this tab opened). `readLocallyRef` suppresses re-adding a
  // thread we just opened until the server's read cursor catches up, so opening
  // it doesn't flicker back on from a stale refresh that still shows it unread.
  const [unreadConvos, setUnreadConvos] = React.useState<Set<string>>(new Set());
  const readLocallyRef = React.useRef<Set<string>>(new Set());
  // Optimistic inbox preview overlay, keyed by conversation id. Set the instant
  // a live message arrives so the preview text, the reorder, the unread dot and
  // the row highlight all update TOGETHER — instead of the dot firing instantly
  // (from the WS event) while the preview waits ~600ms for the list refetch.
  // The refetch then reconciles with server truth (same message, no conflict).
  const [livePreviews, setLivePreviews] = React.useState<Map<string, { content: string; createdAt: string }>>(new Map());
  const [unreadNotifs, setUnreadNotifs] = React.useState(0);

  // Fetch unread notification count + subscribe to live updates.
  const refreshNotifs = React.useCallback(async () => {
    if (!sdk) return;
    try {
      const res = await sdk.notifications.list({ limit: 10, organization_id: ORG_ID || undefined });
      const notifs = res.data || [];
      setUnreadNotifs(notifs.filter((n: any) => n.status === 'unread').length);
    } catch {}
  }, [sdk]);

  React.useEffect(() => {
    refreshNotifs();
  }, [sdk, pathname]); // Refetch when navigating (cheap, cached)

  // Chat-list safety net. WS fan-out (PR #1461) is the primary path
  // for new DM delivery, but if a recipient's socket missed the event
  // (reconnecting, just opened the tab, etc.) the conversation would
  // be invisible until they navigated. Three defenses:
  //   1. Refetch on pathname change (cheap, debounced via cache)
  //   2. Refetch when the tab regains visibility
  //   3. Light poll every 30s as a final fallback
  React.useEffect(() => {
    refreshConvos();
  }, [sdk, pathname, refreshConvos]);

  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onVis = () => { if (document.visibilityState === 'visible') refreshConvos(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refreshConvos]);

  React.useEffect(() => {
    if (!sdk) return;
    const id = setInterval(() => { refreshConvos(); }, 30_000);
    return () => clearInterval(id);
  }, [sdk, refreshConvos]);

  // Live notification badge AND live conversation-created refresh.
  // Server emits 'notification' on any in-app notification insert,
  // and 'conversation_created' the instant a new DM thread is opened
  // (so the recipient sees the thread before any messages land).
  // SDK doesn't expose typed helpers yet — use the underlying socket.
  React.useEffect(() => {
    if (!sdk) return;
    const cleanups: Array<() => void> = [];
    (async () => {
      try {
        await sdk.realtime.connect();
        const sock = (sdk as any).realtime?.socket;
        if (!sock) return;
        const onNotif = () => refreshNotifs();
        sock.on('notification', onNotif);
        cleanups.push(() => sock.off?.('notification', onNotif));

        const onConvoCreated = () => {
          // Drop any cached conversations snapshot + refetch so the
          // newly-created thread shows up in Recents immediately.
          invalidate('conversations');
          refreshConvos();
        };
        sock.on('conversation_created', onConvoCreated);
        cleanups.push(() => sock.off?.('conversation_created', onConvoCreated));
      } catch {}
    })();
    return () => { cleanups.forEach(fn => fn()); };
  }, [sdk, refreshNotifs, refreshConvos]);

  // Active conversation id — set by ConversationView via the shared
  // ActiveConvoProvider context. We only honor it while the user is actually on
  // the chat route: if they've navigated to the feed (but the chat tab stays
  // mounted), nothing should count as "actively being read", so its dot is free
  // to light up. Defense-in-depth alongside the focus-based clear in chat.tsx.
  const rawActiveConvoId = useActiveConvoId();
  const activeConvoIdFromPath = pathname.includes('chat') ? rawActiveConvoId : null;

  // Keep the live WS handler reading the *current* active conversation without
  // re-subscribing on every navigation (the old code tore down + rebuilt the
  // socket listener on each route change, leaving a gap where a message could
  // slip through). A ref gives the handler fresh state with a stable effect.
  const activeConvoRef = React.useRef<string | null>(activeConvoIdFromPath);
  React.useEffect(() => { activeConvoRef.current = activeConvoIdFromPath; }, [activeConvoIdFromPath]);

  // Add dots from server truth on every refresh — but ADD ONLY. The conversation
  // list computes unread from each member's read cursor, which back-fills threads
  // that went unread before this tab opened. We never REMOVE a dot here: a dot is
  // cleared only by opening the thread (the rule Jack wants — it must not vanish
  // on its own). When the server reports a thread read, we simply drop its
  // local-read suppression so a future unread can light it up again.
  React.useEffect(() => {
    if (!conversations) return;
    setUnreadConvos(prev => {
      let changed = false;
      const next = new Set(prev);
      for (const c of conversations as any[]) {
        const id = c.id as string;
        if (id === activeConvoIdFromPath) { if (next.delete(id)) changed = true; continue; }
        if (conversationUnreadCount(c) > 0) {
          if (!readLocallyRef.current.has(id) && !next.has(id)) { next.add(id); changed = true; }
        } else {
          readLocallyRef.current.delete(id);
        }
      }
      return changed ? next : prev;
    });
  }, [conversations, activeConvoIdFromPath]);

  // Personal-agent intro back-fill. Runs once per app load. If the
  // user has a personal agent and that thread has no agent-authored
  // message yet, post the intro DM. Covers accounts whose original
  // /agent setup swallowed the sendAsAgent failure (Samson stayed
  // mute in the Recent inbox). Idempotent: ensureIntroDM no-ops
  // when the thread already has an agent message.
  const introBackfilledRef = React.useRef(false);
  React.useEffect(() => {
    if (!sdk || !user?.id || introBackfilledRef.current) return;
    if (!getPreference('aiEnabled')) return;
    introBackfilledRef.current = true;
    (async () => {
      try {
        const list = await sdk.agents.list({ limit: 50 });
        const personal = (list.data || []).find(
          (a: any) => a.agent_type === 'personal' || a.agentType === 'personal',
        );
        if (!personal) return;
        await ensureIntroDM(sdk, personal.id, user?.name);
        invalidate('conversations');
        refreshConvos();
      } catch (err) {
        console.warn('[SideNav intro back-fill] failed', err);
      }
    })();
  }, [sdk, user?.id, user?.name, refreshConvos]);


  // Source 2: live WS. ONE stable subscription for the SideNav's lifetime (deps
  // are all stable: refreshConvos is memoized on sdk). The server fans every
  // chat_message — human OR agent — out to each member's `user:<id>` room, so
  // we get them without joining any thread. On reconnect we re-sync from the
  // server to backfill anything missed while the socket was down.
  React.useEffect(() => {
    if (!sdk) return;
    let unsub: (() => void) | undefined;
    let socket: any;
    let onConnect: (() => void) | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    // Coalesce bursts: one reconcile fetch per ~600ms, not per message.
    const debouncedRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => { refreshTimer = null; refreshConvos(); }, 600);
    };
    (async () => {
      try {
        await sdk.realtime.connect();
        socket = sdk.realtime.getSocket?.();
        onConnect = () => refreshConvos(); // reconnect → resync missed dots fast
        socket?.on?.('connect', onConnect);
        unsub = sdk.realtime.onMessage((msg: any) => {
          const convoId = msg.conversationId || msg.conversation_id;
          if (!convoId) return;
          const senderId = msg.senderId || msg.sender?.id;
          const content = (msg.text || msg.content || '').trim();
          // Optimistically update the inbox preview + reorder the instant the
          // message lands (own or incoming), so the row updates atomically with
          // the dot below.
          if (content) {
            const createdAt = msg.createdAt || msg.created_at || new Date().toISOString();
            setLivePreviews(prev => { const n = new Map(prev); n.set(convoId, { content, createdAt }); return n; });
          }
          // The dot only lights for INCOMING messages on a thread you're not
          // actively reading.
          if (senderId && senderId !== user?.id && convoId !== activeConvoRef.current) {
            readLocallyRef.current.delete(convoId); // a new message makes it unread again
            setUnreadConvos(prev => (prev.has(convoId) ? prev : new Set(prev).add(convoId)));
          }
          debouncedRefresh();
        });
      } catch {}
    })();
    return () => {
      unsub?.();
      if (socket && onConnect) socket.off?.('connect', onConnect);
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [sdk, user?.id, refreshConvos]);

  // Opening a thread is the ONLY thing that clears its dot. Suppress re-adding it
  // until the server's read cursor catches up (readLocallyRef), so a refresh that
  // still reports it unread doesn't flicker the dot back on right after you read.
  React.useEffect(() => {
    if (!activeConvoIdFromPath) return;
    readLocallyRef.current.add(activeConvoIdFromPath);
    setUnreadConvos(prev => {
      if (!prev.has(activeConvoIdFromPath)) return prev;
      const next = new Set(prev);
      next.delete(activeConvoIdFromPath);
      return next;
    });
  }, [activeConvoIdFromPath]);

  const isActive = (name: string) => {
    if (name === 'index') return pathname === '/' || pathname === '';
    return pathname.includes(name);
  };

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  // Combine recent DMs and communities for inbox.
  //
  // DM filtering rules:
  // - Skip one-on-ones where there's no valid "other" participant
  //   (the orphan ghost-agent thread that rendered as "Conversation").
  // - Skip threads with no resolvable display name at all.
  //
  // Community filtering rules:
  // - Strict membership check. Only is_member === true. Earlier
  //   permissive check (`c.is_member || c.isMember`) accepted any
  //   truthy value and Jack saw communities he hadn't joined.
  // Sort by latest activity before mapping so the freshest DMs surface
  // in the top-4 slice. Server now also orders by this, but this
  // belt-and-suspenders keeps things sane on older API versions.
  // Latest activity time for a conversation = newer of (server last message,
  // optimistic live overlay). Used for both sort order and which preview to show.
  const serverMs = (c: any) => {
    const s = c.lastMessage?.createdAt || c.last_message?.created_at || c.updatedAt || c.createdAt || 0;
    return s ? new Date(s).getTime() : 0;
  };
  const recentDMs = [...(conversations || [])]
    .sort((a: any, b: any) => {
      const aL = livePreviews.get(a.id); const bL = livePreviews.get(b.id);
      const aT = Math.max(serverMs(a), aL ? new Date(aL.createdAt).getTime() : 0);
      const bT = Math.max(serverMs(b), bL ? new Date(bL.createdAt).getTime() : 0);
      return bT - aT;
    })
    .map((c: any) => {
      const participants: any[] = c.participants || c.members || [];
      const others = participants.filter((p: any) => (p?.id ?? p?.userId) && (p?.id ?? p?.userId) !== user?.id);
      const other = others[0];
      const type = c.type || (others.length <= 1 ? 'one_on_one' : 'group');
      const name = c.name || other?.name || other?.username || null;
      // One-on-one with no resolvable other is the orphan case.
      if (type === 'one_on_one' && !other) return null;
      if (!name) return null;
      const live = livePreviews.get(c.id);
      const useLive = live && new Date(live.createdAt).getTime() >= serverMs(c);
      return {
        id: c.id,
        type: 'dm' as const,
        name,
        avatar: other?.image || null,
        preview: useLive ? live.content : (c.lastMessage?.content || c.last_message?.content || ''),
      };
    })
    .filter(Boolean)
    .slice(0, 4) as Array<{ id: string; type: 'dm'; name: string; avatar: string | null; preview: string }>;
  // Communities the user is a member of. Strict is_member check (only true).
  // NOTE: this reflects real communityMember rows — if a community the user
  // never joined appears here, the fix is at the source (an auto-join path
  // creating the membership), not this filter.
  const recentCommunities = (communities || [])
    .filter((c: any) => c.is_member === true || c.isMember === true)
    .slice(0, 3)
    .map((c: any) => ({
      id: c.id,
      type: 'community' as const,
      name: c.name || 'Community',
      avatar: c.image || c.avatar || null,
      preview: `${c.memberCount || c.member_count || 0} members`,
    }));
  const inboxItems = [...recentDMs, ...recentCommunities];

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.name);
    return (
      <Pressable
        key={item.name}
        onPress={() => {
          router.push(item.name === 'index' ? '/(tabs)' : `/(tabs)/${item.name}` as any);
        }}
        style={({ pressed, hovered }: any) => ({
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          gap: spacing.md,
          paddingVertical: spacing.sm + 2,
          paddingHorizontal: collapsed ? 0 : spacing.md,
          marginHorizontal: collapsed ? 0 : spacing.md,
          marginRight: collapsed ? 0 : spacing.lg,
          borderRadius: radius.md,
          backgroundColor: active ? colors.accentSubtle : hovered ? colors.glass : 'transparent',
          opacity: pressed ? 0.7 : 1,
          justifyContent: collapsed ? 'center' as const : 'flex-start' as const,
          ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color 0.15s ease' } as any : {}),
        })}
      >
        <View style={{ position: 'relative' }}>
          <Ionicons
            name={(active ? item.activeIcon : item.icon) as any}
            size={22}
            color={active ? colors.accent : colors.textMuted}
          />
          {/* Gold dot badge for unread notifications */}
          {unreadNotifs > 0 && item.name === 'notifications' && (
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -4,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.accent,
              }}
            />
          )}
        </View>
        {!collapsed && (
          <Text
            variant="body"
            color={active ? colors.accent : colors.textSecondary}
            style={{ fontSize: 15, fontFamily: active ? 'Roboto-Medium' : 'Roboto-Regular' }}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <View
      style={{
        width,
        backgroundColor: colors.bg,
        borderRightWidth: 1,
        borderRightColor: colors.borderSubtle,
        ...(Platform.OS === 'web' ? { transition: 'width 0.2s ease' } as any : {}),
      }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: spacing['3xl'],
          paddingBottom: spacing.xl,
          justifyContent: 'space-between',
          minHeight: '100%' as any,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top section */}
        <View>
          {/* Logo (auto-collapses with the nav — no manual toggle, no theme
              switch; theme lives in Settings now) */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              paddingHorizontal: collapsed ? 0 : spacing.lg,
              marginBottom: spacing['2xl'],
            }}
          >
            <Pressable onPress={() => router.push('/(tabs)')} hitSlop={8}>
              <Text
                variant="h2"
                color={colors.accent}
                style={{ fontSize: 20, letterSpacing: collapsed ? 1 : 0.5 }}
              >
                {collapsed ? 'm' : 'minds'}
              </Text>
            </Pressable>
          </View>

          {/* Search lives at the top of the right rail (FeedSidebar) now,
             matching X — keeps the left nav clean and pins discovery to
             the trends column. */}

          {/* Main nav — filter admin tab to platform admins only */}
          <View style={{ gap: spacing.xs }}>
            {NAV_ITEMS
              .filter((item) => item.name !== 'admin' || (user as any)?.role === 'admin')
              .map(renderNavItem)}
          </View>

          {/* Separator */}
          {!collapsed && (
            <View
              style={{
                height: 0.5,
                backgroundColor: colors.borderSubtle,
                marginHorizontal: spacing.lg,
                marginVertical: spacing.xl,
              }}
            />
          )}

          {/* Inbox section — only when expanded */}
          {!collapsed && (
            <View style={{ paddingHorizontal: spacing.lg }}>
              <Text
                variant="caption"
                color={colors.textMuted}
                style={{ fontSize: 11, fontWeight: '400', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: spacing.md }}
              >
                Recent
              </Text>
              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {inboxItems.length === 0 ? (
                  <Text variant="caption" color={colors.textMuted} style={{ paddingVertical: spacing.sm }}>
                    No recent activity
                  </Text>
                ) : (
                  inboxItems.map((item) => {
                    const isUnread = item.type === 'dm' && unreadConvos.has(item.id);
                    return (
                    <Pressable
                      key={`${item.type}-${item.id}`}
                      onPress={() => {
                        if (item.type === 'dm') {
                          readLocallyRef.current.add(item.id);
                          setUnreadConvos(prev => { if (!prev.has(item.id)) return prev; const next = new Set(prev); next.delete(item.id); return next; });
                          router.push({ pathname: '/(tabs)/chat', params: { id: item.id } } as any);
                        } else {
                          router.push(`/(tabs)/community/${item.id}` as any);
                        }
                      }}
                      style={({ pressed, hovered }: any) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.sm,
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.sm,
                        borderRadius: radius.sm,
                        // Faint full-row highlight for unread, so it reads at a glance —
                        // not just the dot. Hover sits on top for web responsiveness.
                        backgroundColor: pressed
                          ? colors.surfaceHover
                          : isUnread
                            ? (hovered ? colors.accentMuted : colors.accentSubtle)
                            : hovered ? colors.glass : 'transparent',
                        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                      })}
                    >
                      <Avatar uri={item.avatar} name={item.name} size="xs" />
                      <View style={{ flex: 1 }}>
                        <Text
                          variant="caption"
                          numberOfLines={1}
                          color={isUnread ? colors.text : undefined}
                          style={{ fontWeight: isUnread ? '600' : '400', fontSize: 13 }}
                        >
                          {item.name}
                        </Text>
                        {item.preview ? (
                          <Text
                            variant="caption"
                            color={isUnread ? colors.textSecondary : colors.textMuted}
                            numberOfLines={1}
                            style={{ fontSize: 11 }}
                          >
                            {item.preview}
                          </Text>
                        ) : null}
                      </View>
                      {isUnread && (
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: colors.accent,
                          }}
                        />
                      )}
                    </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Bottom section */}
        <View style={{ gap: spacing.xs, marginTop: spacing.xl }}>
          {BOTTOM_ITEMS.map(renderNavItem)}

          {/* User profile — route directly to the canonical /user/<username>
              URL so we never bounce through the /profile redirect page. */}
          <Pressable
            onPress={() => {
              const slug = user?.username || user?.id;
              if (slug) router.push(`/(tabs)/user/${slug}` as any);
              else router.push('/(tabs)/profile');
            }}
            style={({ pressed, hovered }: any) => ({
              flexDirection: 'row' as const,
              alignItems: 'center' as const,
              gap: spacing.md,
              paddingVertical: spacing.sm + 2,
              paddingHorizontal: collapsed ? 0 : spacing.md,
              marginHorizontal: collapsed ? 0 : spacing.md,
              marginRight: collapsed ? 0 : spacing.lg,
              borderRadius: radius.md,
              backgroundColor: (isActive('profile') || (user?.username && pathname?.includes(`/user/${user.username}`)))
                ? colors.accentSubtle
                : hovered ? colors.glass : 'transparent',
              opacity: pressed ? 0.7 : 1,
              justifyContent: collapsed ? 'center' as const : 'flex-start' as const,
              marginTop: spacing.xs,
              ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color 0.15s ease' } as any : {}),
            })}
          >
            <Avatar uri={user?.image} name={user?.name} size="xs" />
            {!collapsed && (
              <View style={{ flex: 1 }}>
                <Text variant="caption" numberOfLines={1} style={{ fontWeight: '400' }}>
                  {user?.name || user?.username || 'Profile'}
                </Text>
                {user?.username && (
                  <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 11 }}>
                    @{user.username}
                  </Text>
                )}
              </View>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
