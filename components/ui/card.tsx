import React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { useMotion } from '@/lib/hooks/use-motion';
import * as haptics from '@/lib/haptics';

export type CardVariant = 'default' | 'raised' | 'flat';

export type CardProps = {
  variant?: CardVariant;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
  children: React.ReactNode;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Card({
  variant = 'default',
  onPress,
  accessibilityLabel,
  style,
  children,
}: CardProps) {
  const { colors, radii, spacing } = useTheme();
  const { reduced: isReducedMotion } = useMotion();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const raisedShadow: ViewStyle =
    variant === 'raised'
      ? Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
          },
          android: { elevation: 4 },
          default: {},
        }) ?? {}
      : {};

  const containerStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing[5],
    borderWidth: variant === 'flat' ? StyleSheet.hairlineWidth : 0,
    borderColor: variant === 'flat' ? colors.hairline : undefined,
    ...raisedShadow,
  };

  if (!onPress) {
    return (
      <View style={[containerStyle, style]}>
        {children}
      </View>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        haptics.light();
        if (!isReducedMotion) scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
      }}
      onPressOut={() => {
        if (!isReducedMotion) scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={[containerStyle, animStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}
