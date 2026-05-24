const colors = {
  light: {
    bg: '#f8f5f0',
    surface: '#ffffff',
    'surface-2': '#ede8de',
    ink: '#1c1917',
    'ink-soft': '#44403c',
    'ink-mute': '#78716c',
    hairline: '#e7e1d5',
    accent: '#c2410c',
    'accent-deep': '#9a3412',
    sage: '#65735a',
    amber: '#d97706',
  },
  dark: {
    bg: '#0c0a09',
    surface: '#1c1917',
    'surface-2': '#292524',
    ink: '#fafaf9',
    'ink-soft': '#d6d3d1',
    'ink-mute': '#a8a29e',
    hairline: '#292524',
    accent: '#ea580c',
    'accent-deep': '#c2410c',
    sage: '#84a07a',
    amber: '#f59e0b',
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
