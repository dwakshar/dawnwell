import React, { useEffect } from 'react';
import { View, type ViewStyle, type DimensionValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { useMotion } from '@/lib/hooks/use-motion';
import { useTheme } from '@/theme/ThemeProvider';

export type SkeletonProps = {
  width: DimensionValue;
  height: DimensionValue;
  radius?: number;
  style?: ViewStyle;
};

export default function Skeleton({ width, height, radius, style }: SkeletonProps) {
  const { colors, radii } = useTheme();
  const { reduced: isReducedMotion } = useMotion();
  const shimmer = useSharedValue(0);

  const surface2 = colors['surface-2'];
  const hairline = colors.hairline;

  useEffect(() => {
    if (isReducedMotion) return;
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [isReducedMotion, shimmer]);

  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: isReducedMotion
      ? surface2
      : interpolateColor(shimmer.value, [0, 1], [surface2, hairline]),
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius ?? radii.button,
        },
        animStyle,
        style,
      ]}
    />
  );
}
