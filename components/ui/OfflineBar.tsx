import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSyncStore } from '@/lib/stores/sync-store';
import { Caption } from '@/components/ui/typography';
import { useTheme } from '@/theme/ThemeProvider';
import { useMotion } from '@/lib/hooks/use-motion';

const BAR_HEIGHT = 34;

export default function OfflineBar() {
  const { colors } = useTheme();
  const { reduced } = useMotion();
  const status = useSyncStore((s) => s.status);
  const pendingCount = useSyncStore((s) => s.pendingCount);

  const visible = status === 'offline' && pendingCount > 0;

  const translateY = useSharedValue(visible ? 0 : -BAR_HEIGHT);
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      // Slide down from above with spring
      translateY.value = reduced
        ? 0
        : withSpring(0, { damping: 22, stiffness: 240 });
      opacity.value = withTiming(1, { duration: reduced ? 0 : 200 });
    } else {
      // Slide up + fade
      translateY.value = withTiming(-BAR_HEIGHT, {
        duration: reduced ? 0 : 250,
        easing: Easing.out(Easing.cubic),
      });
      opacity.value = withTiming(0, { duration: reduced ? 0 : 250 });
    }
  }, [visible, reduced, translateY, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  // Always render; height is fixed so it occupies space only when visible.
  // pointerEvents="none" when hidden so it doesn't intercept touches.
  return (
    <Animated.View
      style={[
        styles.bar,
        { backgroundColor: colors['surface-2'] },
        animStyle,
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Caption color="ink-mute">
        {`Offline · ${pendingCount} change${pendingCount !== 1 ? 's' : ''} will sync`}
      </Caption>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: BAR_HEIGHT,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
