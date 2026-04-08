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
import { useCommunities } from '../../lib/hooks';
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
  const [selectedCommunity, setSelectedCommunity] = React.useState<any>(null);
  const [showCommunityPicker, setShowCommunityPicker] = React.useState(false);
  const { communities } = useCommunities(30);

  // Agent state
  const [agentName, setAgentName] = React.useState('');
  const [agentBio, setAgentBio] = React.useState('');
  const [agentPrompt, setAgentPrompt] = React.useState('');
  const [agentModelIdx, setAgentModelIdx] = React.useState(0);
  const [showModelMenu, setShowModelMenu] = React.useState(false);
  const MODELS = [
    { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6', provider: 'Anthropic' },
    { id: 'anthropic/claude-opus-4.6', label: 'Claude Opus 4.6', provider: 'Anthropic' },
    { id: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5', provider: 'Anthropic' },
    { id: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', provider: 'Google' },
    { id: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash', provider: 'Google' },
    { id: 'openai/gpt-5.4', label: 'GPT-5.4', provider: 'OpenAI' },
    { id: 'openai/o3', label: 'o3', provider: 'OpenAI' },
  ];

  // App state
  const [appName, setAppName] = React.useState('');
  const [appDesc, setAppDesc] = React.useState('');

  // Community state
  const [communityName, setCommunityName] = React.useState('');
  const [communityDesc, setCommunityDesc] = React.useState('');
  const [communityPrivate, setCommunityPrivate] = React.useState(false);

  const [submitting, setSubmitting] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // Avatar state for agent/app/community creation
  const [avatarUri, setAvatarUri] = React.useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  const handlePickAvatar = async () => {
    try {
      const picker = getImagePicker();
      if (picker) {
        const result = await picker.launchImageLibraryAsync({
          mediaTypes: picker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
      } else if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) setAvatarUri(URL.createObjectURL(file));
        };
        input.click();
      }
    } catch {}
  };

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
        if ((!content.trim() && !mediaUri) || !selectedCommunity) {
          setSubmitting(false);
          return;
        }
        let mediaUrls: string[] | undefined;
        if (mediaUri) {
          try {
            const uploadRes = await (sdk as any).uploads.getMediaUploadUrl({
              content_type: 'image/jpeg',
              content_length: 0,
            });
            const uploadUrl = uploadRes.data?.upload_url || uploadRes.data?.url;
            if (uploadUrl) {
              const response = await fetch(mediaUri);
              const blob = await response.blob();
              await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
              mediaUrls = [uploadRes.data?.public_url || uploadUrl.split('?')[0]];
            }
          } catch { Alert.alert('Image Upload', 'Image could not be uploaded. Post will be created without media.'); }
        }
        await sdk.posts.create({
          content: content.trim() || ' ',
          organization_id: ORG_ID || undefined,
          community_id: selectedCommunity?.id || undefined,
          media_urls: mediaUrls,
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
          model: MODELS[agentModelIdx].id,
          organization_id: ORG_ID || undefined,
          social_mode: 'chat_only',
          tool_mode: 'chat_only',
        });
        setAgentName(''); setAgentBio(''); setAgentPrompt(''); setAvatarUri(null);
        showSuccess('Agent created');
        setMode('post');
      } else if (mode === 'app') {
        if (!appName.trim()) { setSubmitting(false); return; }
        await sdk.projects.create({
          name: appName.trim(),
          organization_id: ORG_ID || undefined,
        } as any);
        setAppName(''); setAppDesc(''); setAvatarUri(null);
        showSuccess('App created');
        setMode('post');
      } else if (mode === 'community') {
        if (!communityName.trim()) { setSubmitting(false); return; }
        const slug = communityName.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-') + '-' + Math.random().toString(36).slice(2, 6);
        await sdk.communities.create({
          name: communityName.trim(),
          slug,
          description: communityDesc.trim() || undefined,
          privacy: communityPrivate ? 'private' : 'public',
          organization_id: ORG_ID || undefined,
        } as any);
        setCommunityName(''); setCommunityDesc(''); setAvatarUri(null);
        showSuccess('Community created');
        setMode('post');
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Something went wrong';
      setSuccessMsg(null);
      Alert.alert('Error', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = mode === 'post' ? ((content.trim().length > 0 || !!mediaUri) && !!selectedCommunity)
    : mode === 'agent' ? (agentName.trim().length > 0 && agentBio.trim().length > 0)
    : mode === 'app' ? (appName.trim().length > 0 && appDesc.trim().length > 0)
    : (communityName.trim().length > 0 && communityDesc.trim().length > 0);

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
          gap: spacing.sm,
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        {MODES.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => setMode(m.key)}
            style={{
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              borderRadius: radius.full,
              backgroundColor: mode === m.key ? colors.accentSubtle : 'transparent',
              borderWidth: mode === m.key ? 0 : 0.5,
              borderColor: colors.glassBorder,
            }}
          >
            <Text
              variant="label"
              color={mode === m.key ? colors.accent : colors.textMuted}
            >
              {m.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content area */}
      {mode === 'post' ? (
        <View style={{ flex: 1, padding: spacing.xl }}>
          {/* Community picker */}
          <View style={{ marginBottom: spacing.md, position: 'relative' }}>
            {!selectedCommunity && content.trim().length > 0 && (
              <Text variant="caption" color={colors.error} style={{ marginBottom: spacing.xs }}>Choose a community to post in</Text>
            )}
            <Pressable
              onPress={() => setShowCommunityPicker(!showCommunityPicker)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
                backgroundColor: selectedCommunity ? colors.accentSubtle : (!selectedCommunity && content.trim().length > 0) ? colors.errorMuted : colors.surface,
                borderRadius: radius.full, alignSelf: 'flex-start',
                borderWidth: 0.5, borderColor: selectedCommunity ? colors.accent + '40' : (!selectedCommunity && content.trim().length > 0) ? colors.error + '40' : colors.glassBorder,
              }}
            >
              <Ionicons name={selectedCommunity ? 'people' : 'add-circle-outline'} size={14} color={selectedCommunity ? colors.accent : colors.textMuted} />
              <Text variant="caption" color={selectedCommunity ? colors.accent : colors.textMuted} style={{ fontSize: 13 }}>
                {selectedCommunity ? selectedCommunity.name : 'Choose a community'}
              </Text>
              <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
            </Pressable>

            {showCommunityPicker && (
              <>
                <Pressable
                  onPress={() => setShowCommunityPicker(false)}
                  style={{ position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 99998 }}
                />
                <View style={{
                  position: 'fixed' as any,
                  top: 140,
                  left: spacing.xl,
                  right: spacing.xl,
                  maxWidth: 340,
                  backgroundColor: colors.surfaceRaised,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  zIndex: 999999,
                  maxHeight: 400,
                  ...(Platform.OS === 'web' ? { boxShadow: '0 16px 64px rgba(0,0,0,0.95)', overflowY: 'auto' } as any : {}),
                }}>
                  <View style={{ padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
                    <Text variant="label" color={colors.textSecondary}>Choose a community</Text>
                  </View>
                  {(communities || []).length === 0 && (
                    <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
                      <Text variant="body" color={colors.textMuted} align="center">No communities yet</Text>
                      <Pressable onPress={() => { setShowCommunityPicker(false); setMode('community' as any); }}>
                        <Text variant="caption" color={colors.accent}>Create one</Text>
                      </Pressable>
                    </View>
                  )}
                  {(communities || []).map((c: any) => (
                    <Pressable
                      key={c.id}
                      onPress={() => { setSelectedCommunity(c); setShowCommunityPicker(false); }}
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                        paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
                        backgroundColor: selectedCommunity?.id === c.id ? colors.accentSubtle : pressed ? colors.surfaceHover : 'transparent',
                        borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle,
                      })}
                    >
                      <Avatar uri={c.image || c.avatar} name={c.name} size="sm" />
                      <View style={{ flex: 1 }}>
                        <Text variant="body" color={selectedCommunity?.id === c.id ? colors.accent : colors.text} numberOfLines={1}>{c.name}</Text>
                        {c.description && <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{c.description}</Text>}
                      </View>
                      {selectedCommunity?.id === c.id && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>

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
                onKeyPress={(e: any) => {
                  if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
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
          {/* Avatar picker for agent/app/community */}
          <Pressable
            onPress={handlePickAvatar}
            style={{ alignSelf: 'center', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceHover, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassBorder }}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={{ width: 80, height: 80, borderRadius: 40 }} />
            ) : (
              <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
            )}
          </Pressable>
          <Text variant="caption" color={colors.textMuted} style={{ textAlign: 'center', marginTop: -spacing.sm }}>
            Tap to add avatar
          </Text>

          {successMsg && (
            <View style={{ backgroundColor: colors.successMuted, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' }}>
              <Text variant="body" color={colors.success}>{successMsg}</Text>
            </View>
          )}

          {mode === 'agent' && (
            <>
              <TextInput placeholder="Agent name" placeholderTextColor={colors.textMuted} value={agentName} onChangeText={setAgentName} autoFocus
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, ...typography.body, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
              <TextInput placeholder="Short bio *" placeholderTextColor={colors.textMuted} value={agentBio} onChangeText={setAgentBio}
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, ...typography.body, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
              <TextInput placeholder="What should this agent do?" placeholderTextColor={colors.textMuted} value={agentPrompt} onChangeText={setAgentPrompt} multiline
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, minHeight: 100, textAlignVertical: 'top', ...typography.body, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
              <View style={{ position: 'relative' }}>
                <Pressable
                  onPress={() => setShowModelMenu(!showModelMenu)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: showModelMenu ? colors.accent : colors.glassBorder }}
                >
                  <Ionicons name="hardware-chip-outline" size={18} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" color={colors.text} style={{ fontSize: 14 }}>{MODELS[agentModelIdx].label}</Text>
                    <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>{MODELS[agentModelIdx].provider}</Text>
                  </View>
                  <Ionicons name={showModelMenu ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                </Pressable>
                {showModelMenu && (
                  <>
                    <Pressable
                      onPress={() => setShowModelMenu(false)}
                      style={{ position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 99998 }}
                    />
                    <View
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: spacing.xs,
                        backgroundColor: colors.bg,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: colors.border,
                        zIndex: 99999,
                        overflow: 'hidden',
                        ...(Platform.OS === 'web' ? { boxShadow: '0 8px 32px rgba(0,0,0,0.6)' } as any : {}),
                      }}
                    >
                      {MODELS.map((model, idx) => (
                        <Pressable
                          key={model.id}
                          onPress={() => { setAgentModelIdx(idx); setShowModelMenu(false); }}
                          style={({ pressed }) => ({
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: spacing.sm,
                            paddingHorizontal: spacing.lg,
                            paddingVertical: spacing.md,
                            backgroundColor: idx === agentModelIdx ? colors.accentSubtle : pressed ? colors.surfaceHover : 'transparent',
                            borderBottomWidth: idx < MODELS.length - 1 ? 0.5 : 0,
                            borderBottomColor: 'rgba(255,255,255,0.04)',
                          })}
                        >
                          <View style={{ flex: 1 }}>
                            <Text variant="body" color={idx === agentModelIdx ? colors.accent : colors.text} style={{ fontSize: 14 }}>{model.label}</Text>
                            <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>{model.provider}</Text>
                          </View>
                          {idx === agentModelIdx && (
                            <Ionicons name="checkmark" size={18} color={colors.accent} />
                          )}
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
              </View>
            </>
          )}
          {mode === 'app' && (
            <>
              <TextInput placeholder="App name" placeholderTextColor={colors.textMuted} value={appName} onChangeText={setAppName} autoFocus
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, ...typography.body, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
              <TextInput placeholder="Description *" placeholderTextColor={colors.textMuted} value={appDesc} onChangeText={setAppDesc} multiline
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, minHeight: 80, textAlignVertical: 'top', ...typography.body, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
            </>
          )}
          {mode === 'community' && (
            <>
              <TextInput placeholder="Community name" placeholderTextColor={colors.textMuted} value={communityName} onChangeText={setCommunityName} autoFocus
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, ...typography.body, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
              <TextInput placeholder="Description *" placeholderTextColor={colors.textMuted} value={communityDesc} onChangeText={setCommunityDesc} multiline
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
          <Pressable
            onPress={() => setIsNsfw(!isNsfw)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
              paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
              borderRadius: radius.sm,
              backgroundColor: isNsfw ? colors.errorMuted : 'transparent',
              borderWidth: isNsfw ? 0 : 0.5,
              borderColor: colors.borderSubtle,
            }}
          >
            <Text variant="caption" color={isNsfw ? colors.error : colors.textMuted} style={{ fontSize: 11 }}>NSFW</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Text variant="caption" color={colors.textMuted}>{content.length}</Text>
        </View>
      )}
    </Container>
  );
}
