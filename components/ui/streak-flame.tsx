import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { Flame } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Mono } from '@/components/ui/typography';

export type StreakFlameSize = 'sm' | 'md' | 'lg';

export type StreakFlameProps = {
  count: number;
  size?: StreakFlameSize;
};

const FONT_SIZE: Record<StreakFlameSize, number> = { sm: 14, md: 18, lg: 24 };
const ICON_SIZE: Record<StreakFlameSize, number> = { sm: 14, md: 18, lg: 24 };

export default function StreakFlame({ count, size = 'md' }: StreakFlameProps) {
  const { colors } = useTheme();
  const isReducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

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
    if (flameStyle.pulse && !isReducedMotion) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [count, isReducedMotion, flameStyle.pulse, scale]);

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
