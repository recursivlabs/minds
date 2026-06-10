import * as React from 'react';
import { View, FlatList, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Avatar, Skeleton, ChatBubble, Button } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { useConversations } from '../../lib/hooks';
import { getPreference } from '../../lib/preferences';
import { ORG_ID } from '../../lib/recursiv';
import { spacing, radius, typography } from '../../constants/theme';
import { useColors } from '../../lib/theme';
import { getCached, setCache, invalidate } from '../../lib/cache';
import { useSetActiveConvoId } from '../../lib/activeConvo';
import { ThinkingPill } from '../../components/ThinkingPill';
import { ensureIntroDM } from '../../lib/agentIntro';
import { captureException } from '../../lib/monitoring';
import { conversationUnreadCount, isAiActor } from '../../lib/models';

export default function ChatScreen() {
  const { sdk, user } = useAuth();
  const colors = useColors();
  const params = useLocalSearchParams<{ id?: string }>();
  const { conversations, loading, refresh } = useConversations();
  const [activeConvoId, setActiveConvoId] = React.useState<string | null>(params.id || null);
  const [showNewChat, setShowNewChat] = React.useState(false);
  const [dmUsername, setDmUsername] = React.useState('');
  const [dmError, setDmError] = React.useState<string | null>(null);

  // Open conversation from route params
  React.useEffect(() => {
    if (params.id && params.id !== activeConvoId) {
      setActiveConvoId(params.id);
    }
  }, [params.id]);

  // Conversation-list live updates. The active-conversation view already
  // subscribes to realtime for its own messages, but the LIST view used
  // to be poll-only — so previews / unread badges didn't move until you
  // pulled to refresh. Subscribe globally here so every incoming message
  // bumps the list immediately.
  React.useEffect(() => {
    if (!sdk) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        await sdk.realtime.connect();
        if (cancelled) return;
        let lastRefresh = 0;
        unsub = sdk.realtime.onMessage(() => {
          // Re-fetch the conversations list so previews + unread counts move.
          // Throttle to once / 1.5s: a busy thread fires many messages, and we
          // don't want one refetch per message hammering the list endpoint.
          const now = Date.now();
          if (now - lastRefresh < 1500) return;
          lastRefresh = now;
          refresh();
        });
      } catch {
        // Realtime unavailable; fall back to refresh-on-focus behavior.
      }
    })();
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [sdk]);

  // Back-fill DM with the user's personal agent IF one already exists.
  // Do NOT silently auto-create one — provisioning a personal agent is
  // now an explicit opt-in step via /agent setup. Auto-creating here
  // produced ghost agents named "Minds" right after signup before the
  // user had ever gone through setup. Skip if AI is off in Settings.
  React.useEffect(() => {
    if (!sdk) return;
    if (!getPreference('aiEnabled')) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await sdk.agents.list({ limit: 50 });
        const personal = (list.data || []).find(
          (a: any) => a.agent_type === 'personal' || a.agentType === 'personal',
        );
        if (!personal || cancelled) return;
        // Open the DM AND post the intro if the thread is empty.
        // Covers accounts whose original /agent setup swallowed the
        // sendAsAgent failure, so Samson's thread is still blank.
        await ensureIntroDM(sdk, personal.id, user?.name);
        if (cancelled) return;
        invalidate('conversations');
        refresh();
      } catch (err) {
        console.warn('[chat back-fill] failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk]);

  if (activeConvoId) {
    return (
      <ConversationView
        conversationId={activeConvoId}
        onBack={() => { setActiveConvoId(null); refresh(); }}
      />
    );
  }

  const handleNewDM = async () => {
    if (!sdk || !dmUsername.trim()) return;
    setDmError(null);
    try {
      let userId: string | undefined;
      try {
        const profileRes = await sdk.profiles.getByUsername(dmUsername.trim());
        userId = profileRes.data?.id;
      } catch {
        // Try as agent username
        try {
          const agentRes = await sdk.agents.listDiscoverable({ limit: 100 });
          const agents = agentRes.data || [];
          const match = agents.find((a: any) => a.username === dmUsername.trim() || a.name?.toLowerCase() === dmUsername.trim().toLowerCase());
          userId = match?.id;
        } catch (e) { /* agent lookup failed */ }
      }
      if (!userId) { setDmError('User or agent not found. Check the username.'); return; }
      const res = await sdk.chat.dm({ user_id: userId, organization_id: ORG_ID || undefined } as any);
      if (res.data?.id) {
        // Force the sidebar's conversation list to refetch immediately so the
        // new thread appears without waiting for the WS round-trip or a refresh.
        invalidate('conversations');
        setActiveConvoId(res.data.id);
        setShowNewChat(false);
        setDmUsername('');
        setDmError(null);
      }
    } catch {
      setDmError('Could not start conversation.');
    }
  };

  return (
    <Container safeTop padded={false}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.borderSubtle,
        }}
      >
        <Text variant="h3">Messages</Text>
        <Pressable onPress={() => setShowNewChat(!showNewChat)} hitSlop={8}>
          <Ionicons name="create-outline" size={22} color={colors.accent} />
        </Pressable>
      </View>

      {/* New chat */}
      {showNewChat && (
        <>
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.sm,
              padding: spacing.xl,
              borderBottomWidth: 0.5,
              borderBottomColor: colors.borderSubtle,
            }}
          >
            <TextInput
              placeholder="Username or agent name..."
              placeholderTextColor={colors.textMuted}
              value={dmUsername}
              onChangeText={(t) => { setDmUsername(t); setDmError(null); }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              onSubmitEditing={handleNewDM}
              // Discourage password managers (Bitwarden, 1Password) from
              // matching this as a username/identity field. RN Web maps
              // these props to native HTML attrs.
              {...(Platform.OS === 'web' ? { 'data-form-type': 'other', 'data-lpignore': 'true', name: 'chat-search' } as any : {})}
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderWidth: 0.5,
                borderColor: dmError ? colors.error : colors.glassBorder,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: 10,
                color: colors.text,
                ...typography.body,
                ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
              }}
            />
            <Button onPress={handleNewDM} size="sm" disabled={!dmUsername.trim()}>
              Start
            </Button>
          </View>
          {dmError && (
            <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}>
              <Text variant="caption" color={colors.error}>{dmError}</Text>
            </View>
          )}
        </>
      )}

      {loading ? (
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          {[1, 2, 3].map(i => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <Skeleton width={48} height={48} borderRadius={24} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Skeleton width={140} height={14} />
                <Skeleton width="80%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : conversations.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
          <Ionicons name="chatbubbles-outline" size={40} color={colors.accent} />
          <Text variant="h2" color={colors.text} align="center">
            Messages
          </Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
            Start a conversation with someone or chat with an agent.
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            Direct messages and group chats
          </Text>
          <Button onPress={() => setShowNewChat(true)} size="sm" style={{ marginTop: spacing.md }}>
            Start a conversation
          </Button>
        </View>
      ) : (
        <FlatList
          data={(conversations || []).filter((c: any) => {
            // Match the SideNav orphan filter: skip one-on-ones with
            // no resolvable other participant (ghost-agent leftovers).
            const participants: any[] = c.participants || c.members || [];
            const others = participants.filter((p: any) => (p?.id ?? p?.userId) && (p?.id ?? p?.userId) !== user?.id);
            const type = c.type || (others.length <= 1 ? 'one_on_one' : 'group');
            if (type === 'one_on_one' && others.length === 0) return false;
            return true;
          })}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const other = item.participants?.find((p: any) => p.id !== user?.id) || item.participants?.[0];
            const name = item.name || other?.name || 'Conversation';
            const avatar = other?.image || null;
            const isAgentConvo = isAiActor(other);
            const lastMsg = item.lastMessage || item.last_message;
            const lastText = lastMsg?.content || lastMsg?.text || '';
            const time = lastMsg?.createdAt || lastMsg?.created_at || item.updatedAt || '';
            const unread = conversationUnreadCount(item);

            return (
              <Pressable
                onPress={() => setActiveConvoId(item.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingHorizontal: spacing.xl,
                  paddingVertical: spacing.lg,
                  backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                })}
              >
                <Avatar uri={avatar} name={name} size="lg" />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                      <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>{name}</Text>
                      {isAgentConvo && (
                        <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.xs + 2, paddingVertical: 1, borderRadius: 4 }}>
                          <Text variant="caption" color={colors.accent} style={{ fontSize: 9 }}>AI</Text>
                        </View>
                      )}
                    </View>
                    {time ? (
                      <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>
                        {(() => {
                          // iMessage-style relative time: now / 5m / 2h /
                          // Wed (this week) / Apr 21 (older).
                          const t = new Date(time);
                          const diff = Math.floor((Date.now() - t.getTime()) / 1000);
                          if (diff < 60) return 'now';
                          if (diff < 3600) return `${Math.floor(diff / 60)}m`;
                          if (diff < 86_400) return `${Math.floor(diff / 3600)}h`;
                          if (diff < 7 * 86_400) return t.toLocaleDateString([], { weekday: 'short' });
                          return t.toLocaleDateString([], { month: 'short', day: 'numeric' });
                        })()}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 }}>
                    <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
                      {lastText || 'No messages yet'}
                    </Text>
                    {unread > 0 && (
                      <View
                        style={{
                          backgroundColor: colors.accent,
                          borderRadius: radius.full,
                          minWidth: 20,
                          height: 20,
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingHorizontal: 6,
                        }}
                      >
                        <Text variant="caption" color={colors.textOnAccent} style={{ fontSize: 11, fontWeight: '700' }}>{unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Container>
  );
}

// Three dots that pulse in sequence while the agent is composing a
// reply. Generic CSS animation on web, RN Animated on native.
function TypingIndicator() {
  const colors = useColors();
  const dot = (delay: number, key: number) => (
    <View
      key={key}
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.textMuted,
        ...(Platform.OS === 'web'
          ? ({
              animationName: 'mindsTypingPulse',
              animationDuration: '1200ms',
              animationIterationCount: 'infinite',
              animationDelay: `${delay}ms`,
            } as any)
          : {}),
      }}
    />
  );
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
      }}
    >
      {Platform.OS === 'web' && (
        <style>{`
          @keyframes mindsTypingPulse {
            0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
            40% { opacity: 1; transform: translateY(-2px); }
          }
        `}</style>
      )}
      {dot(0, 0)}
      {dot(200, 1)}
      {dot(400, 2)}
    </View>
  );
}

function ConversationView({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { sdk, user } = useAuth();
  const colors = useColors();
  const setActiveConvoId = useSetActiveConvoId();
  // Track focus. Two things hang off it: (1) marking this conversation active so
  // the SideNav suppresses its unread dot only for the thread you're reading, and
  // (2) gating mark-as-read below. Expo-router keeps tab screens mounted, so an
  // unmount-based cleanup never fired on a tab switch — focus/blur is the correct
  // signal for "am I actually looking at this thread right now."
  const [screenFocused, setScreenFocused] = React.useState(true);
  useFocusEffect(
    React.useCallback(() => {
      setScreenFocused(true);
      setActiveConvoId(conversationId);
      return () => { setScreenFocused(false); setActiveConvoId(null); };
    }, [conversationId, setActiveConvoId])
  );
  const cachedMsgs = getCached(`messages:${conversationId}`);
  const cachedSorted = React.useMemo(() => {
    if (!cachedMsgs) return [];
    return [...cachedMsgs].reverse().map((m: any) => ({
      id: m.id,
      content: (m.content || m.text || '').trim(),
      sender: m.sender || { id: m.senderId || m.sender_id, name: m.senderName },
      createdAt: m.createdAt || m.created_at || new Date().toISOString(),
    })).filter((m: any) => m.content); // never render empty bubbles
  }, [cachedMsgs]);
  const [messages, setMessages] = React.useState<any[]>(cachedSorted);
  const [loading, setLoading] = React.useState(cachedSorted.length === 0);
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [agentTyping, setAgentTyping] = React.useState(false);
  const [agentStatus, setAgentStatus] = React.useState<'thinking' | 'generating' | 'done' | null>(null);
  const [humanTyping, setHumanTyping] = React.useState<{ userId: string; userName: string } | null>(null);
  const flatListRef = React.useRef<FlatList>(null);
  // Throttle outbound chat_typing events. Fires every 3s while the
  // user is actively typing, not on every keystroke (which would
  // hammer the WS and the other side's UI).
  const lastTypingEmitRef = React.useRef(0);
  // Try to get partner info from cached conversation list for instant name
  const cachedConvo = React.useMemo(() => {
    const convos = getCached('conversations') || [];
    return convos.find((c: any) => c.id === conversationId);
  }, [conversationId]);
  const cachedOther = React.useMemo(() => {
    if (!cachedConvo) return null;
    // Read members too (the conversation-list DTO uses `members`, which carry
    // is_ai) so the agent/bubble styling is correct from the cache and doesn't
    // flip once the detail fetch resolves.
    const parts = cachedConvo.participants || cachedConvo.members || [];
    return parts.find((p: any) => (p.id ?? p.userId) !== user?.id) || parts[0] || null;
  }, [cachedConvo, user?.id]);
  const [partnerName, setPartnerName] = React.useState<string>(
    cachedConvo?.name || cachedOther?.name || 'Conversation'
  );
  const [partnerInfo, setPartnerInfo] = React.useState<any>(cachedOther || null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const messageIdsRef = React.useRef<Set<string>>(new Set(cachedSorted.map((m: any) => m.id)));

  // Scroll-position handling. We only auto-stick to the bottom when the user
  // is already there — so an incoming message or a streaming reply never yanks
  // them away from history they're reading. When they're scrolled up we surface
  // a "jump to latest" affordance instead (Claude / iMessage behaviour).
  const atBottomRef = React.useRef(true);
  const [showJump, setShowJump] = React.useState(false);
  const stickToBottom = React.useCallback((animated = false) => {
    atBottomRef.current = true;
    setShowJump(false);
    requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated }));
  }, []);
  const handleScroll = React.useCallback((e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const near = distanceFromBottom < 120;
    atBottomRef.current = near;
    setShowJump(prev => (prev === !near ? prev : !near));
  }, []);

  // This component is intentionally NOT remounted on thread switch (no key) —
  // remounting churned the socket subscription + re-flipped the agent styling +
  // re-scrolled, which read as nasty bugs when navigating quickly. Instead,
  // reset the view from the NEW thread's cache here so we never linger on the
  // previous thread's messages. The network load effect below then reconciles.
  const convoIdRef = React.useRef(conversationId);
  React.useEffect(() => {
    if (convoIdRef.current === conversationId) return;
    convoIdRef.current = conversationId;
    setMessages(cachedSorted);
    messageIdsRef.current = new Set(cachedSorted.map((m: any) => m.id));
    setLoading(cachedSorted.length === 0);
    setPartnerName(cachedConvo?.name || cachedOther?.name || 'Conversation');
    setPartnerInfo(cachedOther || null);
    atBottomRef.current = true;
    setShowJump(false);
  }, [conversationId, cachedSorted, cachedConvo, cachedOther]);

  // Agent conversations render Claude-style (full-width assistant text);
  // human DMs keep iMessage bubbles on both sides.
  const isAgentChat = !!(
    partnerInfo?.isAi || partnerInfo?.is_ai
    || partnerInfo?.user?.isAi || partnerInfo?.user?.is_ai
    || partnerInfo?.type === 'agent' || partnerInfo?.user?.type === 'agent'
  );

  // Load conversation info + messages in PARALLEL (not sequential)
  React.useEffect(() => {
    if (!sdk) return;
    let cancelled = false;

    // Fetch details and messages at the same time
    const detailsPromise = sdk.chat.conversation(conversationId).catch(() => null);
    const messagesPromise = sdk.chat.messages(conversationId, { limit: 50 }).catch(() => null);

    Promise.all([detailsPromise, messagesPromise]).then(([convoRes, msgRes]) => {
      if (cancelled) return;

      // Process conversation details
      if (convoRes) {
        const convo = convoRes.data as any;
        const participants = convo?.participants || convo?.members || [];
        const other = participants.find((p: any) => {
          const pId = p.id || p.user?.id || p.userId;
          return pId !== user?.id;
        });
        const name = other?.name || other?.user?.name || convo?.name || 'Conversation';
        setPartnerName(name);
        setPartnerInfo(other);
      }

      // Process messages
      if (msgRes) {
        const rawMessages = msgRes.data || [];
        setCache(`messages:${conversationId}`, rawMessages);
        const sorted = [...rawMessages].reverse().map((m: any) => ({
          id: m.id,
          content: (m.content || m.text || '').trim(),
          sender: m.sender || { id: m.senderId || m.sender_id, name: m.senderName },
          createdAt: m.createdAt || m.created_at || new Date().toISOString(),
        })).filter((m: any) => m.content); // never render empty bubbles (tool-only agent turns)
        setMessages(sorted);
        messageIdsRef.current = new Set(sorted.map((m: any) => m.id));
      }

      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [conversationId, sdk, user?.id]);

  // Real-time messages via WebSocket, fall back to polling
  const wsConnectedRef = React.useRef(false);

  React.useEffect(() => {
    if (!sdk) return;
    let unsub: (() => void) | undefined;

    // ONE stable subscription per conversation. Previously this effect also
    // depended on `loading`, so it tore down and rebuilt the socket listener
    // every time a load started/finished — the churn that made the chat feel
    // like it might break on every click. Messages arriving during the initial
    // load are deduped by id, so subscribing immediately is safe.
    (async () => {
      try {
        await sdk.realtime.connect();
        sdk.realtime.joinConversation(conversationId);
        wsConnectedRef.current = true;

        unsub = sdk.realtime.onMessage((msg: any) => {
          if (msg.conversationId !== conversationId) return;
          const senderId = msg.sender?.id || msg.senderId;

          // Skip the echo of your OWN messages. The server fans every message to
          // both the conversation room and each member's user room, and your
          // socket is in both — so your own send echoes back, sometimes with an
          // id that doesn't match the optimistic/reconciled row, producing a
          // duplicate. Your sent message is already shown optimistically and
          // reconciled from the send response; the WS path is only for inbound.
          if (senderId && senderId === user?.id) return;

          const msgContent = (msg.text || msg.content || '').trim();
          if (!msgContent) return; // Skip blank messages (tool calls)

          const newMsg = {
            id: msg.id,
            content: msgContent,
            sender: msg.sender || { id: senderId, name: msg.senderName },
            createdAt: msg.createdAt || new Date().toISOString(),
          };
          if (messageIdsRef.current.has(newMsg.id)) return;
          messageIdsRef.current.add(newMsg.id);

          // Only clear typing indicator for non-own messages (agent replied)
          if (senderId !== user?.id) {
            setAgentTyping(false);
          }

          setMessages(prev => {
            // Drop any optimistic row whose content matches the
            // incoming server row. Covers two cases:
            //   - `agent-*` ids from the SSE fallback when a user
            //     was chatting with an agent and WS wasn't yet ready.
            //   - `temp-*` ids from the user's own send-side
            //     optimistic insert (added today for snappy feel).
            //     Without this filter the temp row sticks around and
            //     the WS row gets added too → message renders twice.
            const incomingContent = newMsg.content?.trim();
            const incomingSenderId = newMsg.sender?.id;
            const filtered = prev.filter(m => {
              // Optimistic placeholders: 'temp-*' (user send), 'agent-*'
              // (SSE fallback append), 'streaming-*' (live agent stream).
              // Drop any whose content matches the WS-arrived row.
              const isOptimistic = m.id.startsWith('temp-')
                || m.id.startsWith('agent-')
                || m.id.startsWith('streaming-');
              if (!isOptimistic) return true;
              if (m.content?.trim() !== incomingContent) return true;
              const optimisticSenderId = m.sender?.id;
              if (!optimisticSenderId || !incomingSenderId) return false;
              return optimisticSenderId !== incomingSenderId;
            });
            const byId = new Map<string, any>();
            for (const m of filtered) byId.set(m.id, m);
            byId.set(newMsg.id, newMsg);
            return Array.from(byId.values()).sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });
        });
      } catch {
        // WebSocket failed — fall back to polling
        wsConnectedRef.current = false;
      }
    })();

    return () => {
      unsub?.();
      if (wsConnectedRef.current) {
        sdk.realtime.leaveConversation(conversationId);
      }
    };
  }, [conversationId, sdk]);

  // Rich agent thinking state. Server emits `agent_thinking` events
  // with status ('thinking' | 'generating' | 'done') during a stream.
  // Surface them in the ThinkingPill below the message list.
  React.useEffect(() => {
    if (!sdk) return;
    let unsub: (() => void) | undefined;
    let stuckTimer: ReturnType<typeof setTimeout> | null = null;
    const clearStuckTimer = () => { if (stuckTimer) { clearTimeout(stuckTimer); stuckTimer = null; } };
    (async () => {
      try {
        await sdk.realtime.connect();
        unsub = sdk.realtime.onAgentThinking?.((evt: any) => {
          if (evt?.conversationId && evt.conversationId !== conversationId) return;
          if (evt?.status === 'done' || evt?.status === 'error') {
            setAgentStatus('done');
            setAgentTyping(false);
            clearStuckTimer();
          } else {
            setAgentStatus(evt?.status ?? 'thinking');
            setAgentTyping(true);
            // Safety net: best-in-class typing indicators always auto-expire.
            // If the server dies mid-stream or hits an error path that never
            // emits a terminal event, this clears the indicator instead of
            // letting it spin forever. Reset on each new activity event.
            clearStuckTimer();
            stuckTimer = setTimeout(() => setAgentTyping(false), 30000);
          }
        });
      } catch {}
    })();
    return () => { unsub?.(); clearStuckTimer(); };
  }, [conversationId, sdk]);

  // Bidirectional human typing indicator.
  // Subscribe to `chat_typing` events for THIS conversation and render
  // a "X is typing…" pill below the list. Emit our own on debounced
  // user input below.
  React.useEffect(() => {
    if (!sdk) return;
    let unsub: (() => void) | undefined;
    let clearTimer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      try {
        await sdk.realtime.connect();
        unsub = sdk.realtime.onTyping?.((evt: any) => {
          if (evt?.conversationId !== conversationId) return;
          if (evt?.userId === user?.id) return;
          if (evt?.isTyping) {
            setHumanTyping({ userId: evt.userId, userName: evt.userName || 'Someone' });
            if (clearTimer) clearTimeout(clearTimer);
            // Auto-clear after 5s of no further typing events.
            clearTimer = setTimeout(() => setHumanTyping(null), 5000);
          } else {
            setHumanTyping(null);
          }
        });
      } catch {}
    })();
    return () => {
      unsub?.();
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, [conversationId, sdk, user?.id]);

  // Fallback polling — only if WebSocket didn't connect. Stable per
  // conversation (no `loading` dep, which used to restart the interval on every
  // load transition).
  React.useEffect(() => {
    if (!sdk) return;

    // Wait a moment for WS to connect before starting poll
    const startTimer = setTimeout(() => {
      if (wsConnectedRef.current) return; // WS connected, no need to poll

      let pollInFlight = false;
      pollRef.current = setInterval(async () => {
        // Skip if the previous poll hasn't returned — under load a slow
        // response must not let 5s-spaced requests pile up and stampede.
        if (pollInFlight) return;
        pollInFlight = true;
        try {
          const msgRes = await sdk.chat.messages(conversationId, { limit: 20 });
          const rawMessages = msgRes.data || [];
          rawMessages.forEach((m: any) => messageIdsRef.current.add(m.id));
          const allServerMsgs = rawMessages.reverse().map((m: any) => ({
            id: m.id,
            content: (m.content || m.text || '').trim(),
            sender: m.sender || { id: m.senderId || m.sender_id, name: m.senderName },
            createdAt: m.createdAt || m.created_at || new Date().toISOString(),
          })).filter((m: any) => m.content); // Skip blank messages

          setMessages(allServerMsgs);
        } catch {} finally { pollInFlight = false; }
      }, 5000);

    }, 2000); // Wait 2s for WS to connect before falling back to polling

    return () => {
      clearTimeout(startTimer);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [conversationId, sdk]);

  // Mark as read — ONLY while the screen is actually focused. If the agent's
  // reply streams in while you're on another tab (this screen stays mounted),
  // marking it read in the background would advance the server cursor and the
  // unread dot would vanish on the next refresh. Gating on focus keeps the
  // thread genuinely unread until you come back and look at it.
  React.useEffect(() => {
    if (!screenFocused) return;
    if (sdk && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.id && !lastMsg.id.startsWith('temp-') && !lastMsg.id.startsWith('agent-') && !lastMsg.id.startsWith('streaming-')) {
        sdk.chat.markAsRead(conversationId, { message_id: lastMsg.id }).catch(() => {});
      }
    }
  }, [conversationId, sdk, messages, screenFocused]);

  const handleSend = async () => {
    if (!text.trim() || !sdk) return;
    const messageText = text.trim();
    setText('');
    setSending(true);
    // Sending always pins you to the bottom — you want to see your own
    // message and the reply that follows.
    stickToBottom(true);

    // Optimistic insert FIRST so the message appears the instant the
    // user hits send — no waiting on the server round-trip. Reconciled
    // with the real server id when the response lands. iMessage feel.
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempId,
      content: messageText,
      sender: { id: user?.id, name: user?.name },
      createdAt: new Date().toISOString(),
      pending: true,
    }]);

    try {
      const otherId = partnerInfo?.id || partnerInfo?.user?.id || partnerInfo?.userId;
      const otherName = partnerInfo?.name || partnerInfo?.user?.name || 'Agent';
      const isAgent = partnerInfo?.isAi || partnerInfo?.is_ai
        || partnerInfo?.user?.isAi || partnerInfo?.user?.is_ai
        || partnerInfo?.type === 'agent' || partnerInfo?.user?.type === 'agent';

      // Persist the user message. For AGENT chats the streaming endpoint below
      // (/agents/:id/chat/stream) inserts the user message itself — so calling
      // chat.send too stored it TWICE, which is the duplicate that reappeared
      // after refresh. Only call chat.send for human DMs; for agents just clear
      // the optimistic row's pending state and let chatStream persist it.
      if (!isAgent) {
        const sendRes = await sdk.chat.send({ conversation_id: conversationId, content: messageText });
        const serverMsgId = sendRes?.data?.id;
        if (serverMsgId) {
          messageIdsRef.current.add(serverMsgId);
          setMessages(prev => prev.map(m => m.id === tempId
            ? { ...m, id: serverMsgId, pending: false }
            : m));
        } else {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, pending: false } : m));
        }
      } else {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, pending: false } : m));
      }

      // Agent reply path. The server's POST /chat/messages does NOT
      // auto-trigger an agent response — the client is responsible
      // for kicking off /agents/:id/chat/stream when the recipient
      // is an agent.
      //
      // Streaming render: insert a placeholder bubble immediately
      // ('streaming: true') and append text_delta chunks to it as
      // they arrive. The bubble shows a blinking caret while
      // streaming. Net effect: Claude-style typed-out reply instead
      // of a long pause followed by a paste.
      if (isAgent && otherId) {
        const streamingId = `streaming-${Date.now()}`;
        setMessages(prev => [...prev, {
          id: streamingId,
          content: '',
          sender: { id: otherId, name: otherName, is_ai: true },
          createdAt: new Date().toISOString(),
          streaming: true,
        }]);
        let acc = '';
        let streamedAny = false;
        // Coalesce token writes to at most one render per animation frame.
        // Streaming a reply emits dozens of text_deltas per second; writing
        // each one straight to state re-rendered the whole list AND re-parsed
        // the bubble's markdown every token — that thrash is what made the
        // stream stutter and the scroll lurch. Buffering into `acc` and
        // flushing on requestAnimationFrame pins the growth to the browser's
        // paint clock, so it types out smoothly the way Claude does.
        let rafPending = false;
        const flushStreaming = () => {
          rafPending = false;
          setMessages(prev => prev.map(m => m.id === streamingId
            ? { ...m, content: acc }
            : m));
        };
        try {
          // chatStream() is an async generator yielding text_delta
          // chunks. Requires ReadableStream — available on web and on
          // RN 0.72+. Fall back to chatStreamText() if the platform
          // can't iterate.
          const stream = sdk.agents.chatStream(otherId, {
            message: messageText,
            ...(conversationId ? { conversation_id: conversationId } : {}),
          });
          for await (const chunk of stream) {
            if (chunk?.type === 'text_delta' && typeof chunk.delta === 'string') {
              acc += chunk.delta;
              streamedAny = true;
              if (!rafPending) {
                rafPending = true;
                requestAnimationFrame(flushStreaming);
              }
            }
          }
          // Mark complete. Also write the final `acc` directly — a frame may
          // still have been pending when the stream ended, so this guarantees
          // the last tokens land. WS broadcast of the final stored message may
          // arrive after this; the dedup in the onMessage handler (content +
          // sender match for agent-* / streaming-* ids) drops it.
          setMessages(prev => prev.map(m => m.id === streamingId
            ? { ...m, content: acc, streaming: false }
            : m));
        } catch (streamErr) {
          console.warn('[chat] agent stream failed, falling back to chatStreamText', streamErr);
          if (!streamedAny) {
            try {
              const result = await sdk.agents.chatStreamText(otherId, {
                message: messageText,
                ...(conversationId ? { conversation_id: conversationId } : {}),
              });
              if (result?.content) {
                setMessages(prev => prev.map(m => m.id === streamingId
                  ? { ...m, content: result.content, streaming: false }
                  : m));
                streamedAny = true;
              }
            } catch {}
          }
        }
        if (!streamedAny) {
          // Last-ditch fallback to non-streaming chat endpoint.
          try {
            const agentRes = await sdk.agents.chat(otherId, {
              message: messageText,
              ...(conversationId ? { conversation_id: conversationId } : {}),
            });
            const agentData = agentRes?.data || agentRes;
            const reply = (agentData as any)?.content
              || (agentData as any)?.message
              || (agentData as any)?.response
              || (typeof agentData === 'string' ? agentData : null);
            if (reply) {
              setMessages(prev => prev.map(m => m.id === streamingId
                ? { ...m, content: reply, streaming: false }
                : m));
              streamedAny = true;
            }
          } catch (err) {
            console.warn('[chat] agent fallback also failed', err);
          }
        }
        // If the agent produced no text at all (a tool-only turn that errored,
        // or a server error path), REMOVE the empty placeholder rather than
        // leaving a blank bubble. Any real reply or error the server stored
        // arrives via the WS echo as its own row.
        if (!streamedAny) {
          setMessages(prev => prev.filter(m => m.id !== streamingId));
        }
        setAgentTyping(false);
      }
    } catch (err) {
      // Send failed — mark the temp row as failed so the user knows.
      setMessages(prev => prev.map(m => m.id === tempId
        ? { ...m, pending: false, failed: true }
        : m));
      captureException(err, { action: 'chat_send', conversationId });
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.borderSubtle,
        }}
      >
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Avatar uri={partnerInfo?.image || partnerInfo?.user?.image} name={partnerName} size="sm" />
        <Text variant="h3" style={{ flex: 1 }} numberOfLines={1}>{partnerName}</Text>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Skeleton width={200} height={14} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const senderId = item.sender?.id || item.senderId || item.sender_id;
            return <ChatBubble message={item} isOwn={senderId === user?.id} agentChat={isAgentChat} />;
          }}
          contentContainerStyle={{
            paddingVertical: spacing.xl,
            // Inset the message column to line up with the input field's TEXT
            // (input row xl + input inner lg = 36), so the full-width agent reply
            // doesn't cram against the sidebar on the left or bleed to the far
            // right edge — it reads in the same column you type in.
            paddingHorizontal: spacing.xl + spacing.lg,
            flexGrow: 1,
            justifyContent: messages.length === 0 ? 'center' : 'flex-end',
          }}
          onScroll={handleScroll}
          // 16ms (~60fps) so the at-bottom test tracks fast streaming growth
          // instead of lagging behind it at 100ms.
          scrollEventThrottle={16}
          // Only follow new content when the user is already at the bottom, so
          // streaming tokens / incoming messages never interrupt scroll-back.
          // On web we set scrollTop synchronously in the same layout pass the
          // content grew (no animated post-paint catch-up frame) — that catch-up
          // is exactly what read as a jump. Native keeps scrollToEnd.
          onContentSizeChange={() => {
            if (!atBottomRef.current) return;
            const node: any = (flatListRef.current as any)?.getScrollableNode?.();
            if (node && typeof node.scrollHeight === 'number') node.scrollTop = node.scrollHeight;
            else flatListRef.current?.scrollToEnd({ animated: false });
          }}
          ListFooterComponent={
            <>
              <ThinkingPill
                visible={agentTyping}
                status={agentStatus}
                agentName={partnerInfo?.name || partnerInfo?.user?.name || 'Agent'}
              />
              {humanTyping ? (
                <View style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
                  <Text variant="caption" color={colors.textMuted} style={{ fontStyle: 'italic' }}>
                    {humanTyping.userName} is typing…
                  </Text>
                </View>
              ) : null}
            </>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center' }}>
              <Text variant="body" color={colors.textMuted}>Start the conversation</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Jump to latest — appears only when scrolled up, so streaming/incoming
          messages never force the viewport down while you're reading back. */}
      {showJump && !loading && (
        <Pressable
          onPress={() => stickToBottom(true)}
          style={({ pressed }) => ({
            position: 'absolute',
            alignSelf: 'center',
            bottom: 84,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radius.full,
            backgroundColor: colors.surfaceRaised,
            borderWidth: 0.5,
            borderColor: colors.borderSubtle,
            opacity: pressed ? 0.85 : 1,
            ...(Platform.OS === 'web' ? { cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' } as any : {}),
          })}
        >
          <Ionicons name="arrow-down" size={15} color={colors.text} />
          <Text variant="caption" color={colors.text}>Latest</Text>
        </Pressable>
      )}

      {/* Slash-command suggestions — only shown in agent conversations
          when the user has typed "/" at the start. The commands route to
          natural-language prompt prefixes the agent can handle today.
          Real first-class actions (true /save, /find with structured
          handlers) are next-session work. */}
      {(() => {
        const isAgent = partnerInfo?.isAi || partnerInfo?.is_ai
          || partnerInfo?.user?.isAi || partnerInfo?.user?.is_ai
          || partnerInfo?.type === 'agent' || partnerInfo?.user?.type === 'agent';
        if (!isAgent) return null;
        if (!text.startsWith('/')) return null;
        const COMMANDS: { name: string; hint: string; prompt: string }[] = [
          { name: '/find', hint: 'Find anything you\'ve seen before or want to know about', prompt: '/find ' },
          { name: '/summarize', hint: 'Summarize a URL, article, or recent thread', prompt: '/summarize ' },
          { name: '/save', hint: 'Save the last thing you sent for later', prompt: '/save ' },
          { name: '/today', hint: 'What did your agent find for you today', prompt: '/today' },
          { name: '/read', hint: 'Read me my morning brief', prompt: '/read' },
        ];
        const q = text.slice(1).toLowerCase();
        const filtered = q.length === 0 ? COMMANDS : COMMANDS.filter(c => c.name.slice(1).startsWith(q));
        if (filtered.length === 0) return null;
        return (
          <View style={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xs,
            borderTopWidth: 0.5,
            borderTopColor: colors.borderSubtle,
            backgroundColor: colors.surface,
            gap: 2,
          }}>
            {filtered.map((cmd) => (
              <Pressable
                key={cmd.name}
                onPress={() => setText(cmd.prompt)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.sm,
                  backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                })}
              >
                <Text variant="bodyMedium" color={colors.accent} style={{ minWidth: 84 }}>{cmd.name}</Text>
                <Text variant="caption" color={colors.textMuted} style={{ flex: 1 }} numberOfLines={1}>{cmd.hint}</Text>
              </Pressable>
            ))}
          </View>
        );
      })()}

      {/* Input */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: spacing.sm,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderTopWidth: 0.5,
          borderTopColor: colors.borderSubtle,
          paddingBottom: insets.bottom || spacing.md,
        }}
      >
        <TextInput
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={(t) => {
            setText(t);
            // Emit chat_typing at most once every 3s while the user is
            // actively typing. Other members see "X is typing…" below
            // the message list.
            if (sdk && conversationId && t.trim().length > 0) {
              const now = Date.now();
              if (now - lastTypingEmitRef.current > 3000) {
                lastTypingEmitRef.current = now;
                try { sdk.realtime.sendTyping?.(conversationId); } catch {}
              }
            }
          }}
          multiline
          onKeyPress={(e: any) => {
            if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderWidth: 0.5,
            borderColor: colors.glassBorder,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            color: colors.text,
            maxHeight: 100,
            ...typography.body,
            ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
          }}
        />
        <Pressable
          onPress={handleSend}
          disabled={!text.trim() || sending}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: text.trim() ? (pressed ? colors.accentHover : colors.accent) : colors.surfaceHover,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Ionicons name="send" size={18} color={text.trim() ? colors.textOnAccent : colors.textMuted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
