import * as React from 'react';
import { View, FlatList, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Avatar, Skeleton, ChatBubble, Button } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { useConversations, useMessages } from '../../lib/hooks';
import { colors, spacing, radius, typography } from '../../constants/theme';

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
      if (!userId) { setDmError('User not found'); return; }
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
          <Ionicons name="chatbubbles-outline" size={32} color={colors.textMuted} />
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>No conversations yet</Text>
          <Text variant="caption" color={colors.textMuted} style={{ textAlign: 'center', maxWidth: 280 }}>
            Start a conversation with someone or chat with an agent.
          </Text>
          <Button onPress={() => setShowNewChat(true)} size="sm">
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

function ConversationView({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { sdk, user } = useAuth();
  const { messages, setMessages, loading, refresh } = useMessages(conversationId);
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const flatListRef = React.useRef<FlatList>(null);
  const [partnerName, setPartnerName] = React.useState<string>('Conversation');

  // Fetch partner name
  React.useEffect(() => {
    if (!sdk) return;
    (async () => {
      try {
        const convoRes = await sdk.chat.conversation(conversationId);
        const convo = convoRes.data as any;
        const participants = convo?.participants || convo?.members || [];
        const other = participants.find((p: any) => {
          const pId = p.id || p.user?.id || p.userId;
          return pId !== user?.id;
        });
        const name = other?.name || other?.user?.name || convo?.name;
        if (name) setPartnerName(name);
      } catch {}
    })();
  }, [conversationId, sdk, user?.id]);

  // Real-time WebSocket for live messages
  React.useEffect(() => {
    if (!sdk) return;
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        await sdk.realtime.connect();
        sdk.realtime.joinConversation(conversationId);
        unsub = sdk.realtime.onMessage((msg: any) => {
          if (msg.conversationId === conversationId) {
            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, {
                id: msg.id,
                content: msg.text || msg.content,
                sender: msg.sender || { id: msg.senderId, name: msg.senderName },
                createdAt: msg.createdAt || new Date().toISOString(),
              }];
            });
          }
        });
      } catch {
        // WebSocket failed — fall back to polling
      }
    })();
    return () => {
      unsub?.();
      sdk.realtime.leaveConversation(conversationId);
    };
  }, [conversationId, sdk]);

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

    const tempMsg = {
      id: 'temp-' + Date.now(),
      content: messageText,
      sender: { id: user?.id, name: user?.name },
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      await sdk.chat.send({ conversation_id: conversationId, content: messageText });
      // Check if conversation partner is an agent and trigger auto-response
      try {
        const convoRes = await sdk.chat.conversation(conversationId);
        const convo = convoRes.data as any;
        // Try multiple ways to find the other participant
        const participants = convo?.participants || convo?.members || [];
        const other = participants.find((p: any) => {
          const pId = p.id || p.user?.id || p.userId;
          return pId !== user?.id;
        });
        const otherId = other?.id || other?.user?.id || other?.userId;
        const otherName = other?.name || other?.user?.name || 'Agent';
        // Check if other participant is an agent: isAi flag, or isAgent, or type === 'agent'
        const isAgent = other?.isAi || other?.is_ai || other?.user?.isAi || other?.user?.is_ai
          || other?.type === 'agent' || other?.user?.type === 'agent'
          || convo?.type === 'agent' || convo?.is_agent;
        if (isAgent && otherId) {
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
        } else if (otherId) {
          // Fallback: try agents.chat anyway — if it fails silently, it wasn't an agent
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
          } catch {
            // Not an agent, that's fine
          }
        }
      } catch {}
      refresh();
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
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
