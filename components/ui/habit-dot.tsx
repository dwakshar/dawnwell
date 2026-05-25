import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { useMotion } from '@/lib/hooks/use-motion';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import * as haptics from '@/lib/haptics';

export type HabitDotState = 'empty' | 'partial' | 'complete';
export type HabitDotSize = 'sm' | 'md' | 'lg';

export type HabitDotProps = {
  state: HabitDotState;
  size?: HabitDotSize;
  color?: string;
  onPress?: () => void;
  accessibilityLabel: string;
};

const DIM: Record<HabitDotSize, number> = { sm: 16, md: 24, lg: 32 };
const ICON: Record<HabitDotSize, number> = { sm: 8, md: 12, lg: 16 };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function HabitDot({
  state,
  size = 'md',
  color,
  onPress,
  accessibilityLabel,
}: HabitDotProps) {
  const { colors } = useTheme();
  const { reduced: isReducedMotion } = useMotion();
  const scale = useSharedValue(1);
  const fillProgress = useSharedValue(state === 'complete' ? 1 : 0);
  const checkOpacity = useSharedValue(state === 'complete' ? 1 : 0);

  const accentColor = color ?? colors.accent;
  const dim = DIM[size];
  const iconSize = ICON[size];

  useEffect(() => {
    fillProgress.value = withTiming(state === 'complete' ? 1 : 0, { duration: 200 });
    checkOpacity.value = withTiming(state === 'complete' ? 1 : 0, { duration: 200 });
  }, [state, fillProgress, checkOpacity]);

  const borderColor =
    state === 'empty' ? colors.hairline : accentColor;

  const fillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      fillProgress.value,
      [0, 1],
      ['rgba(0,0,0,0)', accentColor],
    ),
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
  }));

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (state === 'complete') haptics.medium();
    else haptics.light();

    if (!isReducedMotion) {
      scale.value = withSequence(
        withSpring(0.85, { damping: 12, stiffness: 400 }),
        withSpring(1.1, { damping: 12, stiffness: 400 }),
        withSpring(1, { damping: 15, stiffness: 300 }),
      );
    }
    onPress?.();
  };

  const inner = (
    <Animated.View
      style={[
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          borderWidth: 1.5,
          borderColor,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        scaleStyle,
      ]}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: dim,
            height: dim,
            borderRadius: dim / 2,
          },
          fillStyle,
        ]}
      />
      <Animated.View style={[{ position: 'absolute' }, checkStyle]}>
        <Check size={iconSize} color="#ffffff" strokeWidth={2.5} />
      </Animated.View>
    </Animated.View>
  );

  if (!onPress) {
    return (
      <View
        style={{ width: Math.max(dim, 44), height: Math.max(dim, 44), alignItems: 'center', justifyContent: 'center' }}
        accessibilityLabel={accessibilityLabel}
      >
        {inner}
      </View>
    );
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={{
        width: Math.max(dim, 44),
        height: Math.max(dim, 44),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {inner}
    </AnimatedPressable>
  );
}
