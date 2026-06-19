import * as React from 'react';
import { View, Image, Pressable, Modal, Platform, Dimensions, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { VideoPlayer } from './VideoPlayer';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';
import { SITE_URL } from '../lib/recursiv';
import { extractVideoGuid, getVideoStatus, type VideoStatus } from '../lib/video';

/**
 * Video media that gates playback on encode status: while Bunny is still
 * transcoding it shows the thumbnail + a "Processing…" overlay (polling until
 * ready) instead of a dead 0:00 player, then swaps in the real player.
 */
function VideoMedia({ url, height }: { url: string; height: number }) {
  const guid = React.useMemo(() => extractVideoGuid(url), [url]);
  // Non-Bunny URL (no guid) → play directly, no status gating.
  const [status, setStatus] = React.useState<VideoStatus | null>(
    guid ? null : { status: 'ready', progress: 100, thumbnailUrl: null, hlsUrl: url },
  );

  React.useEffect(() => {
    if (!guid) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let attempt = 0;
    const startedAt = Date.now();
    const poll = async () => {
      const s = await getVideoStatus(guid);
      if (!alive) return;
      // If the status lookup fails outright, optimistically try to play.
      setStatus(s ?? { status: 'ready', progress: 100, thumbnailUrl: null, hlsUrl: url });
      if (s && (s.status === 'processing' || s.status === null)) {
        // Backoff with a hard stop. A fixed 4s poll with no cap meant a video
        // whose encode webhook was lost kept EVERY viewer polling forever —
        // a popular stuck video becomes a self-inflicted DDoS on the status
        // route.
        if (Date.now() - startedAt > 10 * 60_000) return;
        attempt += 1;
        timer = setTimeout(poll, Math.min(4000 * 2 ** Math.min(attempt - 1, 4), 60_000));
      }
    };
    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [guid, url]);

  if (status?.status === 'ready') {
    return <VideoPlayer uri={status.hlsUrl || url} poster={status.thumbnailUrl || undefined} height={height} />;
  }
  if (status?.status === 'failed') {
    return <VideoStatusBox thumbnail={status.thumbnailUrl} label="Video couldn't be processed" icon="alert-circle-outline" height={height} />;
  }
  // Unknown (first fetch in flight) or processing.
  return (
    <VideoStatusBox
      thumbnail={status?.thumbnailUrl ?? null}
      label={status ? `Processing… ${status.progress || 0}%` : 'Loading…'}
      height={height}
      spinner
    />
  );
}

function VideoStatusBox({
  thumbnail,
  label,
  icon,
  height,
  spinner,
}: {
  thumbnail: string | null;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  height: number;
  spinner?: boolean;
}) {
  return (
    <View
      style={{
        width: '100%',
        aspectRatio: 16 / 9,
        maxHeight: height,
        borderRadius: radius.md,
        overflow: 'hidden',
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {thumbnail ? (
        <Image
          source={{ uri: thumbnail, headers: { Referer: SITE_URL } }}
          style={[StyleSheet.absoluteFillObject, { opacity: 0.45 }]}
          resizeMode="cover"
        />
      ) : null}
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        {spinner ? <ActivityIndicator color="#fff" /> : icon ? <Ionicons name={icon} size={30} color="#fff" /> : null}
        <Text variant="caption" style={{ color: '#fff' }}>{label}</Text>
      </View>
    </View>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.avi', '.m3u8'];
const isVideoUrl = (url: string): boolean =>
  VIDEO_EXTENSIONS.some(ext => url.toLowerCase().includes(ext)) ||
  url.includes('cloudflarestream') ||
  url.includes('/video/');

interface MediaItem {
  url: string;
  type?: string;
  id?: string;
  width?: number;
  height?: number;
}

const MAX_IMAGE_HEIGHT = 500;
const MIN_IMAGE_HEIGHT = 200;

function PostImage({ uri, onPress, badge, initialWidth, initialHeight }: {
  uri: string;
  onPress: () => void;
  badge?: React.ReactNode;
  initialWidth?: number;
  initialHeight?: number;
}) {
  const colors = useColors();
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(
    initialWidth && initialHeight ? { w: initialWidth, h: initialHeight } : null
  );

  React.useEffect(() => {
    if (size) return;
    let cancelled = false;
    Image.getSize(
      uri,
      (w, h) => { if (!cancelled) setSize({ w, h }); },
      () => { if (!cancelled) setSize({ w: 16, h: 9 }); },
    );
    return () => { cancelled = true; };
  }, [uri, size]);

  const aspectRatio = size ? size.w / size.h : 16 / 9;

  return (
    <Pressable onPress={onPress}>
      <View style={{
        width: '100%',
        aspectRatio,
        maxHeight: MAX_IMAGE_HEIGHT,
        minHeight: MIN_IMAGE_HEIGHT,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceHover,
        overflow: 'hidden',
      }}>
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="contain"
        />
        {badge}
      </View>
    </Pressable>
  );
}

interface Props {
  media: MediaItem[] | string | null;
  thumbnail?: string | null;
}

/**
 * Renders post media — images with lightbox, videos with player.
 * Handles single items, arrays, and string URLs.
 */
export const MediaViewer = React.memo(function MediaViewer({ media, thumbnail }: Props) {
  const colors = useColors();
  const [lightboxVisible, setLightboxVisible] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);

  // Normalize media to array of { url, type }
  const items: MediaItem[] = React.useMemo(() => {
    if (!media) return [];
    if (typeof media === 'string') return [{ url: media, type: isVideoUrl(media) ? 'video' : 'image' }];
    if (Array.isArray(media)) return media.map(m => ({
      url: typeof m === 'string' ? m : m.url,
      type: (typeof m === 'string' ? undefined : m.type) || (isVideoUrl(typeof m === 'string' ? m : m.url) ? 'video' : 'image'),
    }));
    return [];
  }, [media]);

  if (items.length === 0 && !thumbnail) return null;

  const displayItems = items.length > 0 ? items : (thumbnail ? [{ url: thumbnail, type: 'image' }] : []);
  if (displayItems.length === 0) return null;

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxVisible(true);
  };

  // Split videos (full-width players) from images (an X-style multi-image grid,
  // so 2+ images tile into columns instead of stacking down one column).
  const videoItems = displayItems.map((it, idx) => ({ it, idx })).filter(x => x.it.type === 'video');
  const imageItems = displayItems.map((it, idx) => ({ it, idx })).filter(x => x.it.type !== 'video');
  const GAP = 2;
  const GRID_H = Platform.OS === 'web' ? 360 : 240;
  const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

  const Tile = ({ entry, style, plus }: { entry: { it: MediaItem; idx: number }; style?: any; plus?: number }) => (
    <Pressable
      onPress={() => openLightbox(entry.idx)}
      style={[{ overflow: 'hidden', backgroundColor: colors.surface }, style, Platform.OS === 'web' ? { cursor: 'pointer' } as any : null]}
    >
      <Image source={{ uri: entry.it.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      {plus ? (
        <View style={[FILL, { backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#fff', fontSize: 24, fontFamily: 'Roboto-Medium' }}>+{plus}</Text>
        </View>
      ) : null}
    </Pressable>
  );

  const imageGrid = () => {
    const n = imageItems.length;
    if (n === 0) return null;
    // Single image keeps its natural aspect ratio (no crop).
    if (n === 1) {
      const e = imageItems[0];
      return <PostImage uri={e.it.url} onPress={() => openLightbox(e.idx)} initialWidth={e.it.width} initialHeight={e.it.height} />;
    }
    const frame = { borderRadius: radius.lg, overflow: 'hidden' as const, height: GRID_H };
    if (n === 2) {
      return (
        <View style={[frame, { flexDirection: 'row', gap: GAP }]}>
          <Tile entry={imageItems[0]} style={{ flex: 1, height: '100%' }} />
          <Tile entry={imageItems[1]} style={{ flex: 1, height: '100%' }} />
        </View>
      );
    }
    if (n === 3) {
      return (
        <View style={[frame, { flexDirection: 'row', gap: GAP }]}>
          <Tile entry={imageItems[0]} style={{ flex: 1, height: '100%' }} />
          <View style={{ flex: 1, gap: GAP }}>
            <Tile entry={imageItems[1]} style={{ flex: 1, width: '100%' }} />
            <Tile entry={imageItems[2]} style={{ flex: 1, width: '100%' }} />
          </View>
        </View>
      );
    }
    // 4+ → 2×2, with a "+N" overlay on the last tile when there are extras.
    return (
      <View style={[frame, { gap: GAP }]}>
        <View style={{ flex: 1, flexDirection: 'row', gap: GAP }}>
          <Tile entry={imageItems[0]} style={{ flex: 1, height: '100%' }} />
          <Tile entry={imageItems[1]} style={{ flex: 1, height: '100%' }} />
        </View>
        <View style={{ flex: 1, flexDirection: 'row', gap: GAP }}>
          <Tile entry={imageItems[2]} style={{ flex: 1, height: '100%' }} />
          <Tile entry={imageItems[3]} style={{ flex: 1, height: '100%' }} plus={n > 4 ? n - 4 : undefined} />
        </View>
      </View>
    );
  };

  return (
    <>
      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        {videoItems.map(({ it, idx }) => (
          <View key={`v${idx}`} style={{ position: 'relative' }}>
            <VideoMedia url={it.url} height={Platform.OS === 'web' ? 560 : 240} />
          </View>
        ))}
        {imageGrid()}
      </View>

      {/* Lightbox modal */}
      <Modal visible={lightboxVisible} transparent animationType="fade" onRequestClose={() => setLightboxVisible(false)}>
        <Pressable
          onPress={() => setLightboxVisible(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.95)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Pressable onPress={() => setLightboxVisible(false)} style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: spacing.md }}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>

          {displayItems[lightboxIndex] && (
            <Image
              source={{ uri: displayItems[lightboxIndex].url }}
              style={{
                width: SCREEN_WIDTH * 0.95,
                height: SCREEN_HEIGHT * 0.8,
              }}
              resizeMode="contain"
            />
          )}

          {displayItems.length > 1 && (
            <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xl }}>
              <Pressable onPress={() => setLightboxIndex(Math.max(0, lightboxIndex - 1))} style={{ padding: spacing.md }}>
                <Ionicons name="chevron-back" size={28} color={lightboxIndex > 0 ? '#fff' : 'rgba(255,255,255,0.3)'} />
              </Pressable>
              <Text variant="body" color="#fff">{lightboxIndex + 1} / {displayItems.length}</Text>
              <Pressable onPress={() => setLightboxIndex(Math.min(displayItems.length - 1, lightboxIndex + 1))} style={{ padding: spacing.md }}>
                <Ionicons name="chevron-forward" size={28} color={lightboxIndex < displayItems.length - 1 ? '#fff' : 'rgba(255,255,255,0.3)'} />
              </Pressable>
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
});
