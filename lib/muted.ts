import { Platform } from 'react-native';

const STORAGE_KEY = 'minds:muted';

let mutedUsers: Set<string> = new Set();

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) mutedUsers = new Set(JSON.parse(saved));
  } catch {}
}

function persist() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...mutedUsers]));
    } catch {}
  }
}

export function isMuted(userId: string): boolean {
  return mutedUsers.has(userId);
}

export function toggleMute(userId: string): boolean {
  if (mutedUsers.has(userId)) {
    mutedUsers.delete(userId);
    persist();
    return false;
  } else {
    mutedUsers.add(userId);
    persist();
    return true;
  }
}

export function getMutedUsers(): string[] {
  return [...mutedUsers];
}

export function filterMuted(posts: any[]): any[] {
  if (mutedUsers.size === 0) return posts;
  return posts.filter(p => {
    const authorId = p.author?.id || p.userId || p.user_id;
    return !mutedUsers.has(authorId);
  });
}
