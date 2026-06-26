/**
 * Floating mini-player. Mounted once at the root; appears whenever a track is
 * loaded and rides above the tab bar on every screen. Mirrors the global
 * AudioPlayerProvider state (which is the same state the OS lockscreen controls
 * drive), so it stays in sync with background playback. Tap → fullscreen player.
 */
import * as React from 'react';
import { View, Pressable, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../Text';
import { Scrubber } from './Scrubber';
import { FullscreenAudioPlayer } from './FullscreenAudioPlayer';
import { useColors } from '../../lib/theme';
import { spacing, radius, shadows } from '../../constants/theme';
import { useAudioPlayer } from '../../lib/audioPlayer';

export function AudioMiniPlayer() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const player = useAudioPlayer();
  const [expanded, setExpanded] = React.useState(false);

  if (!player.current) return null;
  const track = player.current;
  const open = () => setExpanded(true);

  // Sit above the bottom tab bar on native; desktop web hides the bottom bar
  // (side nav) so it rests near the bottom edge.
  const bottomOffset = Platform.OS === 'web' ? spacing.md : insets.bottom + 52;
  const hasNext = player.index < player.queue.length - 1;

  return (
    <>
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: bottomOffset, alignItems: 'center', paddingHorizontal: spacing.md }}
    >
      <View
        style={[
          {
            width: '100%',
            maxWidth: 600,
            borderRadius: radius.lg,
            backgroundColor: colors.surfaceRaised,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xs,
          },
          shadows.lg(colors.shadow),
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {/* Artwork → tap to expand the fullscreen player. */}
          <Pressable onPress={open} style={webCursor}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.sm,
                overflow: 'hidden',
                backgroundColor: colors.accentMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {track.artwork ? (
                <Image source={{ uri: track.artwork }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Ionicons name="musical-notes" size={20} color={colors.accent} />
              )}
            </View>
          </Pressable>

          {/* Title / artist → tap to expand the fullscreen player. */}
          <Pressable onPress={open} style={[{ flex: 1, minWidth: 0 }, webCursor]}>
            <Text variant="bodyMedium" numberOfLines={1}>
              {track.title || 'Audio'}
            </Text>
            {track.artist ? (
              <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                {track.artist}
              </Text>
            ) : null}
          </Pressable>

          {/* Transport. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Pressable onPress={() => player.skipBy(-15)} hitSlop={6} style={webCursor}>
              <Ionicons name="play-back" size={20} color={colors.textSecondary} />
            </Pressable>
            <Pressable onPress={player.toggle} hitSlop={6} style={webCursor}>
              <Ionicons name={player.isPlaying ? 'pause' : 'play'} size={26} color={colors.text} />
            </Pressable>
            {hasNext ? (
              <Pressable onPress={player.next} hitSlop={6} style={webCursor}>
                <Ionicons name="play-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            ) : (
              <Pressable onPress={() => player.skipBy(15)} hitSlop={6} style={webCursor}>
                <Ionicons name="play-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            )}
            <Pressable onPress={player.close} hitSlop={6} style={webCursor}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <Scrubber position={player.position} duration={player.duration} onSeek={player.seekTo} height={3} knob={false} />
      </View>
    </View>
    <FullscreenAudioPlayer visible={expanded} onClose={() => setExpanded(false)} />
    </>
  );
}

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined;
