import { Platform } from 'react-native';

const DRAFTS_KEY = 'minds:drafts';

interface Draft {
  id: string;
  content: string;
  communityId?: string;
  communityName?: string;
  savedAt: string;
}

function loadDrafts(): Draft[] {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return [];
  try {
    const saved = window.localStorage.getItem(DRAFTS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveDrafts(drafts: Draft[]) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try { window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); } catch {}
}

export function getDrafts(): Draft[] {
  return loadDrafts();
}

export function saveDraft(content: string, communityId?: string, communityName?: string): string {
  const drafts = loadDrafts();
  const id = Date.now().toString();
  drafts.unshift({ id, content, communityId, communityName, savedAt: new Date().toISOString() });
  // Keep max 10 drafts
  saveDrafts(drafts.slice(0, 10));
  return id;
}

export function deleteDraft(id: string): void {
  const drafts = loadDrafts().filter(d => d.id !== id);
  saveDrafts(drafts);
}

export function getLatestDraft(): Draft | null {
  const drafts = loadDrafts();
  return drafts[0] || null;
}
