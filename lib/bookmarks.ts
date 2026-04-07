import { Platform } from 'react-native';

const STORAGE_KEY = 'minds:bookmarks';

let bookmarks: Set<string> = new Set();

// Hydrate on load
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) bookmarks = new Set(JSON.parse(saved));
  } catch {}
}

function persist() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...bookmarks]));
    } catch {}
  }
}

export function isBookmarked(postId: string): boolean {
  return bookmarks.has(postId);
}

export function toggleBookmark(postId: string): boolean {
  if (bookmarks.has(postId)) {
    bookmarks.delete(postId);
    persist();
    return false;
  } else {
    bookmarks.add(postId);
    persist();
    return true;
  }
}

export function getBookmarks(): string[] {
  return [...bookmarks];
}
