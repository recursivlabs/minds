/**
 * Minds 2.0 Design Tokens
 * Dark, futuristic theme with gold accent.
 */

export const colors = {
  // Backgrounds — Linear-style dark
  bg: '#0f0f0f',
  surface: '#181818',
  surfaceRaised: '#1e1e1e',
  surfaceHover: 'rgba(255,255,255,0.06)',

  // Glass effect
  glass: 'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.08)',

  // Borders — subtle separators only
  border: 'rgba(255,255,255,0.12)',
  borderSubtle: 'rgba(255,255,255,0.08)',
  borderFocus: '#d4a844',

  // Text — 4 levels like Linear
  text: 'rgba(240,240,240, 0.95)',
  textSecondary: 'rgba(240,240,240, 0.72)',
  textMuted: 'rgba(240,240,240, 0.42)',
  textInverse: '#0f0f0f',

  // Accent — Minds gold (keep)
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

export const lightColors = {
  bg: '#f6f6f6',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  surfaceHover: 'rgba(24,24,24, 0.06)',
  glass: 'rgba(24,24,24, 0.04)',
  glassBorder: 'rgba(24,24,24, 0.12)',
  border: 'rgba(24,24,24, 0.17)',
  borderSubtle: 'rgba(24,24,24, 0.10)',
  borderFocus: '#d4a844',
  text: 'rgba(25,25,25, 0.95)',
  textSecondary: 'rgba(25,25,25, 0.72)',
  textMuted: 'rgba(25,25,25, 0.42)',
  textInverse: '#f6f6f6',
  accent: '#d4a844',
  accentHover: '#e6bc54',
  accentMuted: 'rgba(212, 168, 68, 0.12)',
  accentSubtle: 'rgba(212, 168, 68, 0.06)',
  success: '#34d399',
  successMuted: 'rgba(52, 211, 153, 0.10)',
  error: '#f87171',
  errorMuted: 'rgba(248, 113, 113, 0.10)',
  warning: '#fbbf24',
  warningMuted: 'rgba(251, 191, 36, 0.10)',
  info: '#60a5fa',
  infoMuted: 'rgba(96, 165, 250, 0.10)',
  overlay: 'rgba(0, 0, 0, 0.3)',
  scrim: 'rgba(0, 0, 0, 0.2)',
  boost: '#e6bc54',
  boostMuted: 'rgba(230, 188, 84, 0.12)',
  token: '#d4a844',
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
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const typography = {
  hero: {
    fontSize: 36,
    lineHeight: 44,
    fontFamily: 'Geist-Regular',
    letterSpacing: -0.8,
  },
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: 'Geist-SemiBold',
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: 'Geist-SemiBold',
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: 'Geist-SemiBold',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Geist-Regular',
    letterSpacing: 0,
  },
  bodyMedium: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Geist-SemiBold',
    letterSpacing: 0,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Geist-Regular',
    letterSpacing: 0,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Geist-SemiBold',
    letterSpacing: 0,
  },
  mono: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Geist-Regular',
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
