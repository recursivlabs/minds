import * as React from 'react';
import { Platform } from 'react-native';
import { colors as darkColors, lightColors, colors as mutableColors } from '../constants/theme';

type ThemeMode = 'dark' | 'light';
const THEME_KEY = 'minds:theme';

const ThemeContext = React.createContext<{
  mode: ThemeMode;
  colors: typeof darkColors;
  version: number;
  toggle: () => void;
}>({
  mode: 'dark',
  colors: darkColors,
  version: 0,
  toggle: () => {},
});

/**
 * Mutate the globally exported `colors` object so every file
 * that does `import { colors } from '../constants/theme'`
 * picks up the new theme without needing useTheme().
 */
function applyTheme(mode: ThemeMode) {
  const source = mode === 'dark' ? darkColors : lightColors;
  for (const key of Object.keys(source) as (keyof typeof darkColors)[]) {
    (mutableColors as any)[key] = (source as any)[key];
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<ThemeMode>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === 'light') { applyTheme('light'); return 'light'; }
    }
    return 'dark';
  });

  const [version, setVersion] = React.useState(0);

  const toggle = React.useCallback(() => {
    setMode(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.setItem(THEME_KEY, next);
        document.body.style.backgroundColor = next === 'dark' ? '#0f0f0f' : '#f8f8f8';
      }
      return next;
    });
    // Bump version to force all useTheme() consumers to re-render
    setVersion(v => v + 1);
  }, []);

  const colors = mode === 'dark' ? darkColors : lightColors as typeof darkColors;

  const value = React.useMemo(() => ({ mode, colors, version, toggle }), [mode, colors, version, toggle]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return React.useContext(ThemeContext);
}
