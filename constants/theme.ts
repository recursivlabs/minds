/**
 * Minds 2.0 Design Tokens
 * Dark theme with Minds blue accent.
 */

export const colors = {
  // Backgrounds
  bg: '#09090b',
  surface: '#18181b',
  surfaceRaised: '#1e1e22',
  surfaceHover: '#27272a',

  // Borders
  border: '#27272a',
  borderSubtle: '#1e1e22',
  borderFocus: '#a1a1aa',

  // Text
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  textInverse: '#09090b',

  // Accent — Minds blue
  accent: '#1b85d6',
  accentHover: '#1a9fff',

  // Semantic
  success: '#34d399',
  successMuted: 'rgba(52, 211, 153, 0.12)',
  error: '#f87171',
  errorMuted: 'rgba(248, 113, 113, 0.12)',
  warning: '#fbbf24',
  warningMuted: 'rgba(251, 191, 36, 0.12)',
  info: '#60a5fa',
  infoMuted: 'rgba(96, 165, 250, 0.12)',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.6)',
  scrim: 'rgba(0, 0, 0, 0.4)',

  // Special
  boost: '#f5a623',
  boostMuted: 'rgba(245, 166, 35, 0.12)',
  token: '#ffd700',
  tokenMuted: 'rgba(255, 215, 0, 0.12)',
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
