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
import type HlsType from 'hls.js'; // type-only — erased at build, not bundled
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
    let hls: HlsType | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const holdTimers: ReturnType<typeof setTimeout>[] = [];
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
      // Lazy-load hls.js (~350KB gz) only when we actually need to play an HLS
      // stream — it's the single biggest dependency and most sessions never hit
      // a video, so keeping it out of the startup bundle is the big FCP win.
      void import('hls.js').then(({ default: Hls }) => {
        if (cancelled || !video) return;
        if (!Hls.isSupported()) { video.src = uri; setState('ready'); return; }
        // capLevelToPlayerSize is intentionally OFF. It bounds ABR to the
        // rendered element size, but before the <video> has measured itself it
        // floors to the LOWEST rendition — and even after our first-segment seed,
        // ABR resumes and re-floors, so the opening 3-4s play blurry. A high
        // default bandwidth estimate makes hls.js pick a sharp level immediately;
        // we accept a little extra egress for a crisp open (re-add size capping
        // later via maxAutoLevel if Bunny egress becomes a problem).
        hls = new Hls({ enableWorker: true, abrEwmaDefaultEstimate: 12_000_000, startLevel: -1 });
        hls.loadSource(uri);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setState('ready');
          // Hold the opening at a sharp rendition (lowest level ≥720p, else the
          // top) for the first few segments so it never starts blurry, THEN hand
          // back to adaptive — setting startLevel + a short hold, not a permanent
          // pin, so ABR still adapts to real bandwidth afterward.
          const levels = (hls?.levels || []) as Array<{ height?: number }>;
          if (hls && levels.length > 1) {
            let target = levels.length - 1; // default: top rendition
            const hd = levels.map((l, i) => ({ i, h: l.height || 0 })).filter((x) => x.h >= 720);
            if (hd.length) target = hd[0].i; // lowest rendition that is still ≥720p
            hls.startLevel = target;
            hls.nextLevel = target;
            // Keep the sharp level for ~4s (covers the window the user complained
            // about), then resume auto ABR.
            const t = setTimeout(() => { if (hls) hls.nextLevel = -1; }, 4000);
            holdTimers.push(t);
          }
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { hls?.recoverMediaError(); return; }
          onFatalError(data.type);
        });
      }).catch(() => { if (!cancelled && video) { video.src = uri; setState('ready'); } });
    }

    load();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      holdTimers.forEach(clearTimeout);
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
        // Transparent surround + left-justified video: any contain() letterbox
        // shows the card background instead of black bars, and the frame hugs
        // the leading edge rather than centering.
        width: '100%', aspectRatio: String(ratio), maxHeight: height, marginLeft: 0, marginRight: 'auto',
        background: 'transparent', borderRadius: 12, overflow: 'hidden', position: 'relative',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start',
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
        style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'left center', display: 'block', visibility: state === 'ready' ? 'visible' : 'hidden' }}
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
