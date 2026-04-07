import * as React from 'react';
import {
  View,
  TextInput,
  Pressable,
  Image,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
const getImagePicker = () => Platform.OS !== 'web' ? require('expo-image-picker') : null;
import { Text, Button, Input } from '../../components';
import { Container } from '../../components/Container';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../lib/auth';
import { ORG_ID } from '../../lib/recursiv';
import { colors, spacing, radius, typography } from '../../constants/theme';

type Mode = 'post' | 'agent' | 'app' | 'community';

const MODES: { key: Mode; label: string }[] = [
  { key: 'post', label: 'Post' },
  { key: 'agent', label: 'Agent' },
  { key: 'app', label: 'App' },
  { key: 'community', label: 'Community' },
];

export default function CreateScreen() {
  const router = useRouter();
  const { sdk, user } = useAuth();
  const [mode, setMode] = React.useState<Mode>('post');

  // Post state
  const [content, setContent] = React.useState('');
  const [isNsfw, setIsNsfw] = React.useState(false);
  const [showTags, setShowTags] = React.useState(false);
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  const [mediaUri, setMediaUri] = React.useState<string | null>(null);

  // Agent state
  const [agentName, setAgentName] = React.useState('');
  const [agentBio, setAgentBio] = React.useState('');
  const [agentPrompt, setAgentPrompt] = React.useState('');

  // App state
  const [appName, setAppName] = React.useState('');
  const [appDesc, setAppDesc] = React.useState('');

  // Community state
  const [communityName, setCommunityName] = React.useState('');
  const [communityDesc, setCommunityDesc] = React.useState('');
  const [communityPrivate, setCommunityPrivate] = React.useState(false);

  const [submitting, setSubmitting] = React.useState(false);

  const handlePickImage = async () => {
    try {
      const picker = getImagePicker();
      if (picker) {
        const result = await picker.launchImageLibraryAsync({
          mediaTypes: picker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) setMediaUri(result.assets[0].uri);
      } else if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) setMediaUri(URL.createObjectURL(file));
        };
        input.click();
      }
    } catch {}
  };

  const handleSubmit = async () => {
    if (!sdk) return;
    setSubmitting(true);
    try {
      if (mode === 'post') {
        if (!content.trim() && !mediaUri) {
          if (Platform.OS === 'web') alert('Write something to share');
          else Alert.alert('', 'Write something to share');
          setSubmitting(false);
          return;
        }
        await sdk.posts.create({
          content: content.trim() || ' ',
          organization_id: ORG_ID || undefined,
        } as any);
        router.back();
      } else if (mode === 'agent') {
        if (!agentName.trim()) { setSubmitting(false); return; }
        const username = agentName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.random().toString(36).slice(2, 6);
        await (sdk as any).agents.create({
          name: agentName.trim(),
          username,
          bio: agentBio.trim() || undefined,
          system_prompt: agentPrompt.trim() || undefined,
          model: 'google/gemini-3.1-pro-preview',
          organization_id: ORG_ID || undefined,
          social_mode: 'chat_only',
          tool_mode: 'chat_only',
        });
        if (Platform.OS === 'web') alert('Agent created!');
        else Alert.alert('', 'Agent created!');
        setAgentName(''); setAgentBio(''); setAgentPrompt('');
        setMode('post');
      } else if (mode === 'app') {
        if (!appName.trim()) { setSubmitting(false); return; }
        await sdk.projects.create({
          name: appName.trim(),
          organization_id: ORG_ID || undefined,
        } as any);
        if (Platform.OS === 'web') alert('App created!');
        else Alert.alert('', 'App created!');
        setAppName(''); setAppDesc('');
        setMode('post');
      } else if (mode === 'community') {
        if (!communityName.trim()) { setSubmitting(false); return; }
        const slug = communityName.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-') + '-' + Math.random().toString(36).slice(2, 6);
        await sdk.communities.create({
          name: communityName.trim(),
          slug,
          description: communityDesc.trim() || undefined,
          privacy: communityPrivate ? 'private' : 'public',
        } as any);
        if (Platform.OS === 'web') alert('Community created!');
        else Alert.alert('', 'Community created!');
        setCommunityName(''); setCommunityDesc('');
        setMode('post');
      }
    } catch (err: any) {
      const msg = err?.message || 'Something went wrong';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = mode === 'post' ? (content.trim().length > 0 || !!mediaUri)
    : mode === 'agent' ? agentName.trim().length > 0
    : mode === 'app' ? appName.trim().length > 0
    : communityName.trim().length > 0;

  const submitLabel = mode === 'post' ? 'Post'
    : mode === 'agent' ? 'Create Agent'
    : mode === 'app' ? 'Create App'
    : 'Create Community';

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
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text variant="body" color={colors.textSecondary}>Cancel</Text>
        </Pressable>

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          style={{
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.sm,
            borderRadius: radius.full,
            backgroundColor: canSubmit ? colors.accent : colors.surfaceHover,
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Text variant="bodyMedium" color={canSubmit ? colors.textInverse : colors.textMuted}>
              {submitLabel}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Mode switcher */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.sm,
          gap: spacing.lg,
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(255,255,255,0.04)',
        }}
      >
        {MODES.map((m) => (
          <Pressable key={m.key} onPress={() => setMode(m.key)} hitSlop={4}>
            <Text
              variant="caption"
              color={mode === m.key ? colors.accent : colors.textMuted}
              style={{ fontWeight: mode === m.key ? '500' : '300' }}
            >
              {m.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content area */}
      {mode === 'post' ? (
        <View style={{ flex: 1, padding: spacing.xl }}>
          <View style={{ flexDirection: 'row', gap: spacing.md, flex: 1 }}>
            <Avatar uri={user?.image} name={user?.name} size="md" />
            <View style={{ flex: 1 }}>
              <TextInput
                placeholder="What's on your mind?"
                placeholderTextColor={colors.textMuted}
                value={content}
                onChangeText={setContent}
                multiline
                autoFocus
                style={{
                  color: colors.text,
                  ...typography.body,
                  fontSize: 17,
                  lineHeight: 24,
                  padding: 0,
                  flex: 1,
                  textAlignVertical: 'top',
                  ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
                }}
              />
            </View>
          </View>

          {mediaUri && (
            <View style={{ marginTop: spacing.lg, position: 'relative' }}>
              <Image
                source={{ uri: mediaUri }}
                style={{ width: '100%', aspectRatio: 16 / 9, maxHeight: 300, borderRadius: radius.md, backgroundColor: colors.surfaceHover }}
                resizeMode="contain"
              />
              <Pressable
                onPress={() => setMediaUri(null)}
                style={{ position: 'absolute', top: spacing.sm, right: spacing.sm, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.full, padding: spacing.sm }}
              >
                <Ionicons name="close" size={18} color="#fff" />
              </Pressable>
            </View>
          )}

          {tags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
              {tags.map((tag) => (
                <Pressable key={tag} onPress={() => setTags((prev) => prev.filter((t) => t !== tag))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surfaceHover, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full }}>
                  <Text variant="caption" color={colors.accent}>#{tag}</Text>
                  <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          )}

          {showTags && (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <TextInput
                placeholder="Add a tag..."
                placeholderTextColor={colors.textMuted}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={() => { const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''); if (tag && !tags.includes(tag)) setTags(p => [...p, tag]); setTagInput(''); setShowTags(false); }}
                autoFocus
                style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.text, ...typography.body, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }}
              />
            </View>
          )}
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
          {mode === 'agent' && (
            <>
              <TextInput placeholder="Agent name" placeholderTextColor={colors.textMuted} value={agentName} onChangeText={setAgentName} autoFocus
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, ...typography.body, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
              <TextInput placeholder="Short bio (optional)" placeholderTextColor={colors.textMuted} value={agentBio} onChangeText={setAgentBio}
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, ...typography.body, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
              <TextInput placeholder="What should this agent do?" placeholderTextColor={colors.textMuted} value={agentPrompt} onChangeText={setAgentPrompt} multiline
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, minHeight: 100, textAlignVertical: 'top', ...typography.body, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
            </>
          )}
          {mode === 'app' && (
            <>
              <TextInput placeholder="App name" placeholderTextColor={colors.textMuted} value={appName} onChangeText={setAppName} autoFocus
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, ...typography.body, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
              <TextInput placeholder="Description (optional)" placeholderTextColor={colors.textMuted} value={appDesc} onChangeText={setAppDesc} multiline
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, minHeight: 80, textAlignVertical: 'top', ...typography.body, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
            </>
          )}
          {mode === 'community' && (
            <>
              <TextInput placeholder="Community name" placeholderTextColor={colors.textMuted} value={communityName} onChangeText={setCommunityName} autoFocus
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, ...typography.body, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
              <TextInput placeholder="Description (optional)" placeholderTextColor={colors.textMuted} value={communityDesc} onChangeText={setCommunityDesc} multiline
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, minHeight: 80, textAlignVertical: 'top', ...typography.body, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
              <Pressable onPress={() => setCommunityPrivate(!communityPrivate)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Ionicons name={communityPrivate ? 'lock-closed' : 'lock-open-outline'} size={20} color={communityPrivate ? colors.accent : colors.textMuted} />
                <Text variant="body" color={colors.textSecondary}>{communityPrivate ? 'Private' : 'Public'}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      )}

      {/* Bottom toolbar (post mode only) */}
      {mode === 'post' && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xl,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            borderTopWidth: 0.5,
            borderTopColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <Pressable onPress={handlePickImage} hitSlop={8}>
            <Ionicons name="image-outline" size={22} color={mediaUri ? colors.accent : colors.textMuted} />
          </Pressable>
          <Pressable onPress={() => setShowTags(!showTags)} hitSlop={8}>
            <Ionicons name="pricetag-outline" size={22} color={tags.length > 0 ? colors.accent : colors.textMuted} />
          </Pressable>
          <Pressable onPress={() => setIsNsfw(!isNsfw)} hitSlop={8}>
            <Ionicons name={isNsfw ? 'warning' : 'warning-outline'} size={22} color={isNsfw ? colors.accent : colors.textMuted} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Text variant="caption" color={colors.textMuted}>{content.length}</Text>
        </View>
      )}
    </Container>
  );
}
