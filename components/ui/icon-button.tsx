import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { useMotion } from '@/lib/hooks/use-motion';
import * as haptics from '@/lib/haptics';
import type { LucideIcon } from 'lucide-react-native';

export type IconButtonVariant = 'ghost' | 'filled' | 'outlined';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export type IconButtonProps = {
  icon: LucideIcon;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  color?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SIZE: Record<IconButtonSize, number> = { sm: 36, md: 44, lg: 52 };
const ICON: Record<IconButtonSize, number> = { sm: 16, md: 20, lg: 24 };

export default function IconButton({
  icon: Icon,
  variant = 'ghost',
  size = 'md',
  onPress,
  disabled = false,
  accessibilityLabel,
  color,
}: IconButtonProps) {
  const { colors, radii } = useTheme();
  const { reduced } = useMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const dim = SIZE[size];
  const iconSize = ICON[size];

  type VariantStyle = { bg: string; border?: string; iconColor: string };
  const variantMap: Record<IconButtonVariant, VariantStyle> = {
    ghost: { bg: 'transparent', iconColor: color ?? colors.ink },
    filled: { bg: colors['surface-2'], iconColor: color ?? colors.ink },
    outlined: {
      bg: 'transparent',
      border: colors.hairline,
      iconColor: color ?? colors.ink,
    },
  };

  const v = variantMap[variant];

  const pressableStyle: ViewStyle = {
    width: dim,
    height: dim,
    borderRadius: radii.button,
    backgroundColor: v.bg,
    borderWidth: v.border ? StyleSheet.hairlineWidth * 2 : 0,
    borderColor: v.border,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.4 : 1,
  };

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : onPress}
      onPressIn={() => {
        if (disabled) return;
        void haptics.selection();
        opacity.value = withTiming(0.85, { duration: 80 });
        // Slightly more aggressive scale for smaller targets
        if (!reduced) scale.value = withSpring(0.92, { damping: 15, stiffness: 300 });
      }}
      onPressOut={() => {
        opacity.value = withTiming(1, { duration: 150 });
        if (!reduced) scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[pressableStyle, animStyle]}
    >
      <Icon size={iconSize} color={v.iconColor} />
    </AnimatedPressable>
  );
}
