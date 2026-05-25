import React from 'react';
import { View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
} from 'react-native-reanimated';
import { useMotion } from '@/lib/hooks/use-motion';

export type RevealDirection = 'up' | 'down' | 'fade';

export type RevealProps = {
  delay?: number;
  direction?: RevealDirection;
  distance?: number;
  children: React.ReactNode;
};

export default function Reveal({
  delay = 0,
  direction = 'up',
  // distance is accepted for API forward-compatibility but Reanimated's
  // built-in layout animations use their own default slide distance
  distance: _distance = 12,
  children,
}: RevealProps) {
  const { reduced: isReducedMotion } = useMotion();

  const entering =
    direction === 'up'
      ? FadeInUp.duration(400).delay(delay)
      : direction === 'down'
        ? FadeInDown.duration(400).delay(delay)
        : FadeIn.duration(400).delay(delay);

  if (isReducedMotion) {
    return <View>{children}</View>;
  }

  return <Animated.View entering={entering}>{children}</Animated.View>;
}
