import React, { forwardRef } from 'react';
import {
  View,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { useMotion } from '@/lib/hooks/use-motion';
import { Label } from '@/components/ui/typography';
import * as haptics from '@/lib/haptics';
import type { LucideIcon } from 'lucide-react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  fullWidth?: boolean;
  accessibilityLabel: string;
  children?: React.ReactNode;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 52 };
const FONT_SIZE: Record<ButtonSize, number> = { sm: 13, md: 14, lg: 16 };
const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };
const H_PAD: Record<ButtonSize, number> = { sm: 14, md: 18, lg: 22 };

const Button = forwardRef<View, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    onPress,
    disabled = false,
    loading = false,
    icon: Icon,
    iconRight: IconRight,
    fullWidth = false,
    accessibilityLabel,
    children,
  },
  ref,
) {
  const { colors, radii, mode } = useTheme();
  const { reduced } = useMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const destructiveBg = mode === 'light' ? '#dc2626' : '#ef4444';

  type VariantStyle = { bg: string; text: string; border?: string };
  const variantMap: Record<ButtonVariant, VariantStyle> = {
    primary: { bg: colors.accent, text: '#ffffff' },
    secondary: { bg: colors['surface-2'], text: colors.ink, border: colors.hairline },
    ghost: { bg: 'transparent', text: colors.accent },
    destructive: { bg: destructiveBg, text: '#ffffff' },
  };

  const v = variantMap[variant];
  const h = HEIGHT[size];
  const iconSize = ICON_SIZE[size];

  const pressableStyle: ViewStyle = {
    backgroundColor: v.bg,
    borderRadius: radii.button,
    height: h,
    minWidth: h,
    paddingHorizontal: H_PAD[size],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: v.border ? StyleSheet.hairlineWidth * 2 : 0,
    borderColor: v.border,
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    opacity: disabled ? 0.4 : 1,
  };

  const textStyle: TextStyle = {
    color: v.text,
    fontSize: FONT_SIZE[size],
    fontFamily: 'Inter_600SemiBold',
    lineHeight: h,
    includeFontPadding: false,
  };

  return (
    <AnimatedPressable
      ref={ref}
      onPress={disabled || loading ? undefined : onPress}
      onPressIn={() => {
        if (disabled || loading) return;
        void haptics.selection();
        opacity.value = withTiming(0.85, { duration: 80 });
        if (!reduced) scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
      }}
      onPressOut={() => {
        opacity.value = withTiming(1, { duration: 150 });
        if (!reduced) scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      style={[pressableStyle, animStyle]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <>
          {Icon && <Icon size={iconSize} color={v.text} />}
          {children && <Label style={textStyle}>{children}</Label>}
          {IconRight && <IconRight size={iconSize} color={v.text} />}
        </>
      )}
    </AnimatedPressable>
  );
});

export default Button;
