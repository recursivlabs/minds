import * as React from 'react';
import {
  View,
  TextInput,
  Pressable,
  Image,
  Platform,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { uploadVideo, VideoNotEntitledError } from '../../lib/video';
import { VideoPlayer } from '../../components/VideoPlayer';
const getImagePicker = () => Platform.OS !== 'web' ? require('expo-image-picker') : null;
const getDocumentPicker = () => Platform.OS !== 'web' ? require('expo-document-picker') : null;
import { Text, Button, Input } from '../../components';
import { Container } from '../../components/Container';
import { TabBar } from '../../components/TabBar';
import { MentionPicker, useMentions } from '../../components/MentionPicker';
import { LinkPreview } from '../../components/LinkPreview';
import { getLatestDraft, saveDraft, deleteDraft, clearDraft } from '../../lib/drafts';
import { captureException } from '../../lib/monitoring';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../lib/auth';
import { useCommunities } from '../../lib/hooks';
import { ORG_ID } from '../../lib/recursiv';
import { spacing, radius, typography } from '../../constants/theme';
import { useColors } from '../../lib/theme';

// Consumer Create surface: Post is the only first-class mode. Community
// stays as a reachable mode via ?mode=community deep-link from Discover's
// "+ Start a community" button — but the mode tab bar is hidden. Article /
// Agent / App authoring deferred to the Pro-tier upsell email campaign;
// those branches stay typed only to avoid touching too much during this
// pass.
type Mode = 'post' | 'article' | 'agent' | 'app' | 'community';

const MODES: { key: Mode; label: string }[] = [
  { key: 'post', label: 'Post' },
];

const MAX_IMAGES = 10; // matches the server media_urls cap

// X-style media grid geometry. X uses a 2px hairline gap between tiles and a
// single large-radius frame clipping the whole block.
const GRID_GAP = 2;
const GRID_RADIUS = radius.xl; // ~16px outer frame radius, matching X
const GRID_HEIGHT = 200; // fixed frame height — compact so media never overtakes the text area

/**
 * Small circular remove control overlaid on a media tile (X-style): a
 * semi-transparent dark disc with a white ×, top-right of the tile.
 */
function RemoveMediaButton({
  onPress,
  small,
}: {
  onPress: () => void;
  small?: boolean;
}) {
  const dim = small ? 28 : 30;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }: any) => ({
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
        width: dim,
        height: dim,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        opacity: pressed ? 0.7 : 1,
        ...(Platform.OS === 'web' ? ({ cursor: 'pointer', backdropFilter: 'blur(6px)' } as any) : {}),
      })}
    >
      <Ionicons name="close" size={small ? 16 : 18} color="#ffffff" />
    </Pressable>
  );
}

/** Format seconds → m:ss for the video duration pill. */
function fmtDuration(secs?: number | null): string | null {
  if (secs == null || !isFinite(secs) || secs <= 0) return null;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Round, accent-tinted icon button for the composer toolbar. Goes gold-tinted
 * when its feature is active (media attached, tags present, etc.).
 */
function ToolbarIconButton({
  icon,
  onPress,
  colors,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }: any) => ({
        width: 36,
        height: 36,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? colors.accentMuted : pressed ? colors.surfaceHover : 'transparent',
        ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
      })}
    >
      <Ionicons name={icon} size={21} color={active ? colors.accent : colors.textSecondary} />
    </Pressable>
  );
}

/**
 * X-style character counter. Below ~20% remaining it reveals the live count;
 * otherwise just a tiny dot ring. Goes gold near the limit and red over it.
 */
function CharCounterRing({
  used,
  limit,
  colors,
}: {
  used: number;
  limit: number;
  colors: ReturnType<typeof useColors>;
}) {
  const remaining = limit - used;
  const near = remaining <= 240;
  const over = remaining < 0;
  const color = over ? colors.error : remaining <= 60 ? colors.accent : colors.textMuted;
  if (!near) {
    // Just a small progress dot until you approach the limit.
    return (
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: radius.full,
          borderWidth: 2,
          borderColor: colors.borderSubtle,
        }}
      />
    );
  }
  return (
    <Text
      variant="caption"
      color={color}
      style={{ fontSize: 13, fontVariant: ['tabular-nums'] as any }}
    >
      {remaining}
    </Text>
  );
}

export default function CreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ communityId?: string; communityName?: string; quote?: string; mode?: string; quotePostId?: string; quoteAuthor?: string; quoteContent?: string }>();
  // X-style quote post: when launched from a post's "Quote Post" action, the
  // composer is pre-seeded with the quoted post id (set as reposted_from_id on
  // submit) + a light author/content snippet to render the embedded card.
  const quotePostId = typeof params.quotePostId === 'string' ? params.quotePostId : undefined;
  const quoteAuthor = typeof params.quoteAuthor === 'string' ? params.quoteAuthor : '';
  const quoteContent = typeof params.quoteContent === 'string' ? params.quoteContent : '';
  const { sdk, user } = useAuth();
  const colors = useColors();
  const initialMode: Mode = (params.mode === 'community' || params.mode === 'article' || params.mode === 'agent' || params.mode === 'app') ? params.mode : 'post';
  const [mode, setMode] = React.useState<Mode>(initialMode);

  // Restore draft on mount
  const draftRef = React.useRef<string | null>(null);
  // The exact content we restored. Autosave compares against this and skips
  // while the field is untouched — otherwise restoring a draft would re-stamp
  // it with a fresh timestamp on every open, making it immortal (the old
  // "posted text keeps coming back" bug).
  const restoredContentRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const draft = getLatestDraft();
    // Skip draft restore when quoting — the composer is intentionally a fresh
    // comment on the quoted post, not a continuation of an old draft.
    if (draft && !params.communityId && !quotePostId) {
      setContent(draft.content);
      restoredContentRef.current = draft.content;
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
  const [mediaUris, setMediaUris] = React.useState<string[]>([]);
  // Natural aspect ratio of a SINGLE selected image, captured on load, so the
  // preview shows the whole image (X-style) instead of a cropped fixed box.
  const [media1Aspect, setMedia1Aspect] = React.useState<number | null>(null);
  const [mediaIsVideo, setMediaIsVideo] = React.useState(false);
  // Audio attachment (voice posts / "confessionals"). Mutually exclusive with
  // image/video; uploaded via the same media path (the .mp3/.m4a extension makes
  // the server store it as type='audio' → renders as the inline audio player).
  const [mediaIsAudio, setMediaIsAudio] = React.useState(false);
  const [audioMime, setAudioMime] = React.useState('audio/mpeg');
  const [audioName, setAudioName] = React.useState<string | null>(null);
  // Duration of the selected video, in seconds, for the X-style duration pill.
  const [videoDuration, setVideoDuration] = React.useState<number | null>(null);
  const mediaUri = mediaUris[0] ?? null; // first item — used for video + article cover
  const [videoPct, setVideoPct] = React.useState<number | null>(null);
  const { mentionQuery, showMentions, insertMention } = useMentions(content, setContent);
  const [selectedCommunity, setSelectedCommunity] = React.useState<any>(
    params.communityId ? { id: params.communityId, name: params.communityName || 'Community' } : null
  );
  const [showCommunityPicker, setShowCommunityPicker] = React.useState(false);
  const [communitySearch, setCommunitySearch] = React.useState('');
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
    // Don't re-save a draft we just restored and the user hasn't touched.
    if (content === restoredContentRef.current) return;
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

  // Article state
  const [articleTitle, setArticleTitle] = React.useState('');
  const [articleContent, setArticleContent] = React.useState('');

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
  // Inline error banner. Alert.alert is a no-op on web (React Native Web),
  // so failures were silent — this surfaces them in-UI on every platform.
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Avatar state for agent/app/community creation
  const [avatarUri, setAvatarUri] = React.useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2000);
  };
  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
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

  const handlePickImage = async (kind: 'image' | 'video' | 'all' = 'all') => {
    try {
      // Posts allow multiple images; a video is always single. Article cover is single.
      const allowMulti = mode === 'post' && kind !== 'video';
      const picker = getImagePicker();
      if (picker) {
        const result = await picker.launchImageLibraryAsync({
          mediaTypes: kind === 'video' ? picker.MediaTypeOptions.Videos
            : kind === 'image' ? picker.MediaTypeOptions.Images
            : picker.MediaTypeOptions.All,
          allowsMultipleSelection: allowMulti,
          selectionLimit: allowMulti ? MAX_IMAGES : 1,
          quality: 0.8,
        });
        if (!result.canceled && result.assets?.length) {
          const assets = result.assets;
          setMediaIsAudio(false);
          setAudioName(null);
          const vid = assets.find((a: any) => a.type === 'video');
          if (vid) {
            setMediaUris([vid.uri]);
            setMediaIsVideo(true);
            // expo-image-picker reports duration in milliseconds.
            setVideoDuration(vid.duration ? vid.duration / 1000 : null);
          } else {
            setMediaUris(assets.map((a: any) => a.uri).slice(0, allowMulti ? MAX_IMAGES : 1));
            setMediaIsVideo(false);
            setVideoDuration(null);
          }
        }
      } else if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = kind === 'video' ? 'video/*' : kind === 'image' ? 'image/*' : 'image/*,video/*';
        if (allowMulti) input.multiple = true;
        input.onchange = (e: any) => {
          const files: File[] = Array.from(e.target?.files || []);
          if (!files.length) return;
          setMediaIsAudio(false);
          setAudioName(null);
          const vid = files.find((f) => (f.type || '').startsWith('video/'));
          if (vid) {
            const url = URL.createObjectURL(vid);
            setMediaUris([url]);
            setMediaIsVideo(true);
            setVideoDuration(null);
            // Pull duration off the video metadata for the duration pill.
            try {
              const probe = document.createElement('video');
              probe.preload = 'metadata';
              probe.onloadedmetadata = () => setVideoDuration(probe.duration || null);
              probe.src = url;
            } catch {}
          } else {
            setMediaUris(files.slice(0, MAX_IMAGES).map((f) => URL.createObjectURL(f)));
            setMediaIsVideo(false);
            setVideoDuration(null);
          }
        };
        input.click();
      }
    } catch {}
  };

  // Attach an audio file (voice post). Native uses the document picker; web a
  // file input. The audio mime drives the upload content-type so the stored URL
  // gets an audio extension (→ server type='audio' → inline audio player).
  const handlePickAudio = async () => {
    try {
      const dp = getDocumentPicker();
      if (dp) {
        const res = await dp.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true, multiple: false });
        const asset = res?.assets?.[0];
        if (asset) {
          setMediaUris([asset.uri]);
          setMediaIsAudio(true);
          setMediaIsVideo(false);
          setVideoDuration(null);
          setAudioMime(asset.mimeType || 'audio/mpeg');
          setAudioName(asset.name || 'Audio');
        }
      } else if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = (e: any) => {
          const file: File | undefined = e.target?.files?.[0];
          if (!file) return;
          setMediaUris([URL.createObjectURL(file)]);
          setMediaIsAudio(true);
          setMediaIsVideo(false);
          setVideoDuration(null);
          setAudioMime(file.type || 'audio/mpeg');
          setAudioName(file.name || 'Audio');
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
        // A quote post is valid even with empty content (the quoted post is the
        // payload); a normal post still needs content or media.
        if (!content.trim() && !mediaUri && !quotePostId) {
          setSubmitting(false);
          return;
        }
        let mediaUrls: string[] | undefined;
        if (!mediaIsVideo && mediaUris.length > 0) {
          const urls: string[] = [];
          for (const uri of mediaUris) {
            try {
              const response = await fetch(uri);
              const blob = await response.blob();
              // Audio: use the picked mime (native blobs often have an empty
              // type) so the upload key gets a .mp3/.m4a extension → type='audio'.
              const contentType = mediaIsAudio ? audioMime : (blob.type || 'image/jpeg');
              const uploadRes = await sdk.uploads.getMediaUploadUrl({
                content_type: contentType,
                content_length: blob.size,
              });
              const uploadUrl = uploadRes.data?.upload_url || (uploadRes.data as any)?.url;
              if (uploadUrl) {
                const putRes = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });
                if (!putRes.ok) {
                  console.error('Media upload PUT failed:', putRes.status, putRes.statusText);
                  showError(`An image upload failed (${putRes.status}).`);
                } else {
                  urls.push(uploadRes.data?.public_url || uploadUrl.split('?')[0]);
                }
              }
            } catch (err: any) {
              console.error('Media upload error:', err);
              showError(err?.message || 'An image could not be uploaded.');
            }
          }
          if (urls.length) mediaUrls = urls;
        }
        if (mediaUri && mediaIsVideo) {
          try {
            setVideoPct(0);
            const { hlsUrl } = await uploadVideo({
              fileUri: mediaUri,
              title: content.trim().slice(0, 80) || 'Video',
              onProgress: setVideoPct,
            });
            mediaUrls = [...(mediaUrls || []), hlsUrl];
          } catch (err: any) {
            setVideoPct(null);
            setSubmitting(false);
            // Not entitled → send them to the upgrade flow instead of a dead-end error.
            if (err instanceof VideoNotEntitledError) {
              router.push('/upgrade' as any);
            } else {
              showError(err?.message || 'Video could not be uploaded.');
            }
            return;
          }
          setVideoPct(null);
        }
        await sdk.posts.create({
          // Quote posts may carry empty content (the embedded post is the
          // payload); only pad to a space for plain posts where the server
          // historically required non-empty content.
          content: content.trim() || (quotePostId ? '' : ' '),
          reposted_from_id: quotePostId || undefined,
          organization_id: ORG_ID || undefined,
          community_id: selectedCommunity?.id || undefined,
          media_urls: mediaUrls,
          is_nsfw: isNsfw || undefined,
        } as any);
        // Reset the composer — it's a persistent tab, so without this the old
        // text/media would still be sitting there next time you open it.
        setContent('');
        setMediaUris([]);
        setMediaIsVideo(false);
        setMediaIsAudio(false);
        setAudioName(null);
        setVideoDuration(null);
        setVideoPct(null);
        setIsNsfw(false);
        clearDraft();
        draftRef.current = null;
        // Land on the Following feed so you see your just-posted content as
        // immediate proof it worked (your own posts now show there).
        router.replace({ pathname: '/(tabs)', params: { tab: 'following' } });
      } else if (mode === 'article') {
        if (!articleTitle.trim() || !articleContent.trim()) {
          setSubmitting(false);
          return;
        }
        // Upload article cover if selected
        let articleMediaUrls: string[] | undefined;
        if (mediaUri) {
          try {
            const response = await fetch(mediaUri);
            const blob = await response.blob();
            const contentType = blob.type || 'image/jpeg';
            const uploadRes = await sdk.uploads.getMediaUploadUrl({ content_type: contentType, content_length: blob.size });
            const uploadUrl = uploadRes.data?.upload_url || (uploadRes.data as any)?.url;
            if (uploadUrl) {
              const putRes = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });
              if (putRes.ok) articleMediaUrls = [uploadRes.data?.public_url || uploadUrl.split('?')[0]];
            }
          } catch {}
        }
        await sdk.posts.create({
          content: articleContent.trim(),
          title: articleTitle.trim(),
          content_format: 'markdown',
          organization_id: ORG_ID || undefined,
          community_id: selectedCommunity?.id || undefined,
          media_urls: articleMediaUrls,
        } as any);
        if (draftRef.current) deleteDraft(draftRef.current);
        router.back();
      } else if (mode === 'agent') {
        if (!agentName.trim()) { setSubmitting(false); return; }
        const username = `${agentName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Math.random().toString(36).slice(2, 6)}`;
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
        const slug = `${communityName.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 6)}`;
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
      captureException(err, { action: 'create', mode });
      const errMsg = err?.message || 'Something went wrong';
      setSuccessMsg(null);
      showError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = mode === 'post' ? (content.trim().length > 0 || !!mediaUri || !!quotePostId)
    : mode === 'article' ? (articleTitle.trim().length > 0 && articleContent.trim().length > 0)
    : mode === 'agent' ? (agentName.trim().length > 0 && agentBio.trim().length > 0)
    : mode === 'app' ? (appName.trim().length > 0 && appDesc.trim().length > 0)
    : (communityName.trim().length > 0 && communityDesc.trim().length > 0);

  const submitLabel = mode === 'post' ? 'Post'
    : mode === 'article' ? 'Publish'
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
          // In a builder mode (community/article/agent/app), this is the persistent
          // Create tab — going "back" stranded you in that mode. Instead, return
          // to the default Post composer in-place.
          if (mode !== 'post') {
            setMode('post');
            try { router.setParams({ mode: undefined } as any); } catch {}
            return;
          }
          // Save draft if there's content
          if (content.trim()) {
            saveDraft(content, selectedCommunity?.id, selectedCommunity?.name);
          }
          // Delete draft if we had one loaded and user is canceling
          if (draftRef.current && !content.trim()) deleteDraft(draftRef.current);
          router.back();
        }} hitSlop={12}>
          <Text variant="body" color={colors.textSecondary}>{mode === 'post' ? 'Cancel' : '‹ New post'}</Text>
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
      {(mode === 'post' || mode === 'article') ? (
        <View style={{ flex: 1, padding: spacing.xl }}>
          {/* The error/success banners below were only rendered in the
              agent/app/community branch, so a failed post submit showed
              NOTHING in post mode — the flagship action of the app. */}
          {errorMsg && (
            <Pressable onPress={() => setErrorMsg(null)} style={{ backgroundColor: colors.errorMuted, padding: spacing.md, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text variant="body" color={colors.error} style={{ flex: 1 }}>{errorMsg}</Text>
            </Pressable>
          )}
          {successMsg && (
            <View style={{ backgroundColor: colors.successMuted, padding: spacing.md, borderRadius: radius.md, alignItems: 'center', marginBottom: spacing.md }}>
              <Text variant="body" color={colors.success}>{successMsg}</Text>
            </View>
          )}
          {/* Community picker — optional. Default audience is global,
              matching legacy Minds + modern social conventions. */}
          <View style={{ marginBottom: spacing.md, position: 'relative' }}>
            <Pressable
              onPress={() => { setCommunitySearch(''); setShowCommunityPicker(!showCommunityPicker); }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                paddingLeft: spacing.md, paddingRight: spacing.sm, paddingVertical: spacing.sm,
                backgroundColor: selectedCommunity ? colors.accentSubtle : colors.surface,
                borderRadius: radius.full, alignSelf: 'flex-start',
                borderWidth: 0.5, borderColor: selectedCommunity ? `${colors.accent}40` : colors.glassBorder,
                opacity: pressed ? 0.75 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Ionicons name={selectedCommunity ? 'people' : 'globe-outline'} size={15} color={selectedCommunity ? colors.accent : colors.textSecondary} />
              <Text variant="caption" color={selectedCommunity ? colors.accent : colors.text} style={{ fontSize: 13, fontFamily: 'Roboto-Medium' }}>
                {selectedCommunity ? selectedCommunity.name : 'Global'}
              </Text>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
              </View>
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
                  backgroundColor: colors.scrimStrong,
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
                  <View style={{ padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, gap: spacing.sm }}>
                    <Text variant="label" color={colors.textSecondary}>Post to</Text>
                    {/* Search — people can be in a lot of communities. */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.glassBorder, paddingHorizontal: spacing.md }}>
                      <Ionicons name="search" size={15} color={colors.textMuted} />
                      <TextInput
                        value={communitySearch}
                        onChangeText={setCommunitySearch}
                        placeholder="Search your communities"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        style={{ flex: 1, paddingVertical: spacing.sm, color: colors.text, fontFamily: 'Roboto-Regular', fontSize: 14, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
                      />
                      {communitySearch.length > 0 && (
                        <Pressable onPress={() => setCommunitySearch('')} hitSlop={8}>
                          <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                        </Pressable>
                      )}
                    </View>
                  </View>
                  <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
                    {/* Global (default) — always available to switch back to. */}
                    <Pressable
                      onPress={() => { setSelectedCommunity(null); setShowCommunityPicker(false); }}
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                        paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
                        backgroundColor: !selectedCommunity ? colors.accentSubtle : pressed ? colors.surfaceHover : 'transparent',
                        borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle,
                      })}
                    >
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="globe-outline" size={18} color={!selectedCommunity ? colors.accent : colors.textSecondary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="body" color={!selectedCommunity ? colors.accent : colors.text}>Global</Text>
                        <Text variant="caption" color={colors.textMuted}>Everyone on Minds</Text>
                      </View>
                      {!selectedCommunity && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                    </Pressable>

                    {(() => {
                      const q = communitySearch.trim().toLowerCase();
                      const list = (communities || []).filter((c: any) => !q || (c.name || '').toLowerCase().includes(q));
                      if ((communities || []).length === 0) {
                        return (
                          <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
                            <Text variant="body" color={colors.textMuted} align="center">You haven't joined any communities yet</Text>
                          </View>
                        );
                      }
                      if (list.length === 0) {
                        return (
                          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                            <Text variant="body" color={colors.textMuted} align="center">No matches for "{communitySearch}"</Text>
                          </View>
                        );
                      }
                      return list.map((c: any) => (
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
                      ));
                    })()}
                  </ScrollView>
                  {/* Discover more communities. */}
                  <Pressable
                    onPress={() => { setShowCommunityPicker(false); router.push('/(tabs)/communities' as any); }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
                      paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSubtle,
                      backgroundColor: pressed ? colors.surfaceHover : colors.surface,
                      ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                    })}
                  >
                    <Ionicons name="compass-outline" size={16} color={colors.accent} />
                    <Text variant="bodyMedium" color={colors.accent}>Discover communities</Text>
                  </Pressable>
                </Pressable>
              </Pressable>
            </Modal>
          </View>

          <MentionPicker query={mentionQuery} onSelect={insertMention} visible={showMentions} />

          {mode === 'article' && (
            <>
              <TextInput
                placeholder="Article title"
                placeholderTextColor={colors.textMuted}
                value={articleTitle}
                onChangeText={setArticleTitle}
                style={{
                  color: colors.text,
                  fontFamily: 'Roboto-Medium',
                  fontSize: 22,
                  lineHeight: 28,
                  padding: 0,
                  marginBottom: spacing.md,
                  ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
                }}
              />
              <Pressable
                onPress={() => handlePickImage()}
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

          <View style={{ flexDirection: 'row', gap: spacing.lg, flex: 1 }}>
            {mode === 'post' && <Avatar uri={user?.image} name={user?.name} size="md" />}
            <View style={{
              flex: 1,
              // Avatar 'md' is 40px tall, line-height is 26px — shift the
              // first line ~6px down so placeholder/text reads centered with
              // the avatar instead of glued to the top.
              paddingTop: mode === 'post' ? 6 : 0,
            }}>
              <TextInput
                placeholder={mode === 'article' ? 'Write your article…  (markdown supported)' : quotePostId ? 'Add a comment' : "What's happening?"}
                placeholderTextColor={colors.textMuted}
                value={mode === 'article' ? articleContent : content}
                onChangeText={mode === 'article' ? setArticleContent : setContent}
                multiline
                autoFocus={false}
                onKeyPress={(e: any) => {
                  if (mode !== 'article' && Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                style={{
                  color: colors.text,
                  ...typography.body,
                  fontSize: 19,
                  lineHeight: 26,
                  padding: 0,
                  flex: 1,
                  minHeight: 96,
                  textAlignVertical: 'top',
                  ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
                }}
              />
            </View>
          </View>

          {/* Embedded quoted post preview (X-style quote-tweet card). Shown when
              the composer is launched from a post's "Quote Post" action so the
              user sees exactly what they're quoting while they type. */}
          {mode === 'post' && quotePostId && (
            <View
              style={{
                marginTop: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.lg,
                padding: spacing.md,
                gap: spacing.xs,
              }}
            >
              {quoteAuthor ? (
                <Text variant="bodyMedium" numberOfLines={1} style={{ fontSize: 13 }}>{quoteAuthor}</Text>
              ) : null}
              {quoteContent ? (
                <Text variant="body" color={colors.textSecondary} numberOfLines={4} style={{ lineHeight: 20 }}>
                  {quoteContent}
                </Text>
              ) : (
                <Text variant="caption" color={colors.textMuted}>Quoting a post</Text>
              )}
            </View>
          )}

          {mediaUris.length > 0 && (
            <View style={{ marginTop: spacing.lg }}>
              {mediaIsAudio ? (
                // Audio: a compact chip (music glyph + filename + remove). The
                // full inline player renders once the post is published.
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.borderSubtle, backgroundColor: colors.surface }}>
                  <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="musical-notes" size={22} color={colors.accent} />
                  </View>
                  <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>{audioName || 'Audio'}</Text>
                  <Pressable onPress={() => { setMediaUris([]); setMediaIsAudio(false); setAudioName(null); }} hitSlop={8}>
                    <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                  </Pressable>
                </View>
              ) : mediaIsVideo ? (
                // Video: one rounded frame (matching the image grid) holding the
                // player, a centered round play glyph, a duration pill bottom-left,
                // and the × remove control top-right — X-style.
                <View
                  style={{
                    position: 'relative',
                    height: GRID_HEIGHT,
                    borderRadius: GRID_RADIUS,
                    overflow: 'hidden',
                    backgroundColor: '#000',
                    borderWidth: 0.5,
                    borderColor: colors.borderSubtle,
                  }}
                >
                  <VideoPlayer uri={mediaUris[0]} autoplay={false} height={GRID_HEIGHT} />
                  {/* Centered play glyph. pointerEvents none so it doesn't
                      steal taps from the player's own mute toggle. */}
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0, bottom: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: radius.full,
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        borderWidth: 1.5,
                        borderColor: 'rgba(255,255,255,0.85)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(4px)' } as any) : {}),
                      }}
                    >
                      <Ionicons name="play" size={26} color="#ffffff" style={{ marginLeft: 3 }} />
                    </View>
                  </View>
                  {fmtDuration(videoDuration) && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        bottom: spacing.sm,
                        left: spacing.sm,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 3,
                        borderRadius: radius.sm,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                      }}
                    >
                      <Text variant="caption" style={{ color: '#ffffff', fontSize: 12, fontVariant: ['tabular-nums'] as any }}>
                        {fmtDuration(videoDuration)}
                      </Text>
                    </View>
                  )}
                  <RemoveMediaButton onPress={() => { setMediaUris([]); setMediaIsVideo(false); setMediaIsAudio(false); setAudioName(null); setVideoDuration(null); }} />
                </View>
              ) : (
                // Image grid — X-style, clipped into one rounded frame so the
                // whole block reads as a single cohesive card.
                //   1 → one large ~16:9 tile
                //   2 → two equal side-by-side tiles (full height)
                //   3 → one large left, two stacked right
                //   4 → clean 2×2 grid
                <View
                  style={{
                    // Single image renders at its NATURAL aspect (not a cropped
                    // fixed box); 2+ use the fixed-height X-style grid.
                    height: mediaUris.length === 1 ? undefined : GRID_HEIGHT,
                    flexDirection: 'row',
                    gap: GRID_GAP,
                    borderRadius: GRID_RADIUS,
                    overflow: 'hidden',
                    borderWidth: 0.5,
                    borderColor: colors.borderSubtle,
                  }}
                >
                  {(() => {
                    const remove = (i: number) =>
                      setMediaUris((prev) => prev.filter((_, idx) => idx !== i));
                    const tile = (uri: string, i: number) => (
                      <View key={`${uri}-${i}`} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                        <Image
                          source={{ uri }}
                          style={{ width: '100%', height: '100%', backgroundColor: colors.surfaceHover }}
                          resizeMode="cover"
                        />
                        <RemoveMediaButton small onPress={() => remove(i)} />
                      </View>
                    );
                    const items = mediaUris.slice(0, 4);
                    const n = items.length;

                    if (n === 1) {
                      return (
                        <View style={{ width: '100%', position: 'relative', overflow: 'hidden' }}>
                          <Image
                            source={{ uri: items[0] }}
                            style={{ width: '100%', aspectRatio: media1Aspect || 1.5, maxHeight: 440, backgroundColor: colors.surfaceHover }}
                            resizeMode="cover"
                            onLoad={(e: any) => {
                              const src = e?.source || e?.nativeEvent?.source;
                              if (src?.width && src?.height) setMedia1Aspect(src.width / src.height);
                            }}
                          />
                          <RemoveMediaButton small onPress={() => remove(0)} />
                        </View>
                      );
                    }
                    if (n === 2) return items.map((u, i) => tile(u, i));
                    if (n === 3) {
                      return (
                        <>
                          {tile(items[0], 0)}
                          <View style={{ flex: 1, gap: GRID_GAP }}>
                            {tile(items[1], 1)}
                            {tile(items[2], 2)}
                          </View>
                        </>
                      );
                    }
                    // 4-up: two columns, each two stacked tiles.
                    return (
                      <>
                        <View style={{ flex: 1, gap: GRID_GAP }}>
                          {tile(items[0], 0)}
                          {tile(items[2], 2)}
                        </View>
                        <View style={{ flex: 1, gap: GRID_GAP }}>
                          {tile(items[1], 1)}
                          {tile(items[3], 3)}
                        </View>
                      </>
                    );
                  })()}
                </View>
              )}
              {/* +N more indicator when over 4 selected (X caps the visible
                  grid at 4; the rest still upload). */}
              {!mediaIsVideo && mediaUris.length > 4 && (
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
                  +{mediaUris.length - 4} more attached
                </Text>
              )}
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

          {errorMsg && (
            <Pressable onPress={() => setErrorMsg(null)} style={{ backgroundColor: colors.errorMuted, padding: spacing.md, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text variant="body" color={colors.error} style={{ flex: 1 }}>{errorMsg}</Text>
            </Pressable>
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

      {/* Bottom toolbar (post and article mode) — X-style: a row of round,
          accent-tinted icon buttons on the left, then a character counter +
          prominent Post button on the right. */}
      {(mode === 'post' || mode === 'article') && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderTopWidth: 0.5,
            borderTopColor: colors.borderSubtle,
          }}
        >
          {/* Post ⇄ Article: switch to the long-form editor (title + cover +
              markdown body). Back-arrow in the header returns to Post. */}
          <ToolbarIconButton
            icon="document-text-outline"
            active={mode === 'article'}
            onPress={() => setMode(mode === 'article' ? 'post' : 'article')}
            colors={colors}
          />
          {/* Distinct image / video / music affordances so it's obvious you can
             attach any of the three. */}
          <ToolbarIconButton
            icon="image-outline"
            active={!!mediaUri && !mediaIsAudio && !mediaIsVideo}
            onPress={() => handlePickImage('image')}
            colors={colors}
          />
          <ToolbarIconButton
            icon="videocam-outline"
            active={mediaIsVideo}
            onPress={() => handlePickImage('video')}
            colors={colors}
          />
          <ToolbarIconButton
            icon="musical-notes-outline"
            active={mediaIsAudio}
            onPress={handlePickAudio}
            colors={colors}
          />
          <ToolbarIconButton
            icon="pricetag-outline"
            active={tags.length > 0}
            onPress={() => setShowTags(!showTags)}
            colors={colors}
          />
          <ToolbarIconButton
            icon="time-outline"
            active={!!scheduleDate}
            onPress={() => setShowSchedule(!showSchedule)}
            colors={colors}
          />
          <Pressable
            onPress={() => setIsNsfw(!isNsfw)}
            style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: spacing.md, height: 36,
              borderRadius: radius.full,
              backgroundColor: isNsfw ? colors.errorMuted : 'transparent',
              borderWidth: isNsfw ? 0 : 0.5,
              borderColor: colors.borderSubtle,
              marginLeft: spacing.xs,
            }}
          >
            <Text variant="caption" color={isNsfw ? colors.error : colors.textMuted} style={{ fontSize: 12 }}>NSFW</Text>
          </Pressable>

          {videoPct !== null && (
            <Text variant="caption" color={colors.accent} style={{ marginLeft: spacing.sm }}>{`Uploading ${videoPct}%`}</Text>
          )}

          <View style={{ flex: 1 }} />

          {/* Character counter — only surfaces once you start typing.
              Stays muted, goes gold near the limit, red over it. */}
          {(mode === 'article' ? articleContent : content).length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginRight: spacing.md }}>
              <CharCounterRing
                used={(mode === 'article' ? articleContent : content).length}
                limit={POST_CHAR_LIMIT}
                colors={colors}
              />
            </View>
          )}

        </View>
      )}
      <ScheduleModal
        visible={showSchedule}
        value={scheduleDate}
        onChange={setScheduleDate}
        onClose={() => setShowSchedule(false)}
        colors={colors}
      />
    </Container>
  );
}

/**
 * Modern schedule picker presented in a rounded sheet/card, X-style.
 * Web uses a styled native `datetime-local` input (calendar + clock UI);
 * native presents clean date + time text fields. Either way it writes a
 * `YYYY-MM-DD HH:MM` string to `scheduleDate` — the same value the
 * post-create call already consumes — so scheduling logic is untouched.
 */
function ScheduleModal({
  visible,
  value,
  onChange,
  onClose,
  colors,
}: {
  visible: boolean;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  // Draft so Clear/Set/Cancel don't mutate the committed value until confirmed.
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => { if (visible) setDraft(value); }, [visible]);

  // Bridge between the committed `YYYY-MM-DD HH:MM` string and the web
  // datetime-local format (`YYYY-MM-DDTHH:MM`).
  const toLocalInput = (v: string) => (v ? v.replace(' ', 'T').slice(0, 16) : '');
  const fromLocalInput = (v: string) => (v ? v.replace('T', ' ').slice(0, 16) : '');

  // Native split fields.
  const [datePart, timePart] = (() => {
    const [d = '', t = ''] = (draft || '').split(' ');
    return [d, t];
  })();
  const setDatePart = (d: string) => setDraft(`${d}${timePart ? ` ${timePart}` : ''}`.trim());
  const setTimePart = (t: string) => setDraft(`${datePart}${t ? ` ${t}` : ''}`.trim());

  const prettyPreview = draft
    ? draft
    : 'No time set';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: colors.scrimStrong,
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
            backgroundColor: colors.surfaceRaised,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            ...(Platform.OS === 'web' ? ({ boxShadow: '0 24px 64px rgba(0,0,0,0.8)' } as any) : {}),
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.lg,
              borderBottomWidth: 0.5,
              borderBottomColor: colors.borderSubtle,
            }}
          >
            <View
              style={{
                width: 34, height: 34, borderRadius: radius.full,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: colors.accentMuted,
              }}
            >
              <Ionicons name="time-outline" size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" color={colors.text}>Schedule post</Text>
              <Text variant="caption" color={colors.textMuted}>{prettyPreview}</Text>
            </View>
          </View>

          {/* Picker body */}
          <View style={{ padding: spacing.xl, gap: spacing.md }}>
            {/* Make the schedule timezone explicit — the times below are the
               user's LOCAL time, so tell them which zone that is. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Ionicons name="globe-outline" size={12} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>
                {(() => {
                  let tz = '';
                  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
                  const m = -new Date().getTimezoneOffset();
                  const off = `GMT${m >= 0 ? '+' : '-'}${Math.floor(Math.abs(m) / 60)}${Math.abs(m) % 60 ? ':' + String(Math.abs(m) % 60).padStart(2, '0') : ''}`;
                  return `Your timezone${tz ? ` — ${tz.replace(/_/g, ' ')}` : ''} (${off})`;
                })()}
              </Text>
            </View>
            {Platform.OS === 'web' ? (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 0.5,
                  borderColor: colors.glassBorder,
                  borderRadius: radius.lg,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                }}
              >
                {React.createElement('input' as any, {
                  type: 'datetime-local',
                  value: toLocalInput(draft),
                  onChange: (e: any) => setDraft(fromLocalInput(e.target.value)),
                  style: {
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: colors.text,
                    fontFamily: 'Roboto-Regular',
                    fontSize: 16,
                    colorScheme: 'dark',
                  },
                })}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1.4 }}>
                  <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.xs }}>Date</Text>
                  <TextInput
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textMuted}
                    value={datePart}
                    onChangeText={setDatePart}
                    style={{
                      backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder,
                      borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: 12,
                      color: colors.text, ...typography.body,
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.xs }}>Time</Text>
                  <TextInput
                    placeholder="HH:MM"
                    placeholderTextColor={colors.textMuted}
                    value={timePart}
                    onChangeText={setTimePart}
                    style={{
                      backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder,
                      borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: 12,
                      color: colors.text, ...typography.body,
                    }}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Actions */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingHorizontal: spacing.xl,
              paddingBottom: spacing.xl,
            }}
          >
            <Button onPress={() => { setDraft(''); onChange(''); onClose(); }} variant="ghost" size="sm">Clear</Button>
            <View style={{ flex: 1 }} />
            <Button onPress={onClose} variant="ghost" size="sm">Cancel</Button>
            <Button onPress={() => { onChange(draft.trim()); onClose(); }} size="sm">Set time</Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
