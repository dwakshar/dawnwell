import { useReducedMotion } from 'react-native-reanimated';

type SpringConfig = { damping?: number; stiffness?: number; mass?: number; duration?: number };

export type MotionUtils = {
  reduced: boolean;
  /** Returns 0 if reduce-motion is on, otherwise the duration. */
  timing: (duration: number) => number;
  /** Returns instant config if reduce-motion is on, otherwise the provided spring config. */
  spring: (config: SpringConfig) => SpringConfig;
  /** Returns 0 if reduce-motion is on, otherwise min(index * base, 240). */
  stagger: (index: number, base?: number) => number;
};

/** Centralises reduce-motion logic. Use everywhere instead of useReducedMotion directly. */
export function useMotion(): MotionUtils {
  const reduced = useReducedMotion() ?? false;

  return {
    reduced,
    timing: (duration) => (reduced ? 0 : duration),
    spring: (config) => (reduced ? { duration: 0 } : config),
    stagger: (index, base = 40) => (reduced ? 0 : Math.min(index * base, 240)),
  };
}
