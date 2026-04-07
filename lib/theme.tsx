import * as React from 'react';
import { Platform } from 'react-native';
import { colors as darkColors, lightColors } from '../constants/theme';

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<ThemeMode>('dark');

  React.useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === 'light') setMode('light');
    }
  }, []);

  const toggle = React.useCallback(() => {
    setMode(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.setItem(THEME_KEY, next);
      }
      return next;
    });
  }, []);

  const colors = mode === 'dark' ? darkColors : lightColors as typeof darkColors;

  return (
    <ThemeContext.Provider value={{ mode, colors, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return React.useContext(ThemeContext);
}
