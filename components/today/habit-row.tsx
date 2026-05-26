import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { useMotion } from '@/lib/hooks/use-motion';
import { Body, Caption, Mono } from '@/components/ui/typography';
import HabitDot from '@/components/ui/habit-dot';
import StreakFlame from '@/components/ui/streak-flame';
import * as haptics from '@/lib/haptics';
import type { TodayHabit } from '@/lib/queries/today';

export type HabitRowProps = {
  habit: TodayHabit;
  onCheck: (habitId: string) => void;
  onUncheck: (habitId: string) => void;
  onEditPress?: (habitId: string) => void;
  /**
   * Increment to trigger a foreground re-flash (3.5 ambient motion).
   * HabitRow watches this value and re-plays the completion glow when it changes.
   */
  flashKey?: number;
  /** Delay in ms before re-flash plays — used for staggering multiple rows. */
  flashDelay?: number;
};

// Spring config for check-in scale punch — tuned for responsive but grounded feel
const CHECK_SPRING = { damping: 18, stiffness: 220, mass: 0.8 };

export default function HabitRow({
  habit,
  onCheck,
  onUncheck,
  onEditPress,
  flashKey = 0,
  flashDelay = 0,
}: HabitRowProps) {
  const { colors } = useTheme();
  const { reduced } = useMotion();

  const rowScale = useSharedValue(1);
  const tintOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const checkVisible = useSharedValue(habit.isComplete ? 1 : 0);

  useEffect(() => {
    if (habit.isComplete) {
      checkVisible.value = withSpring(1, { damping: 12, stiffness: 200 });
    } else {
      checkVisible.value = withTiming(0, { duration: 150 });
    }
  }, [habit.isComplete, checkVisible]);

  // Foreground re-flash: when flashKey increments (app returns to foreground),
  // briefly replay the glow for habits completed in the last 60 minutes.
  useEffect(() => {
    if (flashKey === 0 || reduced) return;
    glowOpacity.value = withDelay(
      flashDelay,
      withSequence(
        withTiming(1, { duration: 60 }),
        withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [flashKey, flashDelay, reduced, glowOpacity]);

  const handlePress = () => {
    if (habit.isComplete) return;
    void haptics.medium();

    if (!reduced) {
      rowScale.value = withSequence(
        withSpring(0.94, CHECK_SPRING),
        withSpring(1.04, CHECK_SPRING),
        withSpring(1, CHECK_SPRING),
      );
      tintOpacity.value = withSequence(
        withTiming(0.1, { duration: 120 }),
        withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
      );
      glowOpacity.value = withSequence(
        withTiming(1, { duration: 60 }),
        withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }),
      );
    }
    onCheck(habit.id);
  };

  const handleLongPress = () => {
    if (!habit.isComplete) return;
    void haptics.selection();
    onUncheck(habit.id);
  };

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rowScale.value }],
  }));

  const tintStyle = useAnimatedStyle(() => ({
    opacity: tintOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const checkFillStyle = useAnimatedStyle(() => ({
    opacity: checkVisible.value,
  }));

  const checkIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(checkVisible.value, [0, 1], [0.6, 1]) }],
    opacity: checkVisible.value,
  }));

  const dotState = habit.isComplete ? 'complete' : habit.completedCount > 0 ? 'partial' : 'empty';

  const a11yLabel = habit.isComplete
    ? `${habit.name}, completed`
    : `${habit.name}, completed ${habit.completedCount} of ${habit.target} today`;

  return (
    <Animated.View style={rowStyle}>
      {/* Glow layer */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors['surface-2'] }, glowStyle]}
        pointerEvents="none"
      />

      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={500}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint={habit.isComplete ? 'Long press to undo last check-in' : undefined}
        style={styles.row}
      >
        {/* Habit-color tint flash overlay */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: habit.color }, tintStyle]}
          pointerEvents="none"
        />

        {/* left: colored dot */}
        <HabitDot
          state={dotState}
          size="lg"
          color={habit.color}
          accessibilityLabel={habit.name}
        />

        {/* center: name + meta */}
        <Pressable
          style={styles.center}
          onLongPress={() => onEditPress?.(habit.id)}
          delayLongPress={400}
          accessibilityLabel={`Edit ${habit.name}`}
          accessibilityHint="Long press to edit this habit"
          accessibilityRole="button"
        >
          <View>
            <Body
              color={habit.isComplete ? 'ink-mute' : 'ink'}
              style={styles.habitName}
              numberOfLines={1}
            >
              {habit.name}
            </Body>
            {habit.isComplete && (
              <View
                style={[styles.strikethrough, { backgroundColor: colors['ink-mute'] }]}
              />
            )}
          </View>

          {habit.currentStreak >= 2 ? (
            <StreakFlame count={habit.currentStreak} size="sm" />
          ) : habit.target > 1 ? (
            <Caption color="ink-mute">{habit.completedCount} / {habit.target} today</Caption>
          ) : null}
        </Pressable>

        {/* right: check control */}
        {habit.target === 1 ? (
          <View style={styles.checkSquareContainer}>
            <View style={[styles.checkSquare, { borderColor: colors.hairline }]}>
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: habit.color, borderRadius: 8 },
                  checkFillStyle,
                ]}
              />
              <Animated.View style={[styles.checkIconInner, checkIconStyle]}>
                <Check size={15} color="#ffffff" strokeWidth={2.5} />
              </Animated.View>
            </View>
          </View>
        ) : (
          <CircularProgress
            completedCount={habit.completedCount}
            target={habit.target}
            color={habit.color}
            isComplete={habit.isComplete}
            hairlineColor={colors.hairline}
            checkFillStyle={checkFillStyle}
            checkIconStyle={checkIconStyle}
          />
        )}
      </Pressable>
    </Animated.View>
  );
}

type CircularProgressProps = {
  completedCount: number;
  target: number;
  color: string;
  isComplete: boolean;
  hairlineColor: string;
  checkFillStyle: ReturnType<typeof useAnimatedStyle>;
  checkIconStyle: ReturnType<typeof useAnimatedStyle>;
};

function CircularProgress({
  completedCount,
  target,
  color,
  isComplete,
  hairlineColor,
  checkFillStyle,
  checkIconStyle,
}: CircularProgressProps) {
  const size = 44;
  const stroke = 2.5;
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(completedCount / target, 1);
  const dashOffset = circumference * (1 - progress);

  return (
    <View style={styles.circularContainer}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={hairlineColor}
          strokeWidth={stroke}
          fill="none"
        />
        {completedCount > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        )}
      </Svg>
      {isComplete ? (
        <Animated.View style={checkIconStyle}>
          <Check size={14} color={color} strokeWidth={2.5} />
        </Animated.View>
      ) : (
        <Mono style={{ fontSize: 9, color }}>{`${completedCount}/${target}`}</Mono>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
    gap: 12,
  },
  center: {
    flex: 1,
    gap: 3,
  },
  habitName: {
    fontFamily: 'Inter_500Medium',
  },
  strikethrough: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
  },
  checkSquareContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSquare: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIconInner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
