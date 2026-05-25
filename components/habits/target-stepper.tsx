import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useMotion } from '@/lib/hooks/use-motion';
import { Minus, Plus } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Body, Caption } from '@/components/ui/typography';
import * as haptics from '@/lib/haptics';

export type TargetStepperProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function StepButton({
  icon: Icon,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  icon: typeof Minus;
  onPress: () => void;
  disabled: boolean;
  accessibilityLabel: string;
}) {
  const { colors, radii } = useTheme();
  const scale = useSharedValue(1);
  const { reduced: isReducedMotion } = useMotion();

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : onPress}
      onPressIn={() => {
        if (disabled) return;
        haptics.light();
        if (!isReducedMotion) scale.value = withSpring(0.92, { damping: 15, stiffness: 300 });
      }}
      onPressOut={() => {
        if (!isReducedMotion) scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[
        styles.stepBtn,
        {
          backgroundColor: colors['surface-2'],
          borderRadius: radii.button,
          opacity: disabled ? 0.35 : 1,
        },
        animStyle,
      ]}
    >
      <Icon size={18} color={colors.ink} />
    </AnimatedPressable>
  );
}

export default function TargetStepper({
  value,
  onChange,
  min = 1,
  max = 12,
}: TargetStepperProps) {
  const { colors } = useTheme();

  const hint =
    value > 1
      ? `You'll tap the habit ${value} times each day to complete it`
      : 'How many times per day';

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <StepButton
          icon={Minus}
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          accessibilityLabel="Decrease daily target"
        />
        <Body
          style={{ ...styles.value, color: colors.ink }}
          accessibilityLabel={`Daily target: ${value}`}
        >
          {value}
        </Body>
        <StepButton
          icon={Plus}
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          accessibilityLabel="Increase daily target"
        />
      </View>
      <Caption color="ink-mute" style={styles.hint}>
        {hint}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    minWidth: 32,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
  },
  hint: { lineHeight: 18 },
});
