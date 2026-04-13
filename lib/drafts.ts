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

export function saveDraft(content: string, communityId?: string, communityName?: string): string {
  const id = Date.now().toString();
  draftsCache.unshift({ id, content, communityId, communityName, savedAt: new Date().toISOString() });
  // Keep max 10 drafts
  draftsCache = draftsCache.slice(0, 10);
  persistDrafts();
  return id;
}

export function deleteDraft(id: string): void {
  draftsCache = draftsCache.filter(d => d.id !== id);
  persistDrafts();
}

export function getLatestDraft(): Draft | null {
  return draftsCache[0] || null;
}
