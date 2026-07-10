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
import { Platform } from 'react-native';
import { BASE_URL } from './recursiv';
import { getItemSync } from './storage';

// Signals are PER-USER engagement events, so they must go out under the
// signed-in user's key — never a shared app key (which attributed everyone's
// views to the key owner). Auth registers the active SDK here on sign-in /
// session restore and clears it on sign-out.
let activeSdk: any = null;
export function setSignalsSdk(s: any): void { activeSdk = s; }

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
  | 'open_chat'
  | 'ask_agent';

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

// One POST per event does NOT keep load trivial for a feed app: every
// PostCard mount logs a view, so scrolling 100 posts used to be 100
// sequential POSTs per user — thousands of writes/sec of pure HTTP
// overhead at cutover scale. Send the whole drained batch in one request,
// falling back to per-event POSTs only if the batch route doesn't exist
// yet (probed once). Batch endpoint is filed under platform asks.
let batchSupported: boolean | null = null;
let flushInFlight = false;
// CIRCUIT BREAKER: if the signals endpoint is forbidden for this key (403) or
// unauthorized (401), telemetry can NEVER succeed — so stop entirely for the
// session instead of retrying every event forever. That old retry-loop fired
// one 403 per post view, flooding the console AND burning the key's rate budget
// so real requests (feed "load more") got throttled and hung.
let signalsDisabled = false;
function isForbidden(e: any): boolean {
  const s = e?.status ?? e?.statusCode ?? e?.response?.status;
  return s === 403 || s === 401;
}

async function flush() {
  // Serialize flushes: logSignal can call flush() directly when the queue
  // hits MAX_QUEUE while a previous flush is still awaiting — interleaved
  // drains used to send overlapping per-event loops.
  if (signalsDisabled) { queue.length = 0; return; }
  if (flushInFlight) { scheduleFlush(); return; }
  if (queue.length === 0) return;
  flushInFlight = true;
  const batch = queue.splice(0, queue.length);
  try {
    // The SDK doesn't expose the underlying HTTP client as a member
    // of Recursiv, but every resource holds the same client reference.
    // Borrow it from `posts` so we don't have to wait for an npm
    // publish that adds a SignalsResource.
    const sdk: any = activeSdk;
    const httpClient = sdk?.posts?.client || sdk?.notifications?.client;
    if (!httpClient?.post) { queue.unshift(...batch); return; } // not signed in yet — keep for after login
    if (batchSupported !== false) {
      try {
        await httpClient.post('/signals/batch', { events: batch });
        batchSupported = true;
        return;
      } catch (e) {
        if (isForbidden(e)) { signalsDisabled = true; return; } // forbidden -> never retry
        if (batchSupported === true) return; // transient failure — loss is OK
        batchSupported = false; // endpoint not deployed yet — fall back
      }
    }
    for (const ev of batch) {
      try { await httpClient.post('/signals/post', ev); }
      catch (e) { if (isForbidden(e)) { signalsDisabled = true; return; } }
    }
  } catch {
    // Discard on hard failure; another signal will come along.
  } finally {
    flushInFlight = false;
  }
}

export function logSignal(type: SignalType, input: SignalInput = {}) {
  if (signalsDisabled) return; // circuit-breaker tripped — telemetry is off for the session
  if (type === 'view' && input.postId) {
    if (viewedPosts.has(input.postId)) return;
    // Bound session memory: a long doomscroll otherwise grows this Set
    // forever. Resetting risks the odd double-counted view — acceptable.
    if (viewedPosts.size > 5000) viewedPosts.clear();
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

// Tail flush on web. A normal flush() can't complete during unload, so use
// a keepalive fetch — it outlives the page. (navigator.sendBeacon can't set
// the Authorization header, so keepalive is the right tool here.) Without
// this, the last ~1.5s of events — including the click that navigated away —
// were silently dropped on every page close. flushSignals() itself was
// exported but never wired to anything.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const tailFlush = () => {
    if (queue.length === 0) return;
    const apiKey = getItemSync('minds:api_key');
    if (!apiKey || typeof fetch !== 'function') return;
    const batch = queue.splice(0, queue.length);
    const send = (path: string, body: unknown) => {
      fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      }).catch(() => {});
    };
    if (batchSupported !== false) send('/signals/batch', { events: batch });
    else for (const ev of batch.slice(0, 10)) send('/signals/post', ev);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') tailFlush();
  });
  window.addEventListener('pagehide', tailFlush);
}
