import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit tests run in jsdom (so localStorage / window exist for the storage
// layer) with react-native + AsyncStorage stubbed, so we can exercise the pure
// app logic (markdown, drafts, cache, preferences) without a native runtime.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['lib/**/*.test.ts', 'test/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      'react-native': path.resolve(__dirname, 'test/stubs/react-native.ts'),
      '@react-native-async-storage/async-storage': path.resolve(__dirname, 'test/stubs/async-storage.ts'),
    },
  },
});
