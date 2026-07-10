import * as React from 'react';
import { View, Pressable, Platform, ScrollView, useWindowDimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { getReferralLink } from '../lib/referral';
import { showToast } from './Toast';
import { ORG_ID } from '../lib/recursiv';
import { useTheme } from '../lib/theme';
import { conversationUnreadCount } from '../lib/models';
import { useConversations, useCommunities } from '../lib/hooks';
import { ensureIntroDM } from '../lib/agentIntro';
import { invalidate } from '../lib/cache';
import { getPreference } from '../lib/preferences';
import { useActiveConvoId } from '../lib/activeConvo';
import { subscribeLocalChat } from '../lib/chatEvents';
import { colors as defaultColors, spacing, radius } from '../constants/theme';
import { resolvePersonalAgent } from '../lib/resolvePersonalAgent';
import { stripMarkdown } from '../lib/text';
import { NewChatModal } from './NewChatModal';

// The classic Minds bulb — collapsed-rail mark (matches the browser favicon).
// 212x345 source. Expanded rail shows the full wordmark logo (theme-specific).
const BULB = require('../assets/bulb.svg');
const LOGO_DARK = require('../assets/logo-dark-mode.svg');
const LOGO_LIGHT = require('../assets/logo-light-mode.svg');

const COLLAPSED_WIDTH = 68;
const EXPANDED_WIDTH = 264;
const AUTO_COLLAPSE_WIDTH = 1024;

type NavItem = { name: string; label: string; icon: string; activeIcon: string };

const NAV_ITEMS: NavItem[] = [
  { name: 'index', label: 'Feed', icon: 'newspaper-outline', activeIcon: 'newspaper' },
  { name: 'discover', label: 'Discover', icon: 'search-outline', activeIcon: 'search' },
  { name: 'communities', label: 'Communities', icon: 'people-outline', activeIcon: 'people' },
  { name: 'create', label: 'Create', icon: 'add-circle-outline', activeIcon: 'add-circle' },
  { name: 'wallet', label: 'Wallet', icon: 'wallet-outline', activeIcon: 'wallet' },
  { name: 'notifications', label: 'Notifications', icon: 'notifications-outline', activeIcon: 'notifications' },
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
  const [referBusy, setReferBusy] = React.useState(false);
  const handleRefer = async () => {
    if (referBusy) return;
    setReferBusy(true);
    try {
      const link = await getReferralLink(sdk);
      if (!link) { showToast('Could not create your invite link', 'error'); return; }
      let copied = false;
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).clipboard) {
        try { await (navigator as any).clipboard.writeText(link); copied = true; } catch {}
      } else {
        try { await Clipboard.setStringAsync(link); copied = true; } catch {}
      }
      showToast(copied ? 'Referral link copied!' : link, copied ? 'success' : 'info');
    } catch { showToast('Could not copy your invite link', 'error'); }
    finally { setReferBusy(false); }
  };
  const { colors, isDark } = useTheme();
  const { conversations, refresh: refreshConvos } = useConversations();
  // memberOnly — at 96K network communities the caller's groups are never in
  // page one of the directory; ask the server for exactly "mine".
  const { communities, fetchedOnce: communitiesFetched } = useCommunities(5, { memberOnly: true });
  // Messages + Communities are fixed, independently-scrollable sections so a
  // long DM list can't bury Communities. Each is collapsible.
  const [messagesOpen, setMessagesOpen] = React.useState(true);
  const [communitiesOpen, setCommunitiesOpen] = React.useState(true);
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
  // New-DM compose modal (search a person or agent → opens the thread).
  const [showNewChat, setShowNewChat] = React.useState(false);

  // Fetch unread notification count + subscribe to live updates.
  const refreshNotifs = React.useCallback(async () => {
    if (!sdk) return;
    try {
      const res = await sdk.notifications.list({ limit: 10, organization_id: ORG_ID || undefined });
      const notifs = res.data || [];
      setUnreadNotifs(notifs.filter((n: any) => n.status === 'unread').length);
    } catch {}
  }, [sdk]);

  // Navigation-triggered refetches are throttled: neither call below is
  // actually cached (refreshNotifs hits notifications.list directly, and the
  // conversations refresh refetches), so every route change used to cost two
  // API calls per click for every user — pure navigation amplification. The
  // socket is the primary freshness path; pathname refetch is a safety net
  // that doesn't need to fire more than once per 15s.
  const lastNavRefetchRef = React.useRef(0);
  React.useEffect(() => {
    if (!sdk) return;
    const now = Date.now();
    if (now - lastNavRefetchRef.current < 15_000) return;
    lastNavRefetchRef.current = now;
    refreshNotifs();
    refreshConvos();
  }, [sdk, pathname, refreshNotifs, refreshConvos]);

  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onVis = () => { if (document.visibilityState === 'visible') refreshConvos(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refreshConvos]);

  React.useEffect(() => {
    if (!sdk) return;
    const id = setInterval(() => {
      // Hidden tabs already refetch on visibilitychange above — polling
      // them too is pure QPS waste at fleet scale.
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshConvos();
    }, 30_000);
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
        // Debounce + jitter: a fan-out notification (popular post, org
        // announcement) hits every online client at the same instant; an
        // immediate refetch per event is a synchronized request spike
        // proportional to audience size. The chat handler below already
        // debounces for the same reason.
        let notifTimer: ReturnType<typeof setTimeout> | null = null;
        const onNotif = () => {
          if (notifTimer) return;
          notifTimer = setTimeout(() => {
            notifTimer = null;
            refreshNotifs();
          }, 1000 + Math.random() * 2000);
        };
        sock.on('notification', onNotif);
        cleanups.push(() => {
          sock.off?.('notification', onNotif);
          if (notifTimer) clearTimeout(notifTimer);
        });

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
        const personal = await resolvePersonalAgent(sdk);
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

  // Source 3: LOCAL optimistic sends. The chat screen publishes the instant the
  // user hits send — before the WS echo round-trips — so the sidebar preview +
  // ordering (and a brand-new DM's row) move in lockstep with the thread view.
  // This NEVER lights the unread dot (it's the user's OWN message); it only
  // updates the preview overlay and schedules a reconcile refetch so a newly
  // created conversation appears.
  React.useEffect(() => {
    const unsub = subscribeLocalChat((evt) => {
      if (!evt.content) return;
      setLivePreviews(prev => {
        const n = new Map(prev);
        n.set(evt.conversationId, { content: evt.content, createdAt: evt.createdAt });
        return n;
      });
      // A brand-new DM won't be in the cached list yet — pull it in so the row
      // renders. invalidate() forces useConversations to refetch immediately.
      invalidate('conversations');
    });
    return unsub;
  }, []);

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
      // Participant identity may be nested under `.user` (id/name/image there).
      const others = participants.filter((p: any) => { const pid = p?.user?.id ?? p?.id ?? p?.userId; return pid && pid !== user?.id; });
      const other = others[0];
      const ou = other?.user || other;
      const type = c.type || (others.length <= 1 ? 'one_on_one' : 'group');
      const name = c.name || ou?.name || other?.name || ou?.username || other?.username || null;
      // One-on-one with no resolvable other is the orphan case.
      if (type === 'one_on_one' && !other) return null;
      if (!name) return null;
      const live = livePreviews.get(c.id);
      const useLive = live && new Date(live.createdAt).getTime() >= serverMs(c);
      return {
        id: c.id,
        type: 'dm' as const,
        name,
        avatar: ou?.image || other?.image || ou?.avatar || null,
        preview: stripMarkdown(useLive ? live.content : (c.lastMessage?.content || c.last_message?.content || '')),
      };
    })
    .filter(Boolean)
    // Show a real inbox, not a teaser. The panel scrolls, so the cap only
    // exists to keep the render light — 4 was hiding active threads.
    .slice(0, 10) as Array<{ id: string; type: 'dm'; name: string; avatar: string | null; preview: string }>;
  // Communities the user is a member of. Strict is_member check (only true).
  // NOTE: this reflects real communityMember rows — if a community the user
  // never joined appears here, the fix is at the source (an auto-join path
  // creating the membership), not this filter.
  // Only show communities once a FRESH server fetch has confirmed membership
  // this session. Without this gate a stale cached is_member=true could flash
  // (intermittently, depending on boot timing) — the phantom QA/Support groups.
  const recentCommunities = (communitiesFetched ? (communities || []) : [])
    .filter((c: any) => c.is_member === true || c.isMember === true)
    .slice(0, 5)
    .map((c: any) => ({
      id: c.id,
      type: 'community' as const,
      name: c.name || 'Community',
      avatar: c.image || c.avatar || null,
      preview: `${c.memberCount || c.member_count || 0} members`,
    }));
  // Shared row renderer for the sidebar's Recent (DMs/agents) and Communities
  // sections. Unread treatment only applies to DMs — communities are nav, not
  // inbox (Reddit model: places you go, not things that message you).
  const renderInboxRow = (item: { id: string; type: 'dm' | 'community'; name: string; avatar: string | null; preview: string }) => {
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
  };

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
        paddingTop: spacing['3xl'],
        paddingBottom: spacing.xl,
        ...(Platform.OS === 'web' ? { transition: 'width 0.2s ease' } as any : {}),
      }}
    >
        {/* Top section — fixed (logo + nav + separator) */}
        <View style={{ flexShrink: 0 }}>
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
              {collapsed ? (
                // Bulb mark only (matches the favicon). Source is 212x345, so
                // keep that aspect ratio (~0.614) to avoid squashing.
                <Image
                  source={BULB}
                  style={{ width: 22, height: 36 }}
                  contentFit="contain"
                  accessibilityLabel="Minds"
                />
              ) : (
                // Expanded: full Minds wordmark logo, matched to the theme.
                // Source viewBox is 104x40 (2.6:1) — keep the ratio.
                <Image
                  source={isDark ? LOGO_DARK : LOGO_LIGHT}
                  style={{ width: 91, height: 35 }}
                  contentFit="contain"
                  accessibilityLabel="Minds"
                />
              )}
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
        </View>

        {/* Inbox section — flex:1, the ONLY scrollable region, so the user
            profile below stays pinned to the bottom. */}
        {!collapsed && (() => {
          // Collapsible section header: chevron + label toggles open/closed;
          // a separate "See all" navigates without toggling.
          const SectionHeader = ({ label, onSeeAll }: { label: string; onSeeAll: () => void }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11, fontWeight: '400', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                {label}
              </Text>
              <Pressable onPress={onSeeAll} hitSlop={8} style={() => ({ borderRadius: radius.sm, paddingHorizontal: spacing.xs, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) })}>
                {({ hovered }: any) => (
                  <Text variant="caption" color={hovered ? colors.text : colors.textMuted} style={{ fontSize: 11 }}>See all</Text>
                )}
              </Pressable>
            </View>
          );
          // New-DM compose affordance. ONE subtle look for BOTH states (empty
          // inbox AND bottom-of-list): a near-invisible muted "+ New message"
          // text link. No background, no border, no accent fill, no bold — a
          // tiny faint glyph + label that blends into the list and only firms up
          // slightly on hover, so the inbox/messages stay the focus. The
          // `prominent` prop is kept for call-site compatibility but no longer
          // changes the rendering (Jack asked for this NOT to be a big CTA).
          const SendMessageCTA = (_props: { prominent?: boolean }) => (
            <Pressable
              onPress={() => setShowNewChat(true)}
              style={({ pressed }: any) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
                marginTop: 2,
                opacity: pressed ? 0.6 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              {({ hovered }: any) => (
                <>
                  <Ionicons name="add" size={12} color={hovered ? colors.textSecondary : colors.textMuted} />
                  <Text
                    variant="caption"
                    color={hovered ? colors.textSecondary : colors.textMuted}
                    style={{ fontSize: 11 }}
                  >
                    New message
                  </Text>
                </>
              )}
            </Pressable>
          );
          return (
            <View style={{ flex: 1, minHeight: 0 as any, paddingHorizontal: spacing.lg }}>
              {/* MESSAGES — the sidebar inbox is just DMs now; Communities moved
                  to a top-level nav item so this stays uncrowded. */}
              <View style={{ flex: 1, minHeight: 0 as any }}>
                <SectionHeader label="Messages" onSeeAll={() => router.push('/(tabs)/chat' as any)} />
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  {recentDMs.length === 0 ? (
                    // Cold/empty state: lead with the compose CTA, not just "no activity".
                    <View style={{ paddingVertical: spacing.sm, gap: spacing.xs }}>
                      <Text variant="caption" color={colors.textMuted}>No messages yet</Text>
                      <SendMessageCTA prominent />
                    </View>
                  ) : (
                    <>
                      {recentDMs.map(renderInboxRow)}
                      {/* Bottom-of-list affordance to start a new DM. */}
                      <SendMessageCTA />
                    </>
                  )}
                </ScrollView>
              </View>
            </View>
          );
        })()}

        {/* Bottom section — fixed, pinned to the bottom (the inbox above
            takes the remaining space and scrolls internally). */}
        <View style={{ flexShrink: 0, gap: spacing.xs, marginTop: spacing.xl }}>
          {BOTTOM_ITEMS.map(renderNavItem)}

          {/* User profile — route directly to the canonical /user/<username>
              URL so we never bounce through the /profile redirect page. */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: collapsed ? 0 : spacing.md,
            marginRight: collapsed ? 0 : spacing.lg,
            marginTop: spacing.xs,
          }}>
            <Pressable
              onPress={() => {
                const slug = user?.username || user?.id;
                if (slug) router.push(`/(tabs)/user/${slug}` as any);
                else router.push('/(tabs)/profile');
              }}
              style={({ pressed, hovered }: any) => ({
                flex: 1,
                flexDirection: 'row' as const,
                alignItems: 'center' as const,
                gap: spacing.md,
                paddingVertical: spacing.sm + 2,
                paddingHorizontal: collapsed ? 0 : spacing.md,
                borderRadius: radius.md,
                backgroundColor: (isActive('profile') || (user?.username && pathname?.includes(`/user/${user.username}`)))
                  ? colors.accentSubtle
                  : hovered ? colors.glass : 'transparent',
                opacity: pressed ? 0.7 : 1,
                justifyContent: collapsed ? 'center' as const : 'flex-start' as const,
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
            {/* Admin shield — compact icon for platform admins instead of a
                whole nav row. */}
            {!collapsed && (user as any)?.role === 'admin' && (
              <Pressable
                onPress={() => router.push('/(tabs)/admin' as any)}
                hitSlop={8}
                style={({ hovered }: any) => ({
                  padding: spacing.sm,
                  borderRadius: radius.full,
                  backgroundColor: hovered ? colors.glass : 'transparent',
                  ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                })}
              >
                <Ionicons name="shield-outline" size={18} color={colors.textMuted} />
              </Pressable>
            )}
            {/* Always-accessible Settings — no more hunting through the profile menu. */}
            {!collapsed && (
              <Pressable
                onPress={() => router.push('/(tabs)/settings' as any)}
                hitSlop={8}
                style={({ hovered }: any) => ({
                  padding: spacing.sm,
                  borderRadius: radius.full,
                  backgroundColor: hovered ? colors.glass : 'transparent',
                  ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                })}
              >
                <Ionicons name="settings-outline" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Subtle "Refer friends + earn" CTA under the username (Replit-style):
              shares the user's invite link; signups via it credit them. */}
          {!collapsed && (
            <Pressable
              onPress={handleRefer}
              disabled={referBusy}
              style={({ pressed, hovered }: any) => ({
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
                marginHorizontal: spacing.md, marginRight: spacing.lg, marginTop: spacing.xs,
                paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1, borderColor: `${colors.accent}55`,
                backgroundColor: hovered ? colors.accentSubtle : 'transparent',
                opacity: pressed ? 0.7 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Ionicons name="gift-outline" size={14} color={colors.accent} />
              <Text variant="caption" color={colors.accent} numberOfLines={1} style={{ fontFamily: 'Roboto-Medium' }}>Refer friends + earn</Text>
              <Ionicons name="copy-outline" size={13} color={colors.accent} style={{ marginLeft: 2 }} />
            </Pressable>
          )}
        </View>

        {/* New-message compose: search a person OR agent, one tap opens the DM. */}
        <NewChatModal visible={showNewChat} onClose={() => setShowNewChat(false)} />
    </View>
  );
}
