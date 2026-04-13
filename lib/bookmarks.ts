import { getItemSync, getItem, setItem } from './storage';

const STORAGE_KEY = 'minds:bookmarks';

let bookmarks: Set<string> = new Set();

// Sync hydrate on web
const cached = getItemSync(STORAGE_KEY);
if (cached) try { bookmarks = new Set(JSON.parse(cached)); } catch {}

// Async hydrate on native
getItem(STORAGE_KEY).then(saved => {
  if (saved) try { bookmarks = new Set(JSON.parse(saved)); } catch {}
});

function persist() {
  setItem(STORAGE_KEY, JSON.stringify([...bookmarks]));
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
