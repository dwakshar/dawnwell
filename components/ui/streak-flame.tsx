import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Flame } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useMotion } from '@/lib/hooks/use-motion';
import { Mono } from '@/components/ui/typography';

export type StreakFlameSize = 'sm' | 'md' | 'lg';

export type StreakFlameProps = {
  count: number;
  size?: StreakFlameSize;
};

const FONT_SIZE: Record<StreakFlameSize, number> = { sm: 14, md: 18, lg: 24 };
const ICON_SIZE: Record<StreakFlameSize, number> = { sm: 14, md: 18, lg: 24 };

// Spring for increment punch — slightly underdamped for a satisfying pop
const INCREMENT_SPRING = { damping: 14, stiffness: 260, mass: 0.7 };

export default function StreakFlame({ count, size = 'md' }: StreakFlameProps) {
  const { colors } = useTheme();
  const { reduced } = useMotion();
  const scale = useSharedValue(1);
  const prevCount = useRef(count);

  const iconSize = ICON_SIZE[size];
  const fontSize = FONT_SIZE[size];

  type FlameStyle = { color: string; filled: boolean; glow: boolean; pulse: boolean };
  const flameStyle: FlameStyle =
    count === 0
      ? { color: colors['ink-mute'], filled: false, glow: false, pulse: false }
      : count < 7
        ? { color: colors.amber, filled: true, glow: false, pulse: false }
        : count < 30
          ? { color: colors.amber, filled: true, glow: false, pulse: true }
          : { color: colors.accent, filled: true, glow: true, pulse: false };

  useEffect(() => {
    const didIncrement = count > prevCount.current;
    prevCount.current = count;

    if (reduced) return;

    if (didIncrement) {
      // Streak increment: scale punch 0.8 → 1.15 → 1 with spring
      scale.value = withSequence(
        withSpring(0.8, { damping: 20, stiffness: 400 }),
        withSpring(1.15, INCREMENT_SPRING),
        withSpring(1, INCREMENT_SPRING),
      );
    } else if (flameStyle.pulse) {
      // Idle pulse: 1800ms beat, then 6s pause. NOT continuous.
      // Total cycle = 1800ms animation + 6000ms pause = 7800ms
      scale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          // 6s pause: withDelay on a zero-duration no-op holds the loop
          withDelay(6000, withTiming(1, { duration: 0 })),
        ),
        -1,
        false,
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [count, reduced, flameStyle.pulse, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Animated.View style={animStyle}>
        <Flame
          size={iconSize}
          color={flameStyle.color}
          fill={flameStyle.filled ? flameStyle.color : 'none'}
          strokeWidth={flameStyle.filled ? 0 : 1.5}
        />
      </Animated.View>
      <Mono style={{ fontSize, color: flameStyle.color }}>{String(count)}</Mono>
    </View>
  );
}
