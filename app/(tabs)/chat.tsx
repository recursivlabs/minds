import * as React from 'react';
import { View, FlatList, Pressable, TextInput, KeyboardAvoidingView, Platform, useWindowDimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Avatar, Skeleton, ChatBubble, Button, AgentBadge } from '../../components';
import { MessageActions } from '../../components/MessageActions';
import { formatTimestamp, formatDayLabel, isNewDay } from '../../lib/time';
import { useVoiceRecorder } from '../../lib/useVoiceRecorder';
import * as Clipboard from 'expo-clipboard';
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
import { connectRealtime } from '../../lib/realtime';
import { conversationUnreadCount, isAiActor } from '../../lib/models';
import { stripMarkdown } from '../../lib/text';
import { resolvePersonalAgent } from '../../lib/resolvePersonalAgent';
import { publishLocalChat } from '../../lib/chatEvents';

export default function ChatScreen() {
  const { sdk, user } = useAuth();
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; focused?: string }>();
  const { width } = useWindowDimensions();
  const { conversations, loading, refresh } = useConversations();
  // Two-pane (list + open thread, X/iMessage-style) only on wide web. `focused`
  // is set when you deep-link a thread from the sidebar inbox — that inbox WAS
  // the list, so a second list column is redundant; show the thread full-bleed.
  const isWide = Platform.OS === 'web' && width >= 1000;
  const focusedMode = !!params.focused && !!params.id;
  const [activeConvoId, setActiveConvoId] = React.useState<string | null>(params.id || null);
  const [showNewChat, setShowNewChat] = React.useState(false);
  const [convoSearch, setConvoSearch] = React.useState('');
  // Conversations opened this session → their list unread badge clears
  // immediately (the open thread also marks read server-side; this bridges the
  // gap until the refetch, so a thread you're actively in never shows unread).
  const [readConvos, setReadConvos] = React.useState<Set<string>>(new Set());
  const openConvo = React.useCallback((id: string) => {
    setActiveConvoId(id);
    setReadConvos((prev) => prev.has(id) ? prev : new Set(prev).add(id));
  }, []);
  const [dmUsername, setDmUsername] = React.useState('');
  const [dmError, setDmError] = React.useState<string | null>(null);

  // Open conversation from route params
  React.useEffect(() => {
    if (params.id && params.id !== activeConvoId) {
      setActiveConvoId(params.id);
    }
  }, [params.id]);

  // Any active conversation counts as locally read (deep-link or selection).
  React.useEffect(() => {
    if (activeConvoId) setReadConvos((p) => p.has(activeConvoId) ? p : new Set(p).add(activeConvoId));
  }, [activeConvoId]);

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
        await connectRealtime(sdk);
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
        const personal = await resolvePersonalAgent(sdk);
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

  // Full-bleed single thread when deep-linked from the sidebar inbox
  // (focusedMode), or on mobile/narrow where a 2-pane layout doesn't fit. On
  // wide web without `focused`, fall through to the 2-pane list+thread below.
  if (activeConvoId && (focusedMode || !isWide)) {
    return (
      <ConversationView
        conversationId={activeConvoId}
        onBack={() => {
          // From a sidebar deep-link, "back" opens the full 2-pane list; on
          // mobile it just returns to the list in place.
          if (focusedMode) router.push('/(tabs)/chat' as any);
          setActiveConvoId(null);
          refresh();
        }}
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

  const listBody = (
    <>
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

      {/* Search / filter the conversation list */}
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 7 }}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            placeholder="Search messages"
            placeholderTextColor={colors.textMuted}
            value={convoSearch}
            onChangeText={setConvoSearch}
            style={{ flex: 1, color: colors.text, ...typography.body, paddingVertical: 0, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
          />
          {convoSearch ? (
            <Pressable onPress={() => setConvoSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
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
            // Filter by the search box (matches the resolved DM/group name).
            if (convoSearch.trim()) {
              const om = participants.find((p: any) => (p?.user?.id ?? p?.id ?? p?.userId) !== user?.id);
              const nm = (c.name || om?.user?.name || om?.name || om?.user?.username || om?.username || '').toLowerCase();
              if (!nm.includes(convoSearch.trim().toLowerCase())) return false;
            }
            return true;
          })}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            // Participants nest the real user under `.user` (id/name/image live
            // there). Match on the nested id too — otherwise a participant whose
            // top-level id is undefined can match the current user, picking the
            // wrong "other" and showing no avatar.
            // The conversations API returns `members` (flat {id,image}); older
            // shapes use `participants`. Read either, else no "other" resolves
            // and the avatar/name fall back to nothing.
            const members = item.participants || item.members || [];
            const other = members.find((p: any) => (p?.user?.id ?? p?.id ?? p?.userId) !== user?.id) || members[0];
            const ou = other?.user || other || {};
            const name = item.name || ou.name || other?.name || ou.username || other?.username || 'Conversation';
            const avatar = ou.image || other?.image || ou.avatar || other?.avatar || ou.profile?.image || item.image || item.avatar || null;
            const isAgentConvo = isAiActor(ou) || isAiActor(other);
            const lastMsg = item.lastMessage || item.last_message;
            const lastText = stripMarkdown(lastMsg?.content || lastMsg?.text || '');
            const time = lastMsg?.createdAt || lastMsg?.created_at || item.updatedAt || '';
            const unread = readConvos.has(item.id) ? 0 : conversationUnreadCount(item);

            return (
              <Pressable
                onPress={() => openConvo(item.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingHorizontal: spacing.xl,
                  paddingVertical: spacing.lg,
                  // In the 2-pane view, highlight the thread you're actively
                  // viewing with a soft background tint only — no hard accent
                  // bar, so the list stays clean and borderless.
                  backgroundColor: (isWide && item.id === activeConvoId)
                    ? colors.accentSubtle
                    : pressed ? colors.surfaceHover : 'transparent',
                })}
              >
                <Avatar uri={avatar} name={name} size="lg" />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                      <Text variant="bodyMedium" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Text>
                      {isAgentConvo && <AgentBadge size={12} />}
                    </View>
                    {time ? (
                      <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>
                        {formatTimestamp(time)}
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
    </>
  );

  // Wide web: two-pane layout — conversation list on the left, the open thread
  // (or a prompt to pick one) on the right. Selecting a row just swaps the right
  // pane, so the list stays put (no navigation, X/iMessage feel).
  if (isWide) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
        <View style={{ width: 360, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.borderSubtle, backgroundColor: colors.bg }}>
          <Container safeTop padded={false} style={{ flex: 1 }}>{listBody}</Container>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          {activeConvoId ? (
            <ConversationView
              conversationId={activeConvoId}
              onBack={() => { setActiveConvoId(null); refresh(); }}
              hideBack
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing.md, backgroundColor: colors.bg }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
                <Ionicons name="chatbubbles-outline" size={30} color={colors.accent} />
              </View>
              <Text variant="h3" color={colors.text} align="center">Your messages</Text>
              <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 280, lineHeight: 20 }}>
                Select a conversation from the list, or start a new one.
              </Text>
              <Button onPress={() => { setShowNewChat(true); }} size="sm" style={{ marginTop: spacing.md }}>
                New message
              </Button>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <Container safeTop padded={false}>{listBody}</Container>
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

function ConversationView({ conversationId, onBack, hideBack }: { conversationId: string; onBack: () => void; hideBack?: boolean }) {
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
  // Tap-and-hold message actions + reply state.
  const [actionMsg, setActionMsg] = React.useState<any>(null);
  const [actionPos, setActionPos] = React.useState<{ x: number; y: number } | null>(null);
  const openActions = React.useCallback((m: any, pos?: { x: number; y: number }) => { setActionMsg(m); setActionPos(pos || null); }, []);
  const [replyingTo, setReplyingTo] = React.useState<any>(null);
  // Toggle a reaction — optimistic (mirrors the server's per-emoji-per-user
  // toggle), then fire the API. Skips optimistic-only temp rows.
  const handleReact = React.useCallback((msg: any, emoji: string) => {
    if (!sdk || !msg?.id || String(msg.id).startsWith('temp-')) return;
    setMessages(prev => prev.map(m => {
      if (m.id !== msg.id) return m;
      const rx: any[] = m.reactions || [];
      const mine = rx.some(r => (r.type || r.emoji) === emoji && (r.user_id ?? r.userId) === user?.id);
      const next = mine
        ? rx.filter(r => !((r.type || r.emoji) === emoji && (r.user_id ?? r.userId) === user?.id))
        : [...rx, { type: emoji, user_id: user?.id, user_name: user?.name }];
      return { ...m, reactions: next };
    }));
    (sdk as any).chat?.reactToMessage?.(msg.id, { type: emoji }).catch(() => {});
  }, [sdk, user?.id, user?.name]);
  const handleCopyMsg = React.useCallback((msg: any) => {
    Clipboard.setStringAsync(String(msg?.content || msg?.text || '')).catch(() => {});
  }, []);
  // Resolve the quoted message for a reply, from the loaded thread.
  const resolveQuoted = React.useCallback((m: any) => {
    const rid = m?.reply_to_id || m?.replyToId;
    if (!rid) return null;
    // Prefer the server-embedded preview (survives even when the original is
    // outside the loaded window); fall back to finding it in the loaded set
    // (covers optimistic replies sent this session before the refetch).
    const embedded = m?.reply_to || m?.replyTo;
    if (embedded) {
      return { name: embedded.sender_name || embedded.senderName || '', text: String(embedded.content || '').slice(0, 90) };
    }
    const q = messages.find(x => x.id === rid);
    if (!q) return null;
    const qid = q.sender?.id || q.senderId || q.sender_id;
    return { name: qid === user?.id ? 'You' : (q.sender?.name || q.senderName || ''), text: String(q.content || q.text || '').slice(0, 90) };
  }, [messages, user?.id]);
  const [loading, setLoading] = React.useState(cachedSorted.length === 0);
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [attaching, setAttaching] = React.useState(false);
  const voice = useVoiceRecorder();
  // Prompt handed in via route params by the "Ask my agent" button / command
  // palette. We send it from HERE (via handleSend → agents.chatStream), not
  // from askAgent(), because that path used chat.send which only inserts the
  // message and never triggers the agent (no reply, not visible until refresh).
  const routeParams = useLocalSearchParams<{ prompt?: string }>();
  const router = useRouter();
  const autoSentPromptRef = React.useRef<string | null>(null);
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
  const pollInFlightRef = React.useRef(false);

  // One reconcile fetch: pull the latest server messages and MERGE them into
  // state by id. Merging (not replacing) matters: a wholesale setMessages used
  // to truncate visible history from 50 to the poll's 20 and delete optimistic
  // temp-*/streaming-* rows mid-send. Shared by the fallback poll interval and
  // the socket-reconnect catch-up.
  const fetchLatest = React.useCallback(async () => {
    if (!sdk || pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    try {
      const msgRes = await sdk.chat.messages(conversationId, { limit: 20 });
      const rawMessages = msgRes.data || [];
      rawMessages.forEach((m: any) => messageIdsRef.current.add(m.id));
      const incoming = rawMessages.reverse().map((m: any) => ({
        id: m.id,
        content: (m.content || m.text || '').trim(),
        sender: m.sender || { id: m.senderId || m.sender_id, name: m.senderName },
        createdAt: m.createdAt || m.created_at || new Date().toISOString(),
      })).filter((m: any) => m.content); // Skip blank messages
      setMessages(prev => {
        const byId = new Map<string, any>();
        for (const m of prev) byId.set(m.id, m);
        for (const m of incoming) byId.set(m.id, m);
        return Array.from(byId.values()).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
    } catch {} finally { pollInFlightRef.current = false; }
  }, [conversationId, sdk]);

  const stopPolling = React.useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startPolling = React.useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(fetchLatest, 5000);
  }, [fetchLatest]);

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
    let socket: any = null;
    let onSocketDisconnect: (() => void) | undefined;
    let onSocketConnect: (() => void) | undefined;

    // ONE stable subscription per conversation. Previously this effect also
    // depended on `loading`, so it tore down and rebuilt the socket listener
    // every time a load started/finished — the churn that made the chat feel
    // like it might break on every click. Messages arriving during the initial
    // load are deduped by id, so subscribing immediately is safe.
    (async () => {
      try {
        socket = await connectRealtime(sdk);
        sdk.realtime.joinConversation(conversationId);
        wsConnectedRef.current = true;

        // A drop must re-arm the polling fallback (the 2s boot check runs
        // once and never again), and a reconnect must re-join the server-side
        // conversation room — membership died with the old socket session —
        // then reconcile whatever arrived while offline.
        onSocketDisconnect = () => {
          wsConnectedRef.current = false;
          startPolling();
        };
        onSocketConnect = () => {
          wsConnectedRef.current = true;
          stopPolling();
          sdk.realtime.joinConversation(conversationId);
          fetchLatest();
        };
        socket?.on('disconnect', onSocketDisconnect);
        socket?.on('connect', onSocketConnect);

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
            // If a streaming row from this same sender is still on screen, it's
            // the in-progress smooth-reveal of THIS very message — let it finish
            // typing out and skip the WS echo (which carries the full text and
            // would otherwise double it mid-reveal or snap it to the end). It
            // reconciles to the real server row on the next load.
            if (prev.some(m => m.id.startsWith('streaming-') && (m.sender?.id) === newMsg.sender?.id)) {
              return prev;
            }
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
      if (onSocketDisconnect) socket?.off('disconnect', onSocketDisconnect);
      if (onSocketConnect) socket?.off('connect', onSocketConnect);
      if (wsConnectedRef.current) {
        sdk.realtime.leaveConversation(conversationId);
      }
    };
  }, [conversationId, sdk, startPolling, stopPolling, fetchLatest]);

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
        await connectRealtime(sdk);
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
        await connectRealtime(sdk);
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

    // Wait a moment for WS to connect before starting poll. This is only the
    // BOOT decision — the socket's own disconnect/connect handlers above
    // re-arm and stop polling for the rest of the conversation's life.
    const startTimer = setTimeout(() => {
      if (wsConnectedRef.current) return; // WS connected, no need to poll
      startPolling();
    }, 2000);

    return () => {
      clearTimeout(startTimer);
      stopPolling();
    };
  }, [conversationId, sdk, startPolling, stopPolling]);

  // The id of the last message we sent a markAsRead for — dedupes the effect
  // below so a streaming reply (which mutates `messages` rapidly) can't spam
  // /read. Reset when the open conversation changes so the new thread marks.
  const lastMarkedReadIdRef = React.useRef<string | null>(null);
  React.useEffect(() => { lastMarkedReadIdRef.current = null; }, [conversationId]);

  // Mark as read — ONLY while the screen is actually focused. If the agent's
  // reply streams in while you're on another tab (this screen stays mounted),
  // marking it read in the background would advance the server cursor and the
  // unread dot would vanish on the next refresh. Gating on focus keeps the
  // thread genuinely unread until you come back and look at it.
  React.useEffect(() => {
    if (!screenFocused) return;
    if (sdk && messages.length > 0) {
      // Mark read up to the latest PERSISTED message. Scan back past optimistic/
      // streaming temp rows (agent replies stream in with temp ids) — if we only
      // checked the very last row and it was a temp, we'd skip marking entirely
      // and the thread would pop back to unread after a refresh once that reply
      // persisted with a real id. When the temp later resolves to a real id, this
      // effect re-runs and advances the cursor onto it.
      let lastReal: any = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m?.id && !m.id.startsWith('temp-') && !m.id.startsWith('agent-') && !m.id.startsWith('streaming-')) {
          lastReal = m;
          break;
        }
      }
      // CRITICAL: `messages` mutates many times per second during an agent reply
      // (each streaming token re-renders). Only fire markAsRead when the newest
      // real message id ACTUALLY CHANGES — else we spam /read dozens of times per
      // conversation, burn the API rate limit (429), and the 429 (which drops CORS
      // headers) surfaces as a "CORS error" that breaks the whole chat. Dedupe by
      // the last id we marked so it fires at most once per genuinely-new message.
      if (lastReal?.id && lastReal.id !== lastMarkedReadIdRef.current) {
        lastMarkedReadIdRef.current = lastReal.id;
        sdk.chat.markAsRead(conversationId, { message_id: lastReal.id }).catch(() => {});
      }
    }
  }, [conversationId, sdk, messages, screenFocused]);

  const handleSend = async (overrideText?: string) => {
    const messageText = (typeof overrideText === 'string' ? overrideText : text).trim();
    if (!messageText || !sdk) return;
    if (typeof overrideText !== 'string') setText('');
    // Capture + clear the reply target up front so the banner dismisses instantly.
    const replyId = replyingTo?.id && !String(replyingTo.id).startsWith('temp-') ? replyingTo.id : undefined;
    setReplyingTo(null);
    setSending(true);
    // Sending always pins you to the bottom — you want to see your own
    // message and the reply that follows.
    stickToBottom(true);

    // Optimistic insert FIRST so the message appears the instant the
    // user hits send — no waiting on the server round-trip. Reconciled
    // with the real server id when the response lands. iMessage feel.
    const tempId = `temp-${Date.now()}`;
    const optimisticCreatedAt = new Date().toISOString();
    setMessages(prev => [...prev, {
      id: tempId,
      content: messageText,
      sender: { id: user?.id, name: user?.name },
      createdAt: optimisticCreatedAt,
      reply_to_id: replyId,
      pending: true,
    }]);
    // Tell the sidebar inbox NOW (not after the WS echo) so its preview text,
    // ordering, and — for a brand-new DM — the row itself update in lockstep
    // with the thread view. Reconciles against server truth on the next refetch.
    publishLocalChat({ conversationId, content: messageText, createdAt: optimisticCreatedAt });

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
        const sendRes = await sdk.chat.send({ conversation_id: conversationId, content: messageText, reply_to_id: replyId } as any);
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
        // SMOOTH STREAMING (Claude-style). The network delivers tokens in
        // irregular bursts; rendering each burst as it lands shows the network's
        // chunkiness. Instead we accumulate into `received` and reveal it via a
        // requestAnimationFrame loop that advances a `displayed` cursor toward
        // `received` at a smooth, eased cadence — fast catch-up when far behind,
        // gentle when close — so the text types out at a calm steady pace no
        // matter how bursty the stream is.
        let received = '';
        let displayed = 0;
        let streamedAny = false;
        let streamDone = false;
        let rafId: ReturnType<typeof requestAnimationFrame> | null = null;
        const renderTo = (n: number, final = false) => {
          setMessages(prev => prev.map(m => m.id === streamingId
            ? { ...m, content: received.slice(0, n), ...(final ? { streaming: false } : {}) }
            : m));
        };
        const tick = () => {
          rafId = null;
          const gap = received.length - displayed;
          if (gap > 0) {
            displayed = Math.min(received.length, displayed + Math.max(2, Math.ceil(gap * 0.2)));
            renderTo(displayed);
          }
          if (displayed < received.length) {
            rafId = requestAnimationFrame(tick);     // more to reveal
          } else if (streamDone) {
            renderTo(received.length, true);          // caught up + done → finalize
          }
          // else: caught up but stream still open → stop; the next chunk re-kicks
        };
        const kick = () => { if (rafId == null) rafId = requestAnimationFrame(tick); };

        try {
          const stream = sdk.agents.chatStream(otherId, {
            message: messageText,
            ...(conversationId ? { conversation_id: conversationId } : {}),
          });
          for await (const chunk of stream) {
            if (chunk?.type === 'text_delta' && typeof chunk.delta === 'string') {
              received += chunk.delta;
              streamedAny = true;
              kick();
            }
          }
        } catch (streamErr) {
          console.warn('[chat] agent stream failed, falling back to chatStreamText', streamErr);
          if (!streamedAny) {
            try {
              const result = await sdk.agents.chatStreamText(otherId, {
                message: messageText,
                ...(conversationId ? { conversation_id: conversationId } : {}),
              });
              if (result?.content) { received = result.content; streamedAny = true; kick(); }
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
            if (reply) { received = reply; streamedAny = true; kick(); }
          } catch (err) {
            console.warn('[chat] agent fallback also failed', err);
          }
        }
        // Stream is closed. Let the reveal loop type out the rest and finalize.
        // If nothing was produced (tool-only/errored turn), remove the empty
        // placeholder — any real reply/error the server stored arrives via the
        // WS echo as its own row.
        streamDone = true;
        if (streamedAny) {
          kick();
        } else {
          if (rafId != null) cancelAnimationFrame(rafId);
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

  // Retry a failed send: drop the failed optimistic row and re-run handleSend
  // with its original text. Mirrors iMessage's tap-to-retry on a "Not
  // delivered" bubble.
  // Attachment: pick image/video → upload to R2 → send the URL as the message.
  // The bubble detects the media URL and renders it inline (like the feed).
  const handleAttach = React.useCallback(async () => {
    if (!sdk || attaching) return;
    try {
      const picker: any = await import('expo-image-picker');
      const res = await picker.launchImageLibraryAsync({ mediaTypes: picker.MediaTypeOptions.All, quality: 0.85 });
      if (res.canceled || !res.assets?.length) return;
      setAttaching(true);
      const asset = res.assets[0];
      const contentType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
      const blob = await (await fetch(asset.uri)).blob();
      const up = await (sdk as any).uploads.getMediaUploadUrl({ content_type: contentType, content_length: blob.size });
      const uploadUrl = up?.data?.upload_url || up?.data?.url;
      if (!uploadUrl) return;
      const put = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });
      if (!put.ok) return;
      const publicUrl = up?.data?.public_url || String(uploadUrl).split('?')[0];
      await handleSend(publicUrl);
    } catch {}
    finally { setAttaching(false); }
  }, [sdk, attaching]);

  // Voice notes (web MediaRecorder). Stop the recording, upload the audio blob
  // through the same media-upload flow as attachments, and send the resulting
  // URL — the server maps audio/webm -> .weba so it renders as an audio note.
  const handleSendVoice = React.useCallback(async () => {
    if (!sdk) return;
    const rec = await voice.stop();
    if (!rec || rec.durationMs < 700) return; // ignore accidental sub-second taps
    setAttaching(true);
    try {
      const up = await (sdk as any).uploads.getMediaUploadUrl({ content_type: rec.mime, content_length: rec.blob.size });
      const uploadUrl = up?.data?.upload_url || up?.data?.url;
      if (!uploadUrl) return;
      const put = await fetch(uploadUrl, { method: 'PUT', body: rec.blob, headers: { 'Content-Type': rec.mime } });
      if (!put.ok) return;
      const publicUrl = up?.data?.public_url || String(uploadUrl).split('?')[0];
      await handleSend(publicUrl);
    } catch {}
    finally { setAttaching(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk]);

  const retryMessage = React.useCallback((msg: any) => {
    const body = (msg?.content || '').trim();
    if (!body) return;
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    void handleSend(body);
    // handleSend is stable enough for this purpose; intentionally not in deps to
    // avoid re-creating the callback on every keystroke-driven render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire a route-param prompt once the recipient is resolved (so agent
  // detection + agents.chatStream work). Runs once per distinct prompt, then
  // clears it from the URL so navigating back / remounting doesn't resend.
  React.useEffect(() => {
    const p = typeof routeParams.prompt === 'string' ? routeParams.prompt : null;
    if (!p || !partnerInfo) return;
    if (autoSentPromptRef.current === p) return;
    autoSentPromptRef.current = p;
    void handleSend(p);
    try { router.setParams({ prompt: undefined } as any); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParams.prompt, partnerInfo]);

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
        {!hideBack && (
          <Pressable onPress={onBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        )}
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
          renderItem={({ item, index }) => {
            const senderId = item.sender?.id || item.senderId || item.sender_id;
            const prev = index > 0 ? messages[index - 1] : null;
            const ts = item.createdAt || item.created_at;
            // Day separator when the calendar day changes — Today / Yesterday /
            // "Jun 3", best-in-class chat history legibility.
            const showDay = isNewDay(ts, prev?.createdAt || prev?.created_at);
            return (
              <>
                {showDay ? (
                  <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
                    <View style={{ backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: radius.full }}>
                      <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11, fontWeight: '600' }}>{formatDayLabel(ts)}</Text>
                    </View>
                  </View>
                ) : null}
                <ChatBubble message={item} isOwn={senderId === user?.id} agentChat={isAgentChat} onRetry={retryMessage} onLongPress={openActions} onReactPill={handleReact} quoted={resolveQuoted(item)} myUserId={user?.id} />
              </>
            );
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
            // Constrain to a Claude-like reading column on web so the thread
            // isn't stretched edge-to-edge on wide screens. Centered, and the
            // input row below uses the same width so they stay aligned.
            ...(Platform.OS === 'web' ? { maxWidth: 760, width: '100%', alignSelf: 'center' } as any : {}),
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

      {/* Tap-and-hold action menu */}
      <MessageActions
        visible={!!actionMsg}
        isOwn={!!actionMsg && (actionMsg.sender?.id || actionMsg.senderId || actionMsg.sender_id) === user?.id}
        myReaction={(actionMsg?.reactions || []).find((r: any) => (r.user_id ?? r.userId) === user?.id)?.type || null}
        anchor={actionPos}
        onClose={() => { setActionMsg(null); setActionPos(null); }}
        onReact={(emoji) => handleReact(actionMsg, emoji)}
        onReply={() => setReplyingTo(actionMsg)}
        onCopy={() => handleCopyMsg(actionMsg)}
      />

      {/* Reply banner — the message you're replying to, with a cancel. */}
      {replyingTo ? (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: spacing.md,
          paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
          borderTopWidth: 0.5, borderTopColor: colors.borderSubtle,
          ...(Platform.OS === 'web' ? { maxWidth: 760, width: '100%', alignSelf: 'center' } as any : {}),
        }}>
          <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.accent }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="caption" color={colors.accent} style={{ fontWeight: '700' }} numberOfLines={1}>
              Replying to {(replyingTo.sender?.id || replyingTo.senderId) === user?.id ? 'yourself' : (replyingTo.sender?.name || replyingTo.senderName || '')}
            </Text>
            <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{String(replyingTo.content || replyingTo.text || '').slice(0, 100)}</Text>
          </View>
          <Pressable onPress={() => setReplyingTo(null)} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      {/* Input */}
      <View
        style={{
          flexDirection: 'row',
          // Center the send button vertically against the input (iMessage/Signal)
          // instead of pinning it to the bottom line of a 2-line field.
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderTopWidth: 0.5,
          borderTopColor: colors.borderSubtle,
          paddingBottom: insets.bottom || spacing.md,
          // Match the message column width on web so the composer sits in the
          // same centered Claude-width column instead of stretching full-bleed.
          ...(Platform.OS === 'web' ? { maxWidth: 760, width: '100%', alignSelf: 'center' } as any : {}),
        }}
      >
        {voice.recording ? (
          // Recording bar — WhatsApp/Signal style: discard, live timer, send.
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.md }}>
            <Pressable onPress={voice.cancel} hitSlop={10} style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : undefined}>
              <Ionicons name="trash-outline" size={22} color={colors.error || '#ef4444'} />
            </Pressable>
            <View style={{
              flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.sm,
              backgroundColor: colors.surface, borderRadius: radius.lg,
              paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
              borderWidth: 0.5, borderColor: colors.glassBorder,
            }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error || '#ef4444' }} />
              <Text variant="body" color={colors.text} style={{ fontVariant: ['tabular-nums'] as any }}>
                {`${Math.floor(voice.elapsed / 60000)}:${String(Math.floor(voice.elapsed / 1000) % 60).padStart(2, '0')}`}
              </Text>
              <Text variant="caption" color={colors.textMuted}>Recording…</Text>
            </View>
            <Pressable
              onPress={handleSendVoice}
              disabled={attaching}
              style={({ pressed }) => ({
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: pressed ? colors.accentHover : colors.accent,
                alignItems: 'center', justifyContent: 'center', opacity: attaching ? 0.6 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Ionicons name="send" size={18} color={colors.textOnAccent} />
            </Pressable>
          </View>
        ) : (
          <>
            {/* Attach media (image / video). */}
            <Pressable onPress={handleAttach} disabled={attaching} hitSlop={8} style={{ opacity: attaching ? 0.5 : 1, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) }}>
              <Ionicons name={attaching ? 'ellipsis-horizontal' : 'add-circle-outline'} size={18} color={colors.accent} />
            </Pressable>
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
            {text.trim() ? (
              // Text present → send button.
              <Pressable
                onPress={() => handleSend()}
                disabled={sending}
                style={({ pressed }) => ({
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: pressed ? colors.accentHover : colors.accent,
                  alignItems: 'center', justifyContent: 'center',
                })}
              >
                <Ionicons name="send" size={18} color={colors.textOnAccent} />
              </Pressable>
            ) : voice.supported ? (
              // Empty input → hold-free tap-to-record mic (web).
              <Pressable
                onPress={() => voice.start()}
                hitSlop={8}
                style={({ pressed }) => ({
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: pressed ? colors.surfaceHover : colors.surface,
                  borderWidth: 0.5, borderColor: colors.glassBorder,
                  alignItems: 'center', justifyContent: 'center',
                  ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                })}
              >
                <Ionicons name="mic-outline" size={20} color={colors.accent} />
              </Pressable>
            ) : (
              // No mic support (native without recorder) → inert send.
              <Pressable
                onPress={() => handleSend()}
                disabled
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceHover, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="send" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
