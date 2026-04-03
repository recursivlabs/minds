/**
 * Minds 2.0 Design Tokens
 * Dark, futuristic theme with gold accent.
 */

export const colors = {
  // Backgrounds — deep, near-black
  bg: '#08080a',
  surface: '#111113',
  surfaceRaised: '#1a1a1e',
  surfaceHover: '#222226',

  // Borders
  border: '#2a2a2e',
  borderSubtle: '#1a1a1e',
  borderFocus: '#d4a844',

  // Text
  text: '#f5f5f5',
  textSecondary: '#a0a0a8',
  textMuted: '#606068',
  textInverse: '#08080a',

  // Accent — Minds gold
  accent: '#d4a844',
  accentHover: '#e6bc54',
  accentMuted: 'rgba(212, 168, 68, 0.12)',
  accentSubtle: 'rgba(212, 168, 68, 0.06)',

  // Semantic
  success: '#34d399',
  successMuted: 'rgba(52, 211, 153, 0.10)',
  error: '#f87171',
  errorMuted: 'rgba(248, 113, 113, 0.10)',
  warning: '#fbbf24',
  warningMuted: 'rgba(251, 191, 36, 0.10)',
  info: '#60a5fa',
  infoMuted: 'rgba(96, 165, 250, 0.10)',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.7)',
  scrim: 'rgba(0, 0, 0, 0.5)',

  // Special — boost and token share the gold family
  boost: '#e6bc54',
  boostMuted: 'rgba(230, 188, 84, 0.12)',
  token: '#f0d060',
  tokenMuted: 'rgba(240, 208, 96, 0.10)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  hero: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700' as const,
    letterSpacing: -0.8,
  },
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  bodyMedium: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500' as const,
    letterSpacing: 0,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
  },
  mono: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;
