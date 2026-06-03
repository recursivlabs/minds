// Web video player: <video> + hls.js (Safari plays HLS natively; Chrome/Firefox
// need hls.js). Autoplays muted in-feed; native controls for unmute/seek.
import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

export interface VideoPlayerProps {
  uri: string;
  poster?: string;
  autoplay?: boolean;
  height?: number;
}

export function VideoPlayer({ uri, poster, autoplay = true, height = 260 }: VideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    // Safari / iOS play HLS natively.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = uri;
      return;
    }
    // Everyone else: hls.js.
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(uri);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
    video.src = uri; // last-resort
  }, [uri]);

  return (
    <video
      ref={ref}
      poster={poster}
      muted={autoplay}
      autoPlay={autoplay}
      loop
      playsInline
      controls
      style={{
        width: '100%',
        height,
        borderRadius: 12,
        background: '#000',
        objectFit: 'cover',
      }}
    />
  );
}
