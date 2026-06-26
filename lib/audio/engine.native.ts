/**
 * Native audio engine — react-native-track-player. Delivers the things the web
 * surface can't: background playback, lockscreen / control-center transport, and
 * (via downloads) offline playback. Same AudioEngine contract as engine.web.ts,
 * so the provider + UI are platform-agnostic.
 *
 * Queue lives in the PROVIDER (parity with web): we load ONE track at a time and
 * the provider advances it. Lockscreen prev/next still work — the playback
 * service (playbackService.ts) routes those remote events back to the remote
 * handlers the provider registered here. Setup + service registration happen at
 * app entry (registerPlayback.native.ts).
 *
 * Downloaded tracks play from a local file (offline): load() rewrites the url to
 * the cached path when present.
 */
import TrackPlayer, { Event, State } from 'react-native-track-player';
import { getLocalUri } from './downloads';
import type { AudioEngine, AudioEngineHandlers, AudioRemoteHandlers, AudioTrack } from './types';

class NativeAudioEngine implements AudioEngine {
  private handlers: AudioEngineHandlers = {};
  /** Public so playbackService.ts can route lockscreen events to the queue. */
  public remote: AudioRemoteHandlers = {};
  private subscribed = false;

  /** Subscribe once to playback events → provider handlers. */
  private subscribe(): void {
    if (this.subscribed) return;
    this.subscribed = true;
    TrackPlayer.addEventListener(Event.PlaybackState, (e) => {
      this.handlers.onState?.(e.state === State.Playing);
      const loading = e.state === State.Buffering || e.state === State.Loading;
      this.handlers.onLoading?.(loading);
    });
    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (e) => {
      this.handlers.onProgress?.(e.position, e.duration);
    });
    TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
      this.handlers.onEnded?.();
    });
  }

  async load(track: AudioTrack): Promise<void> {
    this.subscribe();
    // Offline-first: play the cached file when this track is downloaded.
    const local = await getLocalUri(track.id);
    await TrackPlayer.reset();
    await TrackPlayer.add({
      id: track.id,
      url: local ?? track.url,
      title: track.title || 'Audio',
      artist: track.artist || 'Minds',
      artwork: track.artwork,
      duration: track.duration,
    });
  }

  async play(): Promise<void> {
    this.subscribe();
    await TrackPlayer.play();
  }

  async pause(): Promise<void> {
    await TrackPlayer.pause();
  }

  async seekTo(seconds: number): Promise<void> {
    await TrackPlayer.seekTo(Math.max(0, seconds));
  }

  async setRate(rate: number): Promise<void> {
    await TrackPlayer.setRate(rate);
  }

  async stop(): Promise<void> {
    await TrackPlayer.reset();
  }

  setHandlers(handlers: AudioEngineHandlers): void {
    this.handlers = handlers;
    this.subscribe();
  }

  setRemoteHandlers(handlers: AudioRemoteHandlers): void {
    this.remote = handlers;
  }

  setNowPlaying(): void {
    // track-player renders the lockscreen / control-center from the loaded
    // track's title/artist/artwork — nothing to push here.
  }
}

const engine = new NativeAudioEngine();
/** Named export so the playback service can reach the remote handlers. */
export const nativeAudioEngine = engine;
export default engine;
