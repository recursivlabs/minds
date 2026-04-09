import * as React from 'react';
import { View, Image, Pressable, Modal, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { colors, spacing, radius } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.avi'];
const isVideoUrl = (url: string): boolean =>
  VIDEO_EXTENSIONS.some(ext => url.toLowerCase().includes(ext)) ||
  url.includes('cloudflarestream') ||
  url.includes('/video/');

interface MediaItem {
  url: string;
  type?: string;
  id?: string;
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

  return (
    <>
      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        {displayItems.map((item, i) => {
          if (item.type === 'video') {
            return (
              <View key={i} style={{ position: 'relative' }}>
                {Platform.OS === 'web' ? (
                  <video
                    src={item.url}
                    controls
                    preload="metadata"
                    style={{
                      width: '100%',
                      maxHeight: 400,
                      borderRadius: radius.md,
                      backgroundColor: '#000',
                      objectFit: 'contain' as any,
                    }}
                  />
                ) : (
                  <View style={{
                    width: '100%', height: 200, borderRadius: radius.md,
                    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="play-circle-outline" size={48} color={colors.accent} />
                    <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>Video</Text>
                  </View>
                )}
              </View>
            );
          }

          // Image
          return (
            <Pressable key={i} onPress={() => openLightbox(i)}>
              <Image
                source={{ uri: item.url }}
                style={{
                  width: '100%',
                  height: 250,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceHover,
                }}
                resizeMode="cover"
              />
              {displayItems.length > 1 && (
                <View style={{
                  position: 'absolute', top: spacing.sm, right: spacing.sm,
                  backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.sm,
                  paddingHorizontal: spacing.sm, paddingVertical: 2,
                }}>
                  <Text variant="caption" color="#fff" style={{ fontSize: 11 }}>{i + 1}/{displayItems.length}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
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
