import { Tabs } from 'expo-router';
import { BarChart2, CalendarDays, Settings, Sun } from 'lucide-react-native';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import OfflineBar from '@/components/ui/OfflineBar';
import * as haptics from '@/lib/haptics';
import { useMotion } from '@/lib/hooks/use-motion';
import { useTodayStore } from '@/stores/today-store';
import { useTheme } from '@/theme/ThemeProvider';

export default function TabLayout() {
  const { colors, tabBar, touchTarget } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = tabBar.height + insets.bottom;
  const hasIncompleteHabits = useTodayStore((s) => s.hasIncompleteHabits);

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors['ink-mute'],
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.hairline,
            height: tabBarHeight,
            paddingBottom: insets.bottom,
            paddingTop: 8,
            ...Platform.select({
              android: { elevation: 0 },
              ios: { shadowOpacity: 0 },
            }),
          },
          tabBarLabelStyle: {
            fontFamily: 'Inter_500Medium',
            fontSize: 10,
            marginTop: 2,
          },
          tabBarIconStyle: {
            marginBottom: 0,
          },
          tabBarItemStyle: {
            minHeight: touchTarget.min,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Today',
            tabBarIcon: ({ color, size, focused }) => (
              <TabIconWithDot
                icon={<Sun color={color} size={size} strokeWidth={1.75} />}
                active={focused}
                pulse={focused && hasIncompleteHabits}
              />
            ),
          }}
          listeners={{ tabPress: () => void haptics.selection() }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color, size, focused }) => (
              <TabIconWithDot
                icon={<CalendarDays color={color} size={size} strokeWidth={1.75} />}
                active={focused}
                pulse={false}
              />
            ),
          }}
          listeners={{ tabPress: () => void haptics.selection() }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: 'Stats',
            tabBarIcon: ({ color, size, focused }) => (
              <TabIconWithDot
                icon={<BarChart2 color={color} size={size} strokeWidth={1.75} />}
                active={focused}
                pulse={false}
              />
            ),
          }}
          listeners={{ tabPress: () => void haptics.selection() }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size, focused }) => (
              <TabIconWithDot
                icon={<Settings color={color} size={size} strokeWidth={1.75} />}
                active={focused}
                pulse={false}
              />
            ),
          }}
          listeners={{ tabPress: () => void haptics.selection() }}
        />
      </Tabs>

      <View style={[styles.offlineBarContainer, { bottom: tabBarHeight }]}>
        <OfflineBar />
      </View>
    </View>
  );
}

// ─── Tab icon with pulsing dot ─────────────────────────────────────────────

type TabIconWithDotProps = {
  icon: React.ReactNode;
  active: boolean;
  pulse: boolean;
};

function TabIconWithDot({ icon, active, pulse }: TabIconWithDotProps) {
  const { colors } = useTheme();
  const { reduced } = useMotion();

  // Dot visibility fades in/out with active state
  const dotOpacity = useSharedValue(active ? 1 : 0);
  const dotScale = useSharedValue(1);

  useEffect(() => {
    dotOpacity.value = withTiming(active ? 1 : 0, { duration: 200 });
  }, [active, dotOpacity]);

  useEffect(() => {
    if (!pulse || !active || reduced) {
      cancelAnimation(dotScale);
      dotScale.value = withTiming(1, { duration: 200 });
      return;
    }
    // Pulse: scale 1 → 1.3 → 1, opacity handled separately via dotScale-derived opacity
    dotScale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 800 }),
        withTiming(1.0, { duration: 800 }),
      ),
      -1,
      false,
    );
  }, [pulse, active, reduced, dotScale]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value * (pulse && active ? 0.7 + 0.3 * (dotScale.value - 1) / 0.3 : 1),
    transform: [{ scale: dotScale.value }],
  }));

  return (
    <View style={tabIconStyles.wrapper}>
      {icon}
      <Animated.View
        style={[
          tabIconStyles.dot,
          { backgroundColor: colors.accent },
          dotStyle,
        ]}
      />
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  offlineBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
