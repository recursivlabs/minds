// Web video player: <video> + hls.js for HLS streams; native <video src> for
// progressive files (the local blob/mp4 shown in the composer preview — hls.js
// can't parse a raw mp4). Sizes itself to the video's real aspect ratio so it
// never squashes or crops: landscape fills the width, portrait is centered and
// letterboxed on black (the X/Twitter behavior), capped by maxHeight.
import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export interface VideoPlayerProps {
  uri: string;
  poster?: string;
  autoplay?: boolean;
  /** Max rendered height in px. Default 480. */
  height?: number;
}

const isHlsUri = (uri: string) => /\.m3u8(\?|$)/i.test(uri) || uri.includes('/playlist');

export function VideoPlayer({ uri, poster, autoplay = true, height = 480 }: VideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ratio, setRatio] = useState(16 / 9);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    // Progressive file (local blob / mp4) or Safari's native HLS → just set src.
    if (!isHlsUri(uri) || video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = uri;
      return;
    }
    // HLS on Chrome/Firefox → hls.js.
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        // hls.js otherwise starts at the lowest rendition and only climbs after
        // measuring bandwidth — so short clips play 240/360p upscaled and look
        // soft. Assume good bandwidth up front so it opens at the top rendition
        // (e.g. 720p), then let ABR drop down only if it actually stalls.
        abrEwmaDefaultEstimate: 6_000_000,
        startLevel: -1,
      });
      hls.loadSource(uri);
      hls.attachMedia(video);
      // Bias the very first segment to the highest rendition for instant sharpness.
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (hls.levels.length) {
          const top = hls.levels.reduce((b, l, i) => (l.height > hls.levels[b].height ? i : b), 0);
          hls.nextLevel = top;
        }
      });
      return () => hls.destroy();
    }
    video.src = uri; // last resort
  }, [uri]);

  const onLoadedMetadata = () => {
    const v = ref.current;
    if (v?.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
  };

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: String(ratio),
        maxHeight: height,
        margin: '0 auto',
        background: '#000',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <video
        ref={ref}
        poster={poster}
        muted={autoplay}
        autoPlay={autoplay}
        loop
        playsInline
        controls
        onLoadedMetadata={onLoadedMetadata}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
    </div>
  );
}
