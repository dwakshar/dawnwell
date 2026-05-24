import type { ThemeColors } from '@/theme/tokens';

export type CellState =
  | 'no-data'   // habit didn't exist yet / no habits existed
  | 'future'    // day is in the future
  | 'zero'      // target existed, 0 completed
  | 'low'       // 1–33%
  | 'mid'       // 34–66%
  | 'high'      // 67–99%
  | 'complete'; // 100%

export type CellInfo = {
  state: CellState;
  bgColor: string;
  textColor: string;
  borderColor: string | undefined;
  ratio: number;
};

/**
 * Appends a 2-digit hex alpha to a 6-char hex color string.
 * e.g. hexWithOpacity('#c2410c', 0.25) → '#c2410c40'
 * All accent and habit colors in the token set are 6-char hex, so this is safe.
 */
function hexWithOpacity(hex: string, opacity: number): string {
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return hex + alpha;
}

/**
 * Pure function: derive the visual state and colors for one heatmap cell.
 *
 * `completed` and `target` come from getMonthCheckIns().
 * When target === 0 the habit did not exist on that day (or no habits existed
 * for the "all" aggregation) — renders as no-data.
 *
 * accentColor overrides colors.accent; pass habit.color for single-habit mode.
 */
export function getCellInfo(
  date: string,
  today: string,
  completed: number,
  target: number,
  colors: ThemeColors,
  accentColor?: string,
): CellInfo {
  const accent = accentColor ?? colors.accent;

  if (date > today) {
    return {
      state: 'future',
      bgColor: colors['surface-2'],
      textColor: 'transparent',
      borderColor: undefined,
      ratio: 0,
    };
  }

  if (target === 0) {
    return {
      state: 'no-data',
      bgColor: colors['surface-2'],
      textColor: colors['ink-mute'],
      borderColor: undefined,
      ratio: 0,
    };
  }

  const ratio = completed / target;

  if (ratio === 0) {
    return {
      state: 'zero',
      bgColor: colors.surface,
      textColor: colors['ink-mute'],
      borderColor: colors.hairline,
      ratio: 0,
    };
  }
  if (ratio < 0.34) {
    return {
      state: 'low',
      bgColor: hexWithOpacity(accent, 0.25),
      textColor: colors['ink-soft'],
      borderColor: undefined,
      ratio,
    };
  }
  if (ratio < 0.67) {
    return {
      state: 'mid',
      bgColor: hexWithOpacity(accent, 0.55),
      textColor: colors.ink,
      borderColor: undefined,
      ratio,
    };
  }
  if (ratio < 1) {
    return {
      state: 'high',
      bgColor: hexWithOpacity(accent, 0.8),
      textColor: colors.ink,
      borderColor: undefined,
      ratio,
    };
  }

  return {
    state: 'complete',
    bgColor: accent,
    textColor: '#ffffff',
    borderColor: undefined,
    ratio: 1,
  };
}
