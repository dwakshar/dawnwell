import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
  interpolateColor,
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

const INCREMENT_SPRING = { damping: 14, stiffness: 260, mass: 0.7 };

// AnimatedFlame for useAnimatedProps (hue shift)
const AnimatedFlame = Animated.createAnimatedComponent(Flame);

export default function StreakFlame({ count, size = 'md' }: StreakFlameProps) {
  const { colors, mode } = useTheme();
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

  // Hue-shift targets for the pulse: flame color shifts slightly lighter during the beat
  // Light: #00d9ff (amber) → #5ee9fb | Dark: #67e8f9 → #a5f3fc
  const amberBase = mode === 'dark' ? '#67e8f9' : '#00d9ff';
  const amberLight = mode === 'dark' ? '#a5f3fc' : '#5ee9fb';

  useEffect(() => {
    const didIncrement = count > prevCount.current;
    prevCount.current = count;

    if (reduced) return;

    if (didIncrement) {
      scale.value = withSequence(
        withSpring(0.8, { damping: 20, stiffness: 400 }),
        withSpring(1.15, INCREMENT_SPRING),
        withSpring(1, INCREMENT_SPRING),
      );
    } else if (flameStyle.pulse) {
      // 1800ms beat + 6s pause cycle. Scale drives hue via animatedProps.
      scale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withDelay(6000, withTiming(1, { duration: 0 })),
        ),
        -1,
        false,
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [count, reduced, flameStyle.pulse, scale]);

  const animScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Animated props — drives hue shift from scale value during pulse
  // When not pulsing, interpolateColor returns flameStyle.color at scale=1
  const animFlameProps = useAnimatedProps(() => {
    if (!flameStyle.pulse || reduced) {
      return { color: flameStyle.color, fill: flameStyle.filled ? flameStyle.color : 'none' };
    }
    const shifted = interpolateColor(scale.value, [1, 1.04], [amberBase, amberLight]);
    return { color: shifted, fill: shifted };
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Animated.View style={animScaleStyle}>
        <AnimatedFlame
          size={iconSize}
          strokeWidth={flameStyle.filled ? 0 : 1.5}
          animatedProps={animFlameProps}
        />
      </Animated.View>
      <Mono style={{ fontSize, color: flameStyle.color }}>{String(count)}</Mono>
    </View>
  );
}
