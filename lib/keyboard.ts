import { Platform } from 'react-native';

type ShortcutHandler = () => void;

const handlers = new Map<string, ShortcutHandler>();

/**
 * Register a keyboard shortcut. Web only.
 * Key format: 'n', 'j', 'k', 'Escape', 'mod+k' (Cmd/Ctrl+K)
 */
export function registerShortcut(key: string, handler: ShortcutHandler): () => void {
  handlers.set(key, handler);
  return () => { handlers.delete(key); };
}

/**
 * Initialize keyboard listener. Call once on app start.
 */
export function initKeyboardShortcuts() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in input fields
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

    const mod = e.metaKey || e.ctrlKey;
    let key = e.key.toLowerCase();
    if (mod) key = `mod+${key}`;

    const handler = handlers.get(key);
    if (handler) {
      e.preventDefault();
      handler();
    }
  });
}
