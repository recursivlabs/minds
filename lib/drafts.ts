import { getItemSync, getItem, setItem } from './storage';

const DRAFTS_KEY = 'minds:drafts';

interface Draft {
  id: string;
  content: string;
  communityId?: string;
  communityName?: string;
  savedAt: string;
}

let draftsCache: Draft[] = [];

// Sync hydrate on web
const cached = getItemSync(DRAFTS_KEY);
if (cached) try { draftsCache = JSON.parse(cached); } catch {}

// Async hydrate on native
getItem(DRAFTS_KEY).then(saved => {
  if (saved) try { draftsCache = JSON.parse(saved); } catch {}
});

function persistDrafts() {
  setItem(DRAFTS_KEY, JSON.stringify(draftsCache));
}

export function getDrafts(): Draft[] {
  return draftsCache;
}

// We keep a SINGLE in-progress draft. Every autosave overwrites it rather
// than appending — the old "keep 10" behaviour meant each debounced save
// minted a fresh id, so posting only cleared the last one and earlier copies
// of the same text lingered forever (the "ghost draft" that kept repopulating
// the composer). One slot, cleared on post, fixes that for good.
export function saveDraft(content: string, communityId?: string, communityName?: string): string {
  const id = Date.now().toString();
  draftsCache = [{ id, content, communityId, communityName, savedAt: new Date().toISOString() }];
  persistDrafts();
  return id;
}

export function deleteDraft(id: string): void {
  draftsCache = draftsCache.filter(d => d.id !== id);
  persistDrafts();
}

// Nuke the draft entirely — called on a successful post.
export function clearDraft(): void {
  draftsCache = [];
  persistDrafts();
}

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // only auto-restore "obviously recent" drafts

export function getLatestDraft(): Draft | null {
  const d = draftsCache[0];
  if (!d) return null;
  // Don't repopulate the composer with a stale draft (e.g. something already
  // posted days ago). Only restore work from roughly the current session.
  const age = Date.now() - new Date(d.savedAt).getTime();
  if (!Number.isFinite(age) || age > DRAFT_TTL_MS) return null;
  return d;
}
