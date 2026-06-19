// Web video player: <video> + hls.js for HLS streams; native <video src> for
// progressive files (the local blob/mp4 shown in the composer preview). Sizes
// to the video's real aspect ratio (letterboxed on black, capped by maxHeight).
//
// Encoding lifecycle: a freshly-uploaded Bunny video isn't playable until it
// finishes encoding. Instead of showing a black/broken box, we detect the load
// failure, check the video status, and if it's still "processing" we show a
// "Processing" overlay and poll until it's ready, then load and play. Status is
// only checked when a load actually fails, so already-ready videos cost nothing.
import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { getVideoStatus, extractVideoGuid } from '../lib/video';

export interface VideoPlayerProps {
  uri: string;
  poster?: string;
  autoplay?: boolean;
  /** Max rendered height in px. Default 480. */
  height?: number;
}

const isHlsUri = (uri: string) => /\.m3u8(\?|$)/i.test(uri) || uri.includes('/playlist');
type State = 'loading' | 'ready' | 'processing' | 'failed';

export function VideoPlayer({ uri, poster, autoplay = true, height = 480 }: VideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ratio, setRatio] = useState(16 / 9);
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    setState('loading');
    const guid = extractVideoGuid(uri);
    let hls: Hls | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const pollUntilReady = () => {
      setState('processing');
      let attempt = 0;
      const startedAt = Date.now();
      const tick = async () => {
        if (cancelled || !guid) return;
        const st = await getVideoStatus(guid).catch(() => null);
        if (cancelled) return;
        if (st?.status === 'ready') { load(); }
        else if (st?.status === 'failed') { setState('failed'); }
        else if (Date.now() - startedAt < 10 * 60_000) {
          // still processing — back off (4s → 60s cap) with a hard stop so a
          // lost encode webhook can't keep every viewer polling forever
          attempt += 1;
          pollTimer = setTimeout(tick, Math.min(4000 * 2 ** Math.min(attempt - 1, 4), 60_000));
        } else { setState('failed'); }
      };
      pollTimer = setTimeout(tick, 3000);
    };

    const onFatalError = (type: string) => {
      // A network/manifest failure on a fresh upload usually means it's still
      // encoding. Check status; otherwise it's genuinely unavailable.
      if (hls) { hls.destroy(); hls = null; }
      if (!guid) { setState('failed'); return; }
      getVideoStatus(guid)
        .then((st) => {
          if (cancelled) return;
          if (st?.status === 'processing') pollUntilReady();
          else setState('failed');
        })
        .catch(() => { if (!cancelled) setState('failed'); });
    };

    function load() {
      if (cancelled || !video) return;
      setState('loading');
      // Progressive file (local blob / mp4) or Safari native HLS → just set src.
      if (!isHlsUri(uri) || video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = uri;
        setState('ready');
        return;
      }
      if (Hls.isSupported()) {
        // capLevelToPlayerSize keeps ABR active but bounded by the rendered
        // element — feed videos render ≤560px tall, so streaming 1080p+ to
        // them is wasted bandwidth and Bunny egress.
        hls = new Hls({ enableWorker: true, abrEwmaDefaultEstimate: 6_000_000, startLevel: -1, capLevelToPlayerSize: true });
        hls.loadSource(uri);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setState('ready');
          // Crisp open. hls.js cold-starts at the LOWEST rendition (and
          // capLevelToPlayerSize can floor it to level 0 before the <video> has
          // measured its size), so the first ~3-4s play blurry before ABR climbs.
          // Seed the OPENING segment at a feed-appropriate rendition (~720p),
          // then immediately hand back to auto so we do NOT pin quality for the
          // life of the instance (which would disable ABR + burn egress — the
          // reason the previous code avoided touching levels at all).
          const levels = (hls?.levels || []) as Array<{ height?: number }>;
          if (hls && levels.length > 1) {
            let target = levels.length - 1; // default: top rendition
            const within720 = levels
              .map((l, i) => ({ i, h: l.height || 0 }))
              .filter((x) => x.h > 0 && x.h <= 720);
            if (within720.length) target = within720[within720.length - 1].i;
            hls.nextLevel = target; // first segment loads sharp
            const resume = () => {
              if (hls) hls.nextLevel = -1; // back to adaptive after the opener
              hls?.off(Hls.Events.FRAG_BUFFERED, resume);
            };
            hls.on(Hls.Events.FRAG_BUFFERED, resume);
          }
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { hls?.recoverMediaError(); return; }
          onFatalError(data.type);
        });
        return;
      }
      video.src = uri; // last resort
      setState('ready');
    }

    load();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (hls) hls.destroy();
    };
  }, [uri]);

  const onLoadedMetadata = () => {
    const v = ref.current;
    if (v?.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
  };

  return (
    <div
      style={{
        width: '100%', aspectRatio: String(ratio), maxHeight: height, margin: '0 auto',
        background: '#000', borderRadius: 12, overflow: 'hidden', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
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
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', visibility: state === 'ready' ? 'visible' : 'hidden' }}
      />
      {(state === 'processing' || state === 'loading' || state === 'failed') && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#cfcfd6' }}>
          {state === 'failed' ? (
            <span style={{ fontSize: 14, fontFamily: 'Roboto-Regular' }}>Video unavailable</span>
          ) : (
            <>
              <style>{"@keyframes mindsVidSpin { to { transform: rotate(360deg); } }"}</style>
              <span style={{ width: 26, height: 26, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', animation: 'mindsVidSpin 0.8s linear infinite' }} />
              {state === 'processing' && <span style={{ fontSize: 13, fontFamily: 'Roboto-Regular' }}>Processing video…</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
