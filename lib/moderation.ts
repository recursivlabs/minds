// User blocking. Hits the Recursiv profile block endpoints; the server hides
// blocked users from feeds (both directions) and severs follows.
import * as storage from './storage';
import { BASE_URL } from './recursiv';

async function apiKey(): Promise<string> {
  return (await storage.getItem('minds:api_key')) || '';
}

export async function blockUser(userId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/profiles/${userId}/block`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await apiKey()}` },
  });
  if (!res.ok) throw new Error('Could not block user');
}

export async function unblockUser(userId: string): Promise<void> {
  await fetch(`${BASE_URL}/profiles/${userId}/block`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${await apiKey()}` },
  });
}

export interface BlockedUser {
  id: string;
  name: string;
  username: string;
  image: string | null;
  bio?: string | null;
  blocked_at?: string | null;
}

export interface BlockedPage {
  data: BlockedUser[];
  hasMore: boolean;
}

/**
 * Page through the accounts the caller has blocked. `search` filters by
 * name/username server-side; `limit`/`offset` drive infinite scroll. Returns
 * an empty page (never throws) so the list UI degrades gracefully.
 */
export async function getBlockedUsers(
  opts: { search?: string; limit?: number; offset?: number } = {},
): Promise<BlockedPage> {
  const { search = '', limit = 30, offset = 0 } = opts;
  try {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search.trim()) qs.set('search', search.trim());
    const res = await fetch(`${BASE_URL}/profiles/blocked?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${await apiKey()}` },
    });
    if (!res.ok) return { data: [], hasMore: false };
    const json = await res.json();
    const data = (json?.data ?? []) as BlockedUser[];
    const hasMore = json?.meta?.has_more ?? data.length === limit;
    return { data, hasMore };
  } catch {
    return { data: [], hasMore: false };
  }
}

// ── Mute (one-directional: hides their posts + notifications from you only) ──

export async function muteUser(userId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/profiles/${userId}/mute`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await apiKey()}` },
  });
  if (!res.ok) throw new Error('Could not mute user');
}

export async function unmuteUser(userId: string): Promise<void> {
  await fetch(`${BASE_URL}/profiles/${userId}/mute`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${await apiKey()}` },
  });
}

export interface MutedUser {
  id: string;
  name: string;
  username: string;
  image: string | null;
  bio?: string | null;
  muted_at?: string | null;
}

export interface MutedPage {
  data: MutedUser[];
  hasMore: boolean;
}

/**
 * Page through the accounts the caller has muted. Mirrors getBlockedUsers:
 * `search` filters name/username server-side; `limit`/`offset` drive infinite
 * scroll. Returns an empty page (never throws) so the list UI degrades cleanly.
 */
export async function getMutedUsers(
  opts: { search?: string; limit?: number; offset?: number } = {},
): Promise<MutedPage> {
  const { search = '', limit = 30, offset = 0 } = opts;
  try {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search.trim()) qs.set('search', search.trim());
    const res = await fetch(`${BASE_URL}/profiles/muted?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${await apiKey()}` },
    });
    if (!res.ok) return { data: [], hasMore: false };
    const json = await res.json();
    const data = (json?.data ?? []) as MutedUser[];
    const hasMore = json?.meta?.has_more ?? data.length === limit;
    return { data, hasMore };
  } catch {
    return { data: [], hasMore: false };
  }
}

/** Follow relationship in both directions (mutual = both true). */
export async function getFollowRelationship(
  userId: string,
): Promise<{ is_following: boolean; follows_you: boolean }> {
  try {
    const res = await fetch(`${BASE_URL}/profiles/${userId}/is-following`, {
      headers: { Authorization: `Bearer ${await apiKey()}` },
    });
    if (!res.ok) return { is_following: false, follows_you: false };
    const json = await res.json();
    return {
      is_following: !!json?.data?.is_following,
      follows_you: !!json?.data?.follows_you,
    };
  } catch {
    return { is_following: false, follows_you: false };
  }
}
