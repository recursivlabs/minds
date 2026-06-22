// Native video player (expo-video). Web override lives in VideoPlayer.web.tsx;
// Metro resolves the right one per platform. Plays Bunny HLS, autoplays muted
// in-feed, tap to unmute.
import React, { useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { SITE_URL } from '../lib/recursiv';

export interface VideoPlayerProps {
  uri: string;
  poster?: string;
  autoplay?: boolean;
  height?: number;
}

export function VideoPlayer({ uri, autoplay = true, height = 260 }: VideoPlayerProps) {
  const [muted, setMuted] = useState(autoplay);

  // Bunny gates direct file access on Referer; native has no browser referer,
  // so attach it explicitly or HLS 403s on device.
  const player = useVideoPlayer({ uri, headers: { Referer: SITE_URL } }, (p) => {
    p.loop = true;
    p.muted = autoplay;
    if (autoplay) p.play();
  });

  const toggleMute = () => {
    const next = !muted;
    player.muted = next;
    setMuted(next);
    if (!player.playing) player.play();
  };

  return (
    <Pressable onPress={toggleMute} style={[styles.wrap, { height }]}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
      />
      <View style={styles.badge}>
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={16} color="#fff" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Transparent surround + left-aligned video so any contain() letterbox shows
  // the card background (no visible black bars) and the frame hugs the leading edge.
  wrap: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: 'transparent', alignItems: 'flex-start', justifyContent: 'flex-start' },
  video: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    padding: 6,
  },
});
