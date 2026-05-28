/**
 * Client-side signal capture. Buffers engagement events and flushes
 * to POST /signals/post in small batches so the UI never waits on
 * the server. The server route writes into signal_event in the
 * Minds project DB (best-effort; loss is OK).
 *
 * Event types match projectDbSchema.ts:
 *   view | click | dwell | react_up | react_down | save | hide |
 *   share | mute_source | open_chat
 *
 * Usage:
 *   logSignal('view', { postId });
 *   logSignal('dwell', { postId, dwellMs: 4200 });
 *   logSignal('click', { postId, metadata: { source: 'discover_hero' } });
 *
 * View dedup: each post view is logged at most once per session so
 * a re-render of the same card in a different surface doesn't double-
 * count.
 */
import { getSdk } from './recursiv';

type SignalType =
  | 'view'
  | 'click'
  | 'dwell'
  | 'react_up'
  | 'react_down'
  | 'save'
  | 'hide'
  | 'share'
  | 'mute_source'
  | 'open_chat';

interface SignalInput {
  postId?: string;
  dwellMs?: number;
  metadata?: Record<string, unknown>;
}

interface PendingEvent {
  event_type: SignalType;
  post_id?: string;
  dwell_ms?: number;
  metadata?: Record<string, unknown>;
}

const viewedPosts = new Set<string>();
const queue: PendingEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_MS = 1500;
const MAX_QUEUE = 25;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_MS);
}

async function flush() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  try {
    // The SDK doesn't expose the underlying HTTP client as a member
    // of Recursiv, but every resource holds the same client reference.
    // Borrow it from `posts` so we don't have to wait for an npm
    // publish that adds a SignalsResource. One POST per event keeps
    // the server route trivial — signal volume is low.
    const sdk: any = getSdk();
    const httpClient = sdk?.posts?.client || sdk?.notifications?.client;
    if (!httpClient?.post) return;
    for (const ev of batch) {
      try { await httpClient.post('/signals/post', ev); } catch {}
    }
  } catch {
    // Discard on hard failure; another signal will come along.
  }
}

export function logSignal(type: SignalType, input: SignalInput = {}) {
  if (type === 'view' && input.postId) {
    if (viewedPosts.has(input.postId)) return;
    viewedPosts.add(input.postId);
  }
  queue.push({
    event_type: type,
    post_id: input.postId,
    dwell_ms: input.dwellMs,
    metadata: input.metadata,
  });
  if (queue.length >= MAX_QUEUE) {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    void flush();
  } else {
    scheduleFlush();
  }
}

/** Best-effort flush on app background / page unload. */
export function flushSignals() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  void flush();
}
