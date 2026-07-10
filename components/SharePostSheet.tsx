import * as React from 'react';
import { View, Pressable, Modal, TextInput, FlatList, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { useConversations } from '../lib/hooks';
import { useColors } from '../lib/theme';
import { spacing, radius, typography } from '../constants/theme';
import { ORG_ID, SITE_URL } from '../lib/recursiv';
import { resolvePersonalAgent } from '../lib/resolvePersonalAgent';
import { buildPostContextPrompt } from '../lib/askAgent';
import { isAiActor } from '../lib/models';

/**
 * "Send post" sheet — share a Minds post into a DM (X/IG style). Your personal
 * AI is the default recipient; sending to it seeds a "give me basic context"
 * prompt. Any other recipient just receives the post as a rich embed.
 */
export function SharePostSheet({ visible, post, onClose }: { visible: boolean; post: any; onClose: () => void }) {
  const colors = useColors();
  const router = useRouter();
  const { sdk, user } = useAuth();
  const { conversations } = useConversations();
  const [query, setQuery] = React.useState('');
  const [people, setPeople] = React.useState<any[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => { if (!visible) { setQuery(''); setPeople([]); } }, [visible]);

  // People search when typing.
  React.useEffect(() => {
    if (!visible || !sdk || !query.trim()) { setPeople([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await sdk.profiles.search({ q: query.trim(), limit: 8, organization_id: ORG_ID || undefined } as any);
        if (!cancelled) setPeople(res.data || []);
      } catch {}
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [visible, query, sdk]);

  const postId = post?.id;
  const postUrl = `${SITE_URL}/post/${postId}`;

  const sendToUser = React.useCallback(async (userId: string, label: string) => {
    if (!sdk || !userId || busy) return;
    setBusy(userId);
    try {
      const dm: any = await (sdk as any).chat.dm({ user_id: userId, organization_id: ORG_ID || undefined });
      const convoId = dm?.data?.id;
      if (convoId) {
        await sdk.chat.send({ conversation_id: convoId, content: postUrl } as any);
        onClose();
        router.push({ pathname: '/(tabs)/chat', params: { id: convoId, focused: '1' } } as any);
      }
    } catch {} finally { setBusy(null); }
  }, [sdk, busy, postUrl, onClose, router]);

  const sendToAi = React.useCallback(async () => {
    if (!sdk || busy) return;
    setBusy('ai');
    try {
      const agent = await resolvePersonalAgent(sdk);
      if (!agent) return;
      const dm: any = await (sdk as any).chat.dm({ user_id: agent.id, organization_id: ORG_ID || undefined });
      const convoId = dm?.data?.id;
      if (convoId) {
        const author = post?.author?.username || post?.author?.name || 'someone';
        const prompt = buildPostContextPrompt({ author, content: post?.content || post?.body || '', url: postUrl });
        await sdk.chat.send({ conversation_id: convoId, content: prompt } as any);
        onClose();
        router.push({ pathname: '/(tabs)/chat', params: { id: convoId, focused: '1' } } as any);
      }
    } catch {} finally { setBusy(null); }
  }, [sdk, busy, post, postUrl, onClose, router]);

  // Recent DMs (resolve the other participant for a one-tap send).
  const recentDms = React.useMemo(() => (conversations || [])
    .map((c: any) => {
      const members: any[] = c.participants || c.members || [];
      const other = members.find((p: any) => (p?.user?.id ?? p?.id ?? p?.userId) !== user?.id);
      const ou = other?.user || other || {};
      const id = ou.id ?? other?.id ?? other?.userId;
      if (!id) return null;
      return { id, name: c.name || ou.name || ou.username || 'Conversation', avatar: ou.image || null, isAi: isAiActor(ou) };
    })
    .filter(Boolean)
    .slice(0, 20), [conversations, user?.id]);

  if (!visible) return null;

  const Row = ({ id, name, avatar, subtitle, onPress, ai }: any) => (
    <Pressable onPress={onPress} disabled={!!busy}
      style={({ pressed, hovered }: any) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: pressed || hovered ? colors.surfaceHover : 'transparent', opacity: busy && busy !== id ? 0.5 : 1, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) })}>
      {ai ? (
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="sparkles" size={18} color="#fff" />
        </View>
      ) : <Avatar uri={avatar} name={name} size="md" />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyMedium" numberOfLines={1}>{name}</Text>
        {subtitle ? <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {busy === id ? <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} /> : <Ionicons name="send" size={16} color={colors.accent} />}
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '80%', paddingBottom: spacing.xl, ...(Platform.OS === 'web' ? { maxWidth: 560, width: '100%', alignSelf: 'center', borderRadius: radius.xl, marginBottom: spacing.xl } as any : {}) }}>
          <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderSubtle }} />
          </View>
          <Text variant="h3" style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.sm }}>Send post</Text>
          <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 8 }}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput placeholder="Search people…" placeholderTextColor={colors.textMuted} value={query} onChangeText={setQuery}
                style={{ flex: 1, color: colors.text, ...typography.body, paddingVertical: 0, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }} />
            </View>
          </View>
          <FlatList
            data={query.trim() ? people : recentDms}
            keyExtractor={(item: any, i) => String(item.id ?? i)}
            keyboardShouldPersistTaps="always"
            ListHeaderComponent={!query.trim() ? (
              <Row id="ai" name="Minds AI" ai subtitle="Get context about this post — your default" onPress={sendToAi} />
            ) : null}
            renderItem={({ item }: any) => (
              <Row id={item.id} name={item.name || item.username || 'Unknown'} avatar={item.image || item.avatar}
                subtitle={item.username ? `@${item.username}` : (item.isAi ? 'Agent' : undefined)}
                onPress={() => sendToUser(item.id, item.name)} />
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
