import React from 'react';
import {
  View,
  Pressable,
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

// ── Inner edge highlights (1px top + optional 1px bottom) ─────────────────
// These create the illusion of a light source from above in light mode, and
// the illusion of the card being recessed into the background in dark mode.
function CardHighlights({
  isDark,
  cardRadius,
}: {
  isDark: boolean;
  cardRadius: number;
}) {
  return (
    <>
      {/* Top inner highlight — catches "light from above" */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)',
          borderTopLeftRadius: cardRadius,
          borderTopRightRadius: cardRadius,
          zIndex: 1,
        }}
      />
      {/* Dark mode only: bottom inset shadow — creates recession illusion */}
      {isDark && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderBottomLeftRadius: cardRadius,
            borderBottomRightRadius: cardRadius,
            zIndex: 1,
          }}
        />
      )}
    </>
  );
}

export default function Card({
  variant = 'default',
  onPress,
  accessibilityLabel,
  style,
  children,
}: CardProps) {
  const { colors, radii, spacing, mode } = useTheme();
  const { reduced: isReducedMotion } = useMotion();
  const scale = useSharedValue(1);
  const isDark = mode === 'dark';

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Raised shadow — iOS only for same reason as default shadow above.
  const raisedShadow: ViewStyle =
    variant === 'raised' && Platform.OS === 'ios'
      ? {
          shadowColor: isDark ? '#000' : '#0a1628',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.4 : 0.08,
          shadowRadius: 8,
        }
      : {};

  // Default shadow — iOS only. Android elevation on every default card in a ScrollView
  // causes expensive shadow re-composition on each frame and freezes the emulator.
  const defaultShadow: ViewStyle =
    variant === 'default' && !isDark && Platform.OS === 'ios'
      ? {
          shadowColor: '#0a1628',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
        }
      : {};

  const containerStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing[5],
    // All variants now carry a hairline border — adds crisp edge definition
    borderWidth: 1,
    borderColor: colors.hairline,
    ...defaultShadow,
    ...raisedShadow,
  };

  if (!onPress) {
    return (
      <View style={[containerStyle, style]}>
        <CardHighlights isDark={isDark} cardRadius={radii.card} />
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
      <CardHighlights isDark={isDark} cardRadius={radii.card} />
      {children}
    </AnimatedPressable>
  );
}

