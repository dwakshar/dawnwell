import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  useReducedMotion,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@/theme/ThemeProvider';

export type DrawerSide = 'right' | 'left';

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  side?: DrawerSide;
  width?: number;
  children: React.ReactNode;
};

export default function Drawer({
  open,
  onClose,
  side = 'right',
  width: drawerWidth = 320,
  children,
}: DrawerProps) {
  const { colors, radii } = useTheme();
  const isReducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(open);

  const offscreen = side === 'right' ? drawerWidth : -drawerWidth;
  const translateX = useSharedValue(offscreen);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setVisible(true);
      translateX.value = withTiming(0, {
        duration: isReducedMotion ? 0 : 250,
        easing: Easing.out(Easing.cubic),
      });
      backdropOpacity.value = withTiming(0.4, { duration: 200 });
    } else {
      translateX.value = withTiming(offscreen, {
        duration: isReducedMotion ? 0 : 250,
        easing: Easing.out(Easing.cubic),
      });
      backdropOpacity.value = withTiming(0, { duration: 200 });
      const t = setTimeout(() => setVisible(false), 280);
      return () => clearTimeout(t);
    }
  }, [open, offscreen, isReducedMotion, translateX, backdropOpacity]);

  const close = () => {
    onClose();
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      const dx = e.translationX;
      if (side === 'right' && dx > 0) translateX.value = dx;
      else if (side === 'left' && dx < 0) translateX.value = dx;
    })
    .onEnd((e) => {
      const threshold = drawerWidth * 0.4;
      const shouldClose =
        side === 'right'
          ? e.translationX > threshold
          : e.translationX < -threshold;

      if (shouldClose) {
        translateX.value = withTiming(offscreen, { duration: 200 });
        backdropOpacity.value = withTiming(0, { duration: 200 });
        runOnJS(close)();
      } else {
        translateX.value = withSpring(0, { damping: 15, stiffness: 300 });
      }
    });

  const drawerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const drawerStyle = {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    [side]: 0,
    width: drawerWidth,
    backgroundColor: colors.surface,
    borderTopLeftRadius: side === 'right' ? radii.sheet : 0,
    borderBottomLeftRadius: side === 'right' ? radii.sheet : 0,
    borderTopRightRadius: side === 'left' ? radii.sheet : 0,
    borderBottomRightRadius: side === 'left' ? radii.sheet : 0,
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: 'black' }, backdropAnimStyle]}
          pointerEvents={open ? 'auto' : 'none'}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityLabel="Close drawer"
          />
        </Animated.View>

        <GestureDetector gesture={panGesture}>
          <Animated.View style={[drawerStyle, drawerAnimStyle]}>
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}
