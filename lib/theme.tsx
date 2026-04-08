import * as React from 'react';
import { Platform } from 'react-native';
import { colors as darkColors, lightColors, colors as mutableColors } from '../constants/theme';

type ThemeMode = 'dark' | 'light';
const THEME_KEY = 'minds:theme';

const ThemeContext = React.createContext<{
  mode: ThemeMode;
  colors: typeof darkColors;
  toggle: () => void;
}>({
  mode: 'dark',
  colors: darkColors,
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

  const toggle = React.useCallback(() => {
    setMode(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.setItem(THEME_KEY, next);
      }
      return next;
    });
  }, []);

  const colors = mode === 'dark' ? darkColors : lightColors as typeof darkColors;

  // key={mode} forces full remount of all children when theme changes
  // This ensures every component reads the updated global colors
  return (
    <ThemeContext.Provider value={{ mode, colors, toggle }} key={mode}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return React.useContext(ThemeContext);
}
