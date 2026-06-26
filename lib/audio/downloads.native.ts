/**
 * Offline downloads (native) — saves a track's audio to the device so it plays
 * with no network, in the background. This is the feature the long-form / audio
 * ("confessionals") audience cares about. The native engine's load() prefers the
 * cached file via getLocalUri().
 *
 * State: an in-memory map (id → local uri) + in-progress set, persisted to
 * AsyncStorage so downloads survive restarts. A version counter drives the UI
 * via useSyncExternalStore.
 */
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AudioTrack } from './types';

export type DownloadStatus = 'none' | 'downloading' | 'downloaded';

export const downloadsSupported = true;

const DIR = `${FileSystem.documentDirectory ?? ''}audio-downloads/`;
const INDEX_KEY = 'minds.audio.downloads.v1';

const downloaded = new Map<string, string>(); // id → local uri
const inProgress = new Set<string>();
let version = 0;
const subs = new Set<() => void>();

function bump(): void {
  version += 1;
  for (const f of subs) f();
}

let hydrating: Promise<void> | null = null;
function hydrate(): Promise<void> {
  if (!hydrating) {
    hydrating = (async () => {
      try {
        const raw = await AsyncStorage.getItem(INDEX_KEY);
        if (raw) {
          const obj = JSON.parse(raw) as Record<string, string>;
          for (const [k, v] of Object.entries(obj)) downloaded.set(k, v);
        }
      } catch {
        /* corrupt index — start empty */
      }
      bump();
    })();
  }
  return hydrating;
}
// Warm the index on module load.
void hydrate();

async function persist(): Promise<void> {
  const obj: Record<string, string> = {};
  for (const [k, v] of downloaded) obj[k] = v;
  try {
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(obj));
  } catch {
    /* best-effort */
  }
}

async function ensureDir(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  } catch {
    /* ignore */
  }
}

function pathFor(id: string): string {
  return `${DIR}${encodeURIComponent(id)}.audio`;
}

export async function getLocalUri(id: string): Promise<string | null> {
  await hydrate();
  return downloaded.get(id) ?? null;
}

export function downloadStatus(id: string): DownloadStatus {
  if (downloaded.has(id)) return 'downloaded';
  if (inProgress.has(id)) return 'downloading';
  return 'none';
}

export async function downloadTrack(track: AudioTrack): Promise<void> {
  await hydrate();
  if (downloaded.has(track.id) || inProgress.has(track.id)) return;
  inProgress.add(track.id);
  bump();
  try {
    await ensureDir();
    const res = await FileSystem.downloadAsync(track.url, pathFor(track.id));
    if (res && res.status >= 200 && res.status < 300) {
      downloaded.set(track.id, res.uri);
      await persist();
    }
  } catch {
    /* network/disk error — leave un-downloaded */
  } finally {
    inProgress.delete(track.id);
    bump();
  }
}

export async function removeDownload(id: string): Promise<void> {
  const uri = downloaded.get(id);
  if (uri) {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      /* file already gone */
    }
  }
  downloaded.delete(id);
  await persist();
  bump();
}

export function subscribeDownloads(cb: () => void): () => void {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

export function downloadsVersion(): number {
  return version;
}
