import * as React from 'react';
import { View, FlatList, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Avatar, Skeleton, ChatBubble, Button } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { useConversations } from '../../lib/hooks';
import { colors, spacing, radius, typography } from '../../constants/theme';
import { getCached, setCache } from '../../lib/cache';

export default function ChatScreen() {
  const { sdk, user } = useAuth();
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
          const agentRes = await (sdk as any).agents.listDiscoverable({ limit: 100 });
          const agents = agentRes.data || [];
          const match = agents.find((a: any) => a.username === dmUsername.trim() || a.name?.toLowerCase() === dmUsername.trim().toLowerCase());
          userId = match?.id;
        } catch {}
      }
      if (!userId) { setDmError('User or agent not found. Check the username.'); return; }
      const res = await sdk.chat.dm({ user_id: userId });
      if (res.data?.id) {
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
          borderBottomColor: 'rgba(255,255,255,0.06)',
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
              borderBottomColor: 'rgba(255,255,255,0.06)',
            }}
          >
            <TextInput
              placeholder="Username or agent name..."
              placeholderTextColor={colors.textMuted}
              value={dmUsername}
              onChangeText={(t) => { setDmUsername(t); setDmError(null); }}
              autoCapitalize="none"
              onSubmitEditing={handleNewDM}
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
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const other = item.participants?.find((p: any) => p.id !== user?.id) || item.participants?.[0];
            const name = item.name || other?.name || 'Conversation';
            const avatar = other?.image || null;
            const lastMsg = item.lastMessage || item.last_message;
            const lastText = lastMsg?.content || lastMsg?.text || '';
            const time = lastMsg?.createdAt || lastMsg?.created_at || item.updatedAt || '';
            const unread = item.unreadCount || item.unread_count || 0;

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
                    <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>{name}</Text>
                    {time ? (
                      <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>
                        {new Date(time).toLocaleDateString([], { month: 'short', day: 'numeric' })}
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
                        <Text variant="caption" color="#fff" style={{ fontSize: 11, fontWeight: '700' }}>{unread}</Text>
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

/**
 * Call AI agent via SSE streaming endpoint (same pattern as KEMPT).
 * Works around React Native's lack of ReadableStream by reading
 * the full response as text, then parsing SSE events.
 */
async function callAgentSSE(
  sdk: any,
  agentId: string,
  message: string,
  conversationId?: string
): Promise<{ content: string; conversationId: string }> {
  const client = (sdk.agents as any).client;
  const baseUrl: string = client.baseUrl;
  const apiKey: string = client.apiKey;

  const url = `${baseUrl}/agents/${agentId}/chat/stream`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        message,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Agent request failed: HTTP ${response.status}`);
    }

    const text = await response.text();

    let fullText = '';
    let returnedConversationId = conversationId || '';
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'text_delta' && parsed.delta) {
            fullText += parsed.delta;
          } else if (parsed.type === 'message_start' && parsed.conversation_id) {
            returnedConversationId = parsed.conversation_id;
          } else if (parsed.type === 'error') {
            throw new Error(parsed.error || 'AI error');
          }
          if (parsed.conversation_id && !returnedConversationId) {
            returnedConversationId = parsed.conversation_id;
          }
        } catch (e: any) {
          if (e.message && !e.message.startsWith('Unexpected') && !e.message.startsWith('JSON')) throw e;
        }
      }
    }

    return { content: fullText, conversationId: returnedConversationId };
  } finally {
    clearTimeout(timer);
  }
}

function ConversationView({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { sdk, user } = useAuth();
  const cachedMsgs = getCached(`messages:${conversationId}`);
  const cachedSorted = React.useMemo(() => {
    if (!cachedMsgs) return [];
    return [...cachedMsgs].reverse().map((m: any) => ({
      id: m.id,
      content: m.content || m.text || '',
      sender: m.sender || { id: m.senderId || m.sender_id, name: m.senderName },
      createdAt: m.createdAt || m.created_at || new Date().toISOString(),
    }));
  }, [cachedMsgs]);
  const [messages, setMessages] = React.useState<any[]>(cachedSorted);
  const [loading, setLoading] = React.useState(cachedSorted.length === 0);
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [agentTyping, setAgentTyping] = React.useState(false);
  const flatListRef = React.useRef<FlatList>(null);
  // Try to get partner info from cached conversation list for instant name
  const cachedConvo = React.useMemo(() => {
    const convos = getCached('conversations') || [];
    return convos.find((c: any) => c.id === conversationId);
  }, [conversationId]);
  const cachedOther = React.useMemo(() => {
    if (!cachedConvo) return null;
    return cachedConvo.participants?.find((p: any) => p.id !== user?.id) || cachedConvo.participants?.[0];
  }, [cachedConvo, user?.id]);
  const [partnerName, setPartnerName] = React.useState<string>(
    cachedConvo?.name || cachedOther?.name || 'Conversation'
  );
  const [partnerInfo, setPartnerInfo] = React.useState<any>(cachedOther || null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const messageIdsRef = React.useRef<Set<string>>(new Set(cachedSorted.map((m: any) => m.id)));

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
          content: m.content || m.text || '',
          sender: m.sender || { id: m.senderId || m.sender_id, name: m.senderName },
          createdAt: m.createdAt || m.created_at || new Date().toISOString(),
        }));
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
    if (!sdk || loading) return;
    let unsub: (() => void) | undefined;

    // Try WebSocket first
    (async () => {
      try {
        await sdk.realtime.connect();
        sdk.realtime.joinConversation(conversationId);
        wsConnectedRef.current = true;

        unsub = sdk.realtime.onMessage((msg: any) => {
          if (msg.conversationId !== conversationId) return;
          const senderId = msg.sender?.id || msg.senderId;

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
            // Remove agent-* optimistic if content matches
            const filtered = prev.filter(m => {
              if (m.id.startsWith('agent-') && m.content?.trim() === newMsg.content?.trim()) return false;
              return true;
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
  }, [conversationId, sdk, loading]);

  // Fallback polling — only if WebSocket didn't connect
  React.useEffect(() => {
    if (!sdk || loading) return;

    // Wait a moment for WS to connect before starting poll
    const startTimer = setTimeout(() => {
      if (wsConnectedRef.current) return; // WS connected, no need to poll

      pollRef.current = setInterval(async () => {
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
        } catch {}
      }, 5000);

    }, 2000); // Wait 2s for WS to connect before falling back to polling

    return () => {
      clearTimeout(startTimer);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [conversationId, sdk, loading]);

  // Mark as read
  React.useEffect(() => {
    if (sdk && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.id && !lastMsg.id.startsWith('temp-') && !lastMsg.id.startsWith('agent-')) {
        sdk.chat.markAsRead(conversationId, { message_id: lastMsg.id }).catch(() => {});
      }
    }
  }, [conversationId, sdk, messages]);

  const handleSend = async () => {
    if (!text.trim() || !sdk) return;
    const messageText = text.trim();
    setText('');
    setSending(true);

    try {
      // Send message — no optimistic insert, let server confirm via WS or poll
      const sendRes = await sdk.chat.send({ conversation_id: conversationId, content: messageText });
      const serverMsgId = sendRes?.data?.id;

      // If WS is connected, the message will arrive via WS event.
      // If polling, add it immediately from the send response.
      if (serverMsgId && !wsConnectedRef.current) {
        if (!messageIdsRef.current.has(serverMsgId)) {
          messageIdsRef.current.add(serverMsgId);
          setMessages(prev => [...prev, {
            id: serverMsgId,
            content: messageText,
            sender: { id: user?.id, name: user?.name },
            createdAt: new Date().toISOString(),
          }]);
        }
      } else if (serverMsgId) {
        messageIdsRef.current.add(serverMsgId);
      }

      const otherId = partnerInfo?.id || partnerInfo?.user?.id || partnerInfo?.userId;
      const otherName = partnerInfo?.name || partnerInfo?.user?.name || 'Agent';
      const isAgent = partnerInfo?.isAi || partnerInfo?.is_ai
        || partnerInfo?.user?.isAi || partnerInfo?.user?.is_ai
        || partnerInfo?.type === 'agent' || partnerInfo?.user?.type === 'agent';

      if (wsConnectedRef.current) {
        // WebSocket connected — server handles agent auto-reply and broadcasts it.
        // We just show typing indicator and wait for the WS message event.
        if (isAgent) {
          setAgentTyping(true);
          setTimeout(() => setAgentTyping(false), 30000); // safety timeout
        }
      } else {
        // No WebSocket — manually trigger agent response via SSE
        if (isAgent && otherId) {
          setAgentTyping(true);
          try {
            const result = await callAgentSSE(sdk, otherId, messageText, conversationId);
            if (result.content) {
              setMessages(prev => [...prev, {
                id: 'agent-' + Date.now(),
                content: result.content,
                sender: { id: otherId, name: otherName },
                createdAt: new Date().toISOString(),
              }]);
            }
          } catch {
            try {
              const agentRes = await (sdk as any).agents.chat(otherId, { message: messageText });
              const agentData = agentRes?.data || agentRes;
              const reply = agentData?.content || agentData?.message || agentData?.response || (typeof agentData === 'string' ? agentData : null);
              if (reply) {
                setMessages(prev => [...prev, {
                  id: 'agent-' + Date.now(),
                  content: reply,
                  sender: { id: otherId, name: otherName },
                  createdAt: new Date().toISOString(),
                }]);
              }
            } catch {}
          }
          setAgentTyping(false);
        } else if (otherId) {
          // Try SSE in case it's an unlabeled agent
          try {
            setAgentTyping(true);
            const result = await callAgentSSE(sdk, otherId, messageText, conversationId);
            if (result.content) {
              setMessages(prev => [...prev, {
                id: 'agent-' + Date.now(),
                content: result.content,
                sender: { id: otherId, name: otherName },
                createdAt: new Date().toISOString(),
              }]);
            }
          } catch {}
          setAgentTyping(false);
        }
      }
    } catch {
      // Send failed — nothing to remove since we didn't add optimistically
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
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
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
            return <ChatBubble message={item} isOwn={senderId === user?.id} />;
          }}
          contentContainerStyle={{
            padding: spacing.xl,
            flexGrow: 1,
            justifyContent: messages.length === 0 ? 'center' : 'flex-end',
          }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListFooterComponent={agentTyping ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, opacity: 0.6 }} />
              <Text variant="caption" color={colors.textMuted}>Thinking...</Text>
            </View>
          ) : null}
          ListEmptyComponent={
            <View style={{ alignItems: 'center' }}>
              <Text variant="body" color={colors.textMuted}>Start the conversation</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Input */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: spacing.sm,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(255,255,255,0.06)',
          paddingBottom: insets.bottom || spacing.md,
        }}
      >
        <TextInput
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
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
          <Ionicons name="send" size={18} color={text.trim() ? '#fff' : colors.textMuted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
