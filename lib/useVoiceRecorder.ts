import * as React from 'react';
import { Platform } from 'react-native';

/**
 * WhatsApp/Signal-style voice notes for web (MediaRecorder). Records mic audio,
 * resolves a blob + base mime on stop. The server maps audio/webm -> .weba and
 * audio/mp4 -> .m4a, both of which the app classifies as audio (not video), so a
 * recorded note renders through the existing InlineAudioPlayer with no extra
 * wiring. Native (no MediaRecorder / expo-av) reports unsupported and the mic
 * button is simply hidden there.
 */
export interface VoiceRecording {
  blob: Blob;
  /** base content type (no codecs), e.g. "audio/webm" or "audio/mp4" */
  mime: string;
  durationMs: number;
}

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

function pickMime(): string {
  const MR: any = (globalThis as any).MediaRecorder;
  if (!MR?.isTypeSupported) return '';
  for (const m of MIME_CANDIDATES) {
    try { if (MR.isTypeSupported(m)) return m; } catch {}
  }
  return '';
}

export function useVoiceRecorder() {
  const supported =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'MediaRecorder' in window &&
    !!navigator?.mediaDevices?.getUserMedia;

  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);

  const recRef = React.useRef<any>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const startRef = React.useRef<number>(0);
  const timerRef = React.useRef<any>(null);

  const cleanup = React.useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch {} });
      streamRef.current = null;
    }
    recRef.current = null;
    setRecording(false);
    setElapsed(0);
  }, []);

  React.useEffect(() => () => cleanup(), [cleanup]);

  const start = React.useCallback(async (): Promise<boolean> => {
    if (!supported || recRef.current) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new (window as any).MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e: any) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      recRef.current = rec;
      startRef.current = Date.now();
      rec.start();
      setRecording(true);
      timerRef.current = setInterval(() => setElapsed(Date.now() - startRef.current), 200);
      return true;
    } catch {
      cleanup();
      return false;
    }
  }, [supported, cleanup]);

  // Stop and resolve the recording. Returns null if nothing was captured.
  const stop = React.useCallback((): Promise<VoiceRecording | null> => {
    return new Promise((resolve) => {
      const rec = recRef.current;
      if (!rec) { resolve(null); return; }
      const durationMs = Date.now() - startRef.current;
      const type = (rec.mimeType || 'audio/webm').split(';')[0];
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        chunksRef.current = [];
        cleanup();
        if (!blob.size) { resolve(null); return; }
        resolve({ blob, mime: type, durationMs });
      };
      try { rec.stop(); } catch { cleanup(); resolve(null); }
    });
  }, [cleanup]);

  // Discard the in-progress recording without producing a note.
  const cancel = React.useCallback(() => {
    const rec = recRef.current;
    if (rec) { rec.onstop = () => {}; try { rec.stop(); } catch {} }
    chunksRef.current = [];
    cleanup();
  }, [cleanup]);

  return { supported, recording, elapsed, start, stop, cancel };
}
