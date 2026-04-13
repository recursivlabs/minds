import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Synchronous read — returns cached value on web, null on native (use getItem for native). */
export function getItemSync(key: string): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  return null;
}

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  return AsyncStorage.getItem(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try { window.localStorage.setItem(key, value); } catch {}
    return;
  }
  await AsyncStorage.setItem(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try { window.localStorage.removeItem(key); } catch {}
    return;
  }
  await AsyncStorage.removeItem(key);
}
