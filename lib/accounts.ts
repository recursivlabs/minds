// Multi-account support. Legacy Minds users often have MANY accounts under one
// real email (one user has 125). After OTP login the app lists every account on
// the email and lets the user switch between them, X-style.
//
// The switch itself lives in lib/auth.tsx (it has to swap the active identity via
// persistSession). This module owns the read-only sibling listing plus the
// CLIENT-SIDE archive state (v1: hidden ids stored locally, no server writes).

import { BASE_URL } from './recursiv';
import * as storage from './storage';

const KEYS = {
  apiKey: 'minds:api_key',
  archived: 'minds:archived_accounts',
};

export interface SiblingAccount {
  id: string;
  username: string;
  name: string;
  image: string | null;
  created_at: string;
  // The email is a placeholder (e.g. legacy migration filler), not a real inbox.
  is_placeholder_email: boolean;
  // Server heuristic: the account looks like a throwaway / test / demo account.
  // These sort last and are collapsed under a divider in the picker.
  looks_like_test: boolean;
  // True for the account whose key we're currently authenticated as.
  is_current: boolean;
}

/**
 * Fetch every account that shares the current user's real email. The server
 * returns them already sorted real-accounts-first with test-looking accounts
 * flagged (`looks_like_test`).
 */
export async function getSiblingAccounts(): Promise<SiblingAccount[]> {
  const apiKey = await storage.getItem(KEYS.apiKey);
  if (!apiKey) return [];

  const res = await fetch(`${BASE_URL}/accounts/siblings`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    let message = `Failed to load accounts (${res.status})`;
    try {
      const body = await res.json();
      message = body?.error?.message || message;
    } catch {}
    throw new Error(message);
  }

  const body = await res.json();
  return (body?.data ?? []) as SiblingAccount[];
}

// --- Client-side archive (v1) ---------------------------------------------
// Archiving is purely local for now: we keep a JSON array of user ids the user
// has chosen to hide from their switcher. Nothing is written to the server.

export async function getArchivedIds(): Promise<string[]> {
  const raw = await storage.getItem(KEYS.archived);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function archiveAccount(id: string): Promise<void> {
  const ids = await getArchivedIds();
  if (ids.includes(id)) return;
  await storage.setItem(KEYS.archived, JSON.stringify([...ids, id]));
}

export async function unarchiveAccount(id: string): Promise<void> {
  const ids = await getArchivedIds();
  await storage.setItem(KEYS.archived, JSON.stringify(ids.filter(x => x !== id)));
}
