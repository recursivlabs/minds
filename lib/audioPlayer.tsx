/**
 * Global audio player — the single source of truth for the queue + playback
 * state, shared across the in-feed inline players and the floating mini-player.
 *
 * Matches the app's provider pattern (Context + useState, like AuthProvider).
 * Playback + OS integration is delegated to a platform engine (lib/audio/engine
 * → web: HTMLAudio+MediaSession, native: track-player), so this file is
 * platform-agnostic. Mounted once at the root (app/_layout.tsx).
 */
import * as React from 'react';
import engine from './audio/engine';
import type { AudioTrack } from './audio/types';

interface AudioPlayerState {
  /** The track currently loaded, or null when nothing is playing. */
  current: AudioTrack | null;
  queue: AudioTrack[];
  index: number;
  isPlaying: boolean;
  loading: boolean;
  /** Seconds. */
  position: number;
  duration: number;
  rate: number;
}

interface AudioPlayerContextValue extends AudioPlayerState {
  /** Play a track. Pass `list` to seed a queue (e.g. a channel's audio feed). */
  play: (track: AudioTrack, list?: AudioTrack[]) => void;
  toggle: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  /** Relative skip — negative rewinds. */
  skipBy: (seconds: number) => void;
  next: () => void;
  prev: () => void;
  addToQueue: (track: AudioTrack) => void;
  /** Jump to a queue index (the fullscreen "up next" list). */
  jumpTo: (index: number) => void;
  setRate: (rate: number) => void;
  /** Stop + dismiss the player entirely. */
  close: () => void;
  /** True when `track.id` is the loaded track. */
  isCurrent: (id: string) => boolean;
}

const noop = () => {};
const AudioPlayerContext = React.createContext<AudioPlayerContextValue>({
  current: null,
  queue: [],
  index: 0,
  isPlaying: false,
  loading: false,
  position: 0,
  duration: 0,
  rate: 1,
  play: noop,
  toggle: noop,
  pause: noop,
  seekTo: noop,
  skipBy: noop,
  next: noop,
  prev: noop,
  addToQueue: noop,
  jumpTo: noop,
  setRate: noop,
  close: noop,
  isCurrent: () => false,
});

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AudioPlayerState>({
    current: null,
    queue: [],
    index: 0,
    isPlaying: false,
    loading: false,
    position: 0,
    duration: 0,
    rate: 1,
  });

  // Refs mirror queue/index so the OS remote handlers (registered once) always
  // read live values instead of a stale closure.
  const queueRef = React.useRef<AudioTrack[]>([]);
  const indexRef = React.useRef(0);
  queueRef.current = state.queue;
  indexRef.current = state.index;

  // Load + start the track at a given queue index.
  const playIndex = React.useCallback((list: AudioTrack[], i: number) => {
    const track = list[i];
    if (!track) return;
    setState((s) => ({ ...s, queue: list, index: i, current: track, position: 0, duration: track.duration ?? 0, loading: true }));
    engine.load(track).then(() => {
      engine.play();
      engine.setNowPlaying(track, 0, track.duration);
    });
  }, []);

  const next = React.useCallback(() => {
    const q = queueRef.current;
    const i = indexRef.current + 1;
    if (i < q.length) playIndex(q, i);
  }, [playIndex]);

  const prev = React.useCallback(() => {
    // Standard behavior: if >3s in, restart the track; otherwise go to previous.
    const el = indexRef.current;
    const q = queueRef.current;
    setState((s) => {
      if (s.position > 3 || el === 0) {
        engine.seekTo(0);
        return { ...s, position: 0 };
      }
      playIndex(q, el - 1);
      return s;
    });
  }, [playIndex]);

  // Wire engine → React state, and OS remote controls → queue actions. Once.
  React.useEffect(() => {
    engine.setHandlers({
      onState: (playing) => setState((s) => ({ ...s, isPlaying: playing })),
      onLoading: (loading) => setState((s) => ({ ...s, loading })),
      onProgress: (position, duration) =>
        setState((s) => (s.position === position && s.duration === duration ? s : { ...s, position, duration })),
      onEnded: () => next(), // continuous playback → auto-advance
    });
    engine.setRemoteHandlers({
      onPlay: () => engine.play(),
      onPause: () => engine.pause(),
      onNext: () => next(),
      onPrev: () => prev(),
      onSeek: (seconds) => {
        engine.seekTo(seconds);
        setState((s) => ({ ...s, position: seconds }));
      },
    });
  }, [next, prev]);

  const play = React.useCallback(
    (track: AudioTrack, list?: AudioTrack[]) => {
      const q = list?.length ? list : [track];
      const i = Math.max(0, q.findIndex((t) => t.id === track.id));
      // Same track already loaded → just resume.
      if (queueRef.current[indexRef.current]?.id === track.id && !list) {
        engine.play();
        return;
      }
      playIndex(q, i);
    },
    [playIndex],
  );

  const toggle = React.useCallback(() => {
    setState((s) => {
      if (s.isPlaying) engine.pause();
      else engine.play();
      return s;
    });
  }, []);

  const pause = React.useCallback(() => engine.pause(), []);

  const seekTo = React.useCallback((seconds: number) => {
    engine.seekTo(seconds);
    setState((s) => ({ ...s, position: seconds }));
  }, []);

  const skipBy = React.useCallback((seconds: number) => {
    setState((s) => {
      const target = Math.max(0, Math.min(s.duration || Number.POSITIVE_INFINITY, s.position + seconds));
      engine.seekTo(target);
      return { ...s, position: target };
    });
  }, []);

  const addToQueue = React.useCallback((track: AudioTrack) => {
    setState((s) => {
      if (s.queue.some((t) => t.id === track.id)) return s;
      // Nothing playing yet → start it; otherwise append.
      if (!s.current) {
        playIndex([track], 0);
        return s;
      }
      return { ...s, queue: [...s.queue, track] };
    });
  }, [playIndex]);

  // Jump to a track already in the queue (the fullscreen "up next" list).
  const jumpTo = React.useCallback((i: number) => {
    const q = queueRef.current;
    if (i >= 0 && i < q.length && i !== indexRef.current) playIndex(q, i);
  }, [playIndex]);

  const setRate = React.useCallback((rate: number) => {
    engine.setRate(rate);
    setState((s) => ({ ...s, rate }));
  }, []);

  const close = React.useCallback(() => {
    engine.stop();
    setState((s) => ({ ...s, current: null, queue: [], index: 0, isPlaying: false, position: 0, duration: 0 }));
  }, []);

  const isCurrent = React.useCallback((id: string) => state.current?.id === id, [state.current]);

  const value = React.useMemo<AudioPlayerContextValue>(
    () => ({ ...state, play, toggle, pause, seekTo, skipBy, next, prev, addToQueue, jumpTo, setRate, close, isCurrent }),
    [state, play, toggle, pause, seekTo, skipBy, next, prev, addToQueue, jumpTo, setRate, close, isCurrent],
  );

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
}

export function useAudioPlayer(): AudioPlayerContextValue {
  return React.useContext(AudioPlayerContext);
}
