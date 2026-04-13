import { getItemSync, getItem, setItem } from './storage';

const STORAGE_KEY = 'minds:muted';

let mutedUsers: Set<string> = new Set();

// Sync hydrate on web
const cached = getItemSync(STORAGE_KEY);
if (cached) try { mutedUsers = new Set(JSON.parse(cached)); } catch {}

// Async hydrate on native
getItem(STORAGE_KEY).then(saved => {
  if (saved) try { mutedUsers = new Set(JSON.parse(saved)); } catch {}
});

function persist() {
  setItem(STORAGE_KEY, JSON.stringify([...mutedUsers]));
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
