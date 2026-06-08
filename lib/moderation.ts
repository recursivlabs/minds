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
}

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  try {
    const res = await fetch(`${BASE_URL}/profiles/blocked`, {
      headers: { Authorization: `Bearer ${await apiKey()}` },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.data ?? []) as BlockedUser[];
  } catch {
    return [];
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
