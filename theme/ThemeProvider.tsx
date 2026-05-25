import React, { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useThemeStore } from '@/lib/stores/theme-store';
import { tokens, type ThemeColors } from '@/theme/tokens';

type ColorMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ColorMode;
  colors: ThemeColors;
  radii: typeof tokens.radii;
  spacing: typeof tokens.spacing;
  fontSize: typeof tokens.fontSize;
  fontWeight: typeof tokens.fontWeight;
  lineHeight: typeof tokens.lineHeight;
  fontFamily: typeof tokens.fontFamily;
  tabBar: typeof tokens.tabBar;
  touchTarget: typeof tokens.touchTarget;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const preference = useThemeStore((s) => s.preference);
  const mode: ColorMode =
    preference === 'system'
      ? systemScheme === 'dark' ? 'dark' : 'light'
      : preference;

  const value: ThemeContextValue = {
    mode,
    colors: tokens.colors[mode] as ThemeColors,
    radii: tokens.radii,
    spacing: tokens.spacing,
    fontSize: tokens.fontSize,
    fontWeight: tokens.fontWeight,
    lineHeight: tokens.lineHeight,
    fontFamily: tokens.fontFamily,
    tabBar: tokens.tabBar,
    touchTarget: tokens.touchTarget,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
