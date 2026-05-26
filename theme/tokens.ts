const colors = {
  light: {
    bg: '#f5f7fa',
    surface: '#ffffff',
    'surface-2': '#e8edf4',
    ink: '#0a1628',
    'ink-soft': '#1e3a5f',
    'ink-mute': '#596b80',
    hairline: '#dbe4f0',
    accent: '#0066ff',
    'accent-deep': '#0047b3',
    sage: '#06b6d4',
    amber: '#00d9ff',
  },
  dark: {
    bg: '#050814',
    surface: '#0d1424',
    'surface-2': '#131c33',
    ink: '#f1f5fb',
    'ink-soft': '#cbd5e1',
    'ink-mute': '#94a3b8',
    hairline: '#1e293b',
    accent: '#3b82f6',
    'accent-deep': '#1d4ed8',
    sage: '#22d3ee',
    amber: '#67e8f9',
  },
} as const;

const radii = {
  button: 12,
  card: 14,
  sheet: 24,
  pill: 9999,
} as const;

const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  12: 48,
  16: 64,
} as const;

const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
  '4xl': 40,
} as const;

const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
} as const;

const lineHeight = {
  tight: 1.2,
  snug: 1.35,
  normal: 1.5,
  relaxed: 1.65,
} as const;

const fontFamily = {
  display: 'Archivo_400Regular',
  displayMedium: 'Archivo_500Medium',
  displayBold: 'Archivo_700Bold',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

const tabBar = {
  height: 60,
} as const;

const touchTarget = {
  min: 44,
} as const;

export const tokens = {
  colors,
  radii,
  spacing,
  fontSize,
  fontWeight,
  lineHeight,
  fontFamily,
  tabBar,
  touchTarget,
} as const;

export type ColorKey = keyof typeof colors.light;
export type LightColors = typeof colors.light;
export type DarkColors = typeof colors.dark;
export type ThemeColors = { [K in ColorKey]: string };
export type Theme = typeof tokens;
