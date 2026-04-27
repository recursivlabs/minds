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
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
const getImagePicker = () => Platform.OS !== 'web' ? require('expo-image-picker') : null;
import { Text, Button, Input } from '../../components';
import { Container } from '../../components/Container';
import { TabBar } from '../../components/TabBar';
import { MentionPicker, useMentions } from '../../components/MentionPicker';
import { LinkPreview } from '../../components/LinkPreview';
import { getLatestDraft, saveDraft, deleteDraft } from '../../lib/drafts';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../lib/auth';
import { useCommunities } from '../../lib/hooks';
import { ORG_ID } from '../../lib/recursiv';
import { colors, spacing, radius, typography } from '../../constants/theme';

// Consumer Create surface: Post is the only first-class mode. Community
// stays as a reachable mode via ?mode=community deep-link from Discover's
// "+ Start a community" button — but the mode tab bar is hidden. Blog /
// Agent / App authoring deferred to the Pro-tier upsell email campaign;
// those branches stay typed only to avoid touching too much during this
// pass.
type Mode = 'post' | 'blog' | 'agent' | 'app' | 'community';

const MODES: { key: Mode; label: string }[] = [
  { key: 'post', label: 'Post' },
];

export default function CreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ communityId?: string; communityName?: string; quote?: string; mode?: string }>();
  const { sdk, user } = useAuth();
  const initialMode: Mode = (params.mode === 'community' || params.mode === 'blog' || params.mode === 'agent' || params.mode === 'app') ? params.mode : 'post';
  const [mode, setMode] = React.useState<Mode>(initialMode);

  // Restore draft on mount
  const draftRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const draft = getLatestDraft();
    if (draft && !params.communityId) {
      setContent(draft.content);
      if (draft.communityId) setSelectedCommunity({ id: draft.communityId, name: draft.communityName });
      draftRef.current = draft.id;
    }
    // Auto-save draft on unmount
    return () => {
      // Only save if there's content and we didn't just submit
      // (content ref would be stale in cleanup, so we save via ref)
    };
  }, []);

  // Post state
  const [content, setContent] = React.useState(params.quote || '');
  const [autosaveFlash, setAutosaveFlash] = React.useState(false);
  const POST_CHAR_LIMIT = 5000;
  const charsRemaining = POST_CHAR_LIMIT - content.length;
  const [isNsfw, setIsNsfw] = React.useState(false);
  const [showTags, setShowTags] = React.useState(false);
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  const [mediaUri, setMediaUri] = React.useState<string | null>(null);
  const { mentionQuery, showMentions, insertMention } = useMentions(content, setContent);
  const [selectedCommunity, setSelectedCommunity] = React.useState<any>(
    params.communityId ? { id: params.communityId, name: params.communityName || 'Community' } : null
  );
  const [showCommunityPicker, setShowCommunityPicker] = React.useState(false);
  const { communities } = useCommunities(30);

  // Keep selectedCommunity in sync with incoming params. Expo Router reuses
  // the Create screen across navigations, so the initial useState above only
  // applies on first mount — subsequent "Create Post" from inside a community
  // wouldn't update the selection otherwise.
  // Debounced autosave: while the user types, save the draft every
  // ~1.2s of idle. Flashes a small "Saved" indicator so the user knows
  // their work is preserved even if they navigate away accidentally.
  React.useEffect(() => {
    if (!content.trim()) return;
    const timer = setTimeout(() => {
      try {
        const id = saveDraft(content, selectedCommunity?.id, selectedCommunity?.name);
        draftRef.current = (id as any) || draftRef.current;
        setAutosaveFlash(true);
        const hide = setTimeout(() => setAutosaveFlash(false), 1500);
        return () => clearTimeout(hide);
      } catch {}
    }, 1200);
    return () => clearTimeout(timer);
  }, [content, selectedCommunity?.id]);

  React.useEffect(() => {
    if (params.communityId && selectedCommunity?.id !== params.communityId) {
      setSelectedCommunity({ id: params.communityId, name: params.communityName || 'Community' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.communityId, params.communityName]);

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

  // Blog state
  const [blogTitle, setBlogTitle] = React.useState('');
  const [blogContent, setBlogContent] = React.useState('');

  // Schedule state
  const [scheduleDate, setScheduleDate] = React.useState<string>('');
  const [showSchedule, setShowSchedule] = React.useState(false);

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
    } catch (e) { /* image picker cancelled or unavailable */ }
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
        // Community is optional. Default = global / public timeline,
        // matching legacy Minds behavior and modern social conventions
        // (Twitter, TikTok don't require communities). If a community
        // is selected, post goes there; otherwise it's public.
        if (!content.trim() && !mediaUri) {
          setSubmitting(false);
          return;
        }
        let mediaUrls: string[] | undefined;
        if (mediaUri) {
          try {
            const response = await fetch(mediaUri);
            const blob = await response.blob();
            const contentType = blob.type || 'image/jpeg';
            const uploadRes = await sdk.uploads.getMediaUploadUrl({
              content_type: contentType,
              content_length: blob.size,
            });
            const uploadUrl = uploadRes.data?.upload_url || uploadRes.data?.url;
            if (uploadUrl) {
              const putRes = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });
              if (!putRes.ok) {
                console.error('Media upload PUT failed:', putRes.status, putRes.statusText);
                Alert.alert('Upload Error', `Upload failed: ${putRes.status}`);
              } else {
                mediaUrls = [uploadRes.data?.public_url || uploadUrl.split('?')[0]];
              }
            }
          } catch (err: any) {
            console.error('Media upload error:', err);
            Alert.alert('Image Upload', err?.message || 'Image could not be uploaded. Post will be created without media.');
          }
        }
        await sdk.posts.create({
          content: content.trim() || ' ',
          organization_id: ORG_ID || undefined,
          community_id: selectedCommunity?.id || undefined,
          media_urls: mediaUrls,
        } as any);
        if (draftRef.current) deleteDraft(draftRef.current);
        router.back();
      } else if (mode === 'blog') {
        if (!blogTitle.trim() || !blogContent.trim()) {
          setSubmitting(false);
          return;
        }
        // Upload blog thumbnail if selected
        let blogMediaUrls: string[] | undefined;
        if (mediaUri) {
          try {
            const response = await fetch(mediaUri);
            const blob = await response.blob();
            const contentType = blob.type || 'image/jpeg';
            const uploadRes = await sdk.uploads.getMediaUploadUrl({ content_type: contentType, content_length: blob.size });
            const uploadUrl = uploadRes.data?.upload_url || uploadRes.data?.url;
            if (uploadUrl) {
              const putRes = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });
              if (putRes.ok) blogMediaUrls = [uploadRes.data?.public_url || uploadUrl.split('?')[0]];
            }
          } catch {}
        }
        await sdk.posts.create({
          content: blogContent.trim(),
          title: blogTitle.trim(),
          content_format: 'markdown',
          organization_id: ORG_ID || undefined,
          community_id: selectedCommunity?.id || undefined,
          media_urls: blogMediaUrls,
        } as any);
        if (draftRef.current) deleteDraft(draftRef.current);
        router.back();
      } else if (mode === 'agent') {
        if (!agentName.trim()) { setSubmitting(false); return; }
        const username = agentName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.random().toString(36).slice(2, 6);
        await sdk.agents.create({
          name: agentName.trim(),
          username,
          bio: agentBio.trim() || undefined,
          system_prompt: agentPrompt.trim() || undefined,
          model: MODELS[agentModelIdx].id,
          organization_id: ORG_ID || undefined,
          social_mode: 'chat_only',
          tool_mode: 'chat_only',
        });
        // Auto-post announcement
        try {
          await sdk.posts.create({
            content: `🤖 I just created a new AI agent: **${agentName.trim()}**${agentBio.trim() ? `\n\n${agentBio.trim()}` : ''}\n\nChat with them on Minds!`,
            organization_id: ORG_ID || undefined,
            community_id: selectedCommunity?.id || undefined,
          } as any);
        } catch {}
        setAgentName(''); setAgentBio(''); setAgentPrompt(''); setAvatarUri(null);
        showSuccess('Agent created');
        router.back();
      } else if (mode === 'app') {
        if (!appName.trim()) { setSubmitting(false); return; }
        await sdk.projects.create({
          name: appName.trim(),
          organization_id: ORG_ID || undefined,
        } as any);
        // Auto-post announcement
        try {
          await sdk.posts.create({
            content: `🚀 I just launched a new app: **${appName.trim()}**${appDesc.trim() ? `\n\n${appDesc.trim()}` : ''}\n\nCheck it out on Minds!`,
            organization_id: ORG_ID || undefined,
            community_id: selectedCommunity?.id || undefined,
          } as any);
        } catch {}
        setAppName(''); setAppDesc(''); setAvatarUri(null);
        showSuccess('App created');
        router.back();
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
        // Auto-post announcement
        try {
          await sdk.posts.create({
            content: `🏘️ I just created a new community: **${communityName.trim()}**${communityDesc.trim() ? `\n\n${communityDesc.trim()}` : ''}\n\nJoin us on Minds!`,
            organization_id: ORG_ID || undefined,
          } as any);
        } catch {}
        setCommunityName(''); setCommunityDesc(''); setAvatarUri(null);
        showSuccess('Community created');
        router.back();
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Something went wrong';
      setSuccessMsg(null);
      Alert.alert('Error', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = mode === 'post' ? (content.trim().length > 0 || !!mediaUri)
    : mode === 'blog' ? (blogTitle.trim().length > 0 && blogContent.trim().length > 0)
    : mode === 'agent' ? (agentName.trim().length > 0 && agentBio.trim().length > 0)
    : mode === 'app' ? (appName.trim().length > 0 && appDesc.trim().length > 0)
    : (communityName.trim().length > 0 && communityDesc.trim().length > 0);

  const submitLabel = mode === 'post' ? 'Post'
    : mode === 'blog' ? 'Publish'
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
          borderBottomColor: colors.borderSubtle,
        }}
      >
        <Pressable onPress={() => {
          // Save draft if there's content
          if (mode === 'post' && content.trim()) {
            saveDraft(content, selectedCommunity?.id, selectedCommunity?.name);
          }
          // Delete draft if we had one loaded and user is canceling
          if (draftRef.current && !content.trim()) deleteDraft(draftRef.current);
          router.back();
        }} hitSlop={12}>
          <Text variant="body" color={colors.textSecondary}>Cancel</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {/* Autosave indicator + character count, lighting up only
              when relevant. Saved-flash = 1.5s pulse after debounced
              save. Char count goes red below 0. */}
          {autosaveFlash && mode === 'post' && (
            <Text variant="caption" color={colors.textMuted}>Saved</Text>
          )}
          {mode === 'post' && content.length > POST_CHAR_LIMIT - 240 && (
            <Text
              variant="caption"
              color={charsRemaining < 0 ? colors.error : charsRemaining < 60 ? colors.accent : colors.textMuted}
              style={{ fontVariant: ['tabular-nums'] as any }}
            >
              {charsRemaining}
            </Text>
          )}
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit || submitting || charsRemaining < 0}
            style={{
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.sm,
              borderRadius: radius.full,
              backgroundColor: (canSubmit && charsRemaining >= 0) ? colors.accent : colors.surfaceHover,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator color={colors.textInverse} size="small" />
            ) : (
              <Text variant="bodyMedium" color={(canSubmit && charsRemaining >= 0) ? colors.textInverse : colors.textMuted}>
                {submitLabel}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/*
        Mode switcher hidden on Create. Post is the only first-class mode here.
        Agent / App / Community creation moved to dedicated routes:
          - /agent (agent edit/create)
          - /apps (app catalog)
          - /communities (community discovery + create)
        Keep the modes list around so navigation by ?mode= deep-links still
        works, but don't surface a 5-tab kitchen sink at the top of compose.
      */}

      {/* Content area */}
      {(mode === 'post' || mode === 'blog') ? (
        <View style={{ flex: 1, padding: spacing.xl }}>
          {/* Community picker — optional. Default audience is global,
              matching legacy Minds + modern social conventions. */}
          <View style={{ marginBottom: spacing.md, position: 'relative' }}>
            <Pressable
              onPress={() => setShowCommunityPicker(!showCommunityPicker)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
                backgroundColor: selectedCommunity ? colors.accentSubtle : colors.surface,
                borderRadius: radius.full, alignSelf: 'flex-start',
                borderWidth: 0.5, borderColor: selectedCommunity ? colors.accent + '40' : colors.glassBorder,
              }}
            >
              <Ionicons name={selectedCommunity ? 'people' : 'globe-outline'} size={14} color={selectedCommunity ? colors.accent : colors.textMuted} />
              <Text variant="caption" color={selectedCommunity ? colors.accent : colors.textMuted} style={{ fontSize: 13 }}>
                {selectedCommunity ? selectedCommunity.name : 'Public · pick a community (optional)'}
              </Text>
              <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
            </Pressable>

            <Modal
              visible={showCommunityPicker}
              transparent
              animationType="fade"
              onRequestClose={() => setShowCommunityPicker(false)}
            >
              {/* Native Modal renders into its own top-level layer so sibling
                  elements in the compose form can't bleed through. */}
              <Pressable
                onPress={() => setShowCommunityPicker(false)}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(0,0,0,0.75)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: spacing.xl,
                }}
              >
                <Pressable
                  onPress={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    maxWidth: 420,
                    maxHeight: '80%' as any,
                    backgroundColor: colors.surfaceRaised,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    overflow: 'hidden',
                    ...(Platform.OS === 'web' ? { boxShadow: '0 24px 64px rgba(0,0,0,0.8)' } as any : {}),
                  }}
                >
                  <View style={{ padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
                    <Text variant="label" color={colors.textSecondary}>Choose a community</Text>
                  </View>
                  <ScrollView style={{ maxHeight: 400 }}>
                    {(communities || []).length === 0 ? (
                      <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
                        <Text variant="body" color={colors.textMuted} align="center">No communities yet</Text>
                        <Pressable onPress={() => { setShowCommunityPicker(false); setMode('community' as any); }}>
                          <Text variant="caption" color={colors.accent}>Create one</Text>
                        </Pressable>
                      </View>
                    ) : (
                      (communities || []).map((c: any) => (
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
                      ))
                    )}
                  </ScrollView>
                </Pressable>
              </Pressable>
            </Modal>
          </View>

          <MentionPicker query={mentionQuery} onSelect={insertMention} visible={showMentions} />

          {mode === 'blog' && (
            <>
              <TextInput
                placeholder="Title"
                placeholderTextColor={colors.textMuted}
                value={blogTitle}
                onChangeText={setBlogTitle}
                style={{
                  color: colors.text,
                  fontFamily: 'Geist-SemiBold',
                  fontSize: 22,
                  lineHeight: 28,
                  padding: 0,
                  marginBottom: spacing.md,
                  ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
                }}
              />
              <Pressable
                onPress={handlePickImage}
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.glassBorder,
                  borderRadius: radius.md,
                  padding: mediaUri ? 0 : spacing.xl,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing.lg,
                  overflow: 'hidden',
                }}
              >
                {mediaUri ? (
                  <Image source={{ uri: mediaUri }} style={{ width: '100%', height: 180, borderRadius: radius.md }} resizeMode="cover" />
                ) : (
                  <View style={{ alignItems: 'center', gap: spacing.sm }}>
                    <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                    <Text variant="caption" color={colors.textMuted}>Add cover image</Text>
                  </View>
                )}
              </Pressable>
            </>
          )}

          <View style={{ flexDirection: 'row', gap: spacing.md, flex: 1 }}>
            {mode === 'post' && <Avatar uri={user?.image} name={user?.name} size="md" />}
            <View style={{
              flex: 1,
              // Avatar 'md' is 40px tall, line-height is 24px — shift the
              // first line ~8px down so placeholder/text reads centered with
              // the avatar instead of glued to the top.
              paddingTop: mode === 'post' ? 8 : 0,
            }}>
              <TextInput
                placeholder={mode === 'blog' ? 'Write your blog post... (supports markdown)' : "What's on your mind?"}
                placeholderTextColor={colors.textMuted}
                value={mode === 'blog' ? blogContent : content}
                onChangeText={mode === 'blog' ? setBlogContent : setContent}
                multiline
                autoFocus={false}
                onKeyPress={(e: any) => {
                  if (mode !== 'blog' && Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
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

          {/* Live link preview as the user types a URL — mirrors how the
              post will render after submit. */}
          {mode === 'post' && !mediaUri && content ? (
            <LinkPreview content={content} />
          ) : null}

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
                            borderBottomColor: colors.borderSubtle,
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

      {/* Bottom toolbar (post and blog mode) */}
      {(mode === 'post' || mode === 'blog') && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xl,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            borderTopWidth: 0.5,
            borderTopColor: colors.borderSubtle,
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
          <Pressable
            onPress={() => setShowSchedule(!showSchedule)}
            hitSlop={8}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
              paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
              borderRadius: radius.sm,
              backgroundColor: scheduleDate ? colors.accentSubtle : 'transparent',
              borderWidth: scheduleDate ? 0 : 0.5,
              borderColor: colors.borderSubtle,
            }}
          >
            <Ionicons name="time-outline" size={14} color={scheduleDate ? colors.accent : colors.textMuted} />
            <Text variant="caption" color={scheduleDate ? colors.accent : colors.textMuted} style={{ fontSize: 11 }}>
              {scheduleDate ? new Date(scheduleDate).toLocaleDateString() : 'Schedule'}
            </Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Text variant="caption" color={colors.textMuted}>{(mode === 'blog' ? blogContent : content).length}</Text>
        </View>
      )}
      {showSchedule && (
        <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }}>
          <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>Schedule post for later</Text>
          <TextInput
            placeholder="YYYY-MM-DD HH:MM"
            placeholderTextColor={colors.textMuted}
            value={scheduleDate}
            onChangeText={setScheduleDate}
            style={{
              backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder,
              borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 10,
              color: colors.text, ...typography.body,
              ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
            }}
          />
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
            <Button onPress={() => { setScheduleDate(''); setShowSchedule(false); }} variant="ghost" size="sm">Clear</Button>
            <Button onPress={() => setShowSchedule(false)} size="sm">Set</Button>
          </View>
        </View>
      )}
    </Container>
  );
}
