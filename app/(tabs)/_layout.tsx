import { Tabs } from 'expo-router';
import { BarChart2, CalendarDays, Settings, Sun } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import OfflineBar from '@/components/ui/OfflineBar';
import * as haptics from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeProvider';

export default function TabLayout() {
  const { colors, tabBar, touchTarget } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = tabBar.height + insets.bottom;

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
            tabBarIcon: ({ color, size }) => (
              <Sun color={color} size={size} strokeWidth={1.75} />
            ),
          }}
          listeners={{ tabPress: () => void haptics.selection() }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color, size }) => (
              <CalendarDays color={color} size={size} strokeWidth={1.75} />
            ),
          }}
          listeners={{ tabPress: () => void haptics.selection() }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: 'Stats',
            tabBarIcon: ({ color, size }) => (
              <BarChart2 color={color} size={size} strokeWidth={1.75} />
            ),
          }}
          listeners={{ tabPress: () => void haptics.selection() }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <Settings color={color} size={size} strokeWidth={1.75} />
            ),
          }}
          listeners={{ tabPress: () => void haptics.selection() }}
        />
      </Tabs>

      {/* Offline bar — sits above tab bar, slides in/out with spring */}
      <View style={[styles.offlineBarContainer, { bottom: tabBarHeight }]}>
        <OfflineBar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  offlineBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
