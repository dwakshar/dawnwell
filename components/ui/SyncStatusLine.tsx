import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSyncStore } from '@/lib/stores/sync-store';
import { Caption } from '@/components/ui/typography';
import { useMotion } from '@/lib/hooks/use-motion';

type LineState = 'hidden' | 'syncing' | 'synced' | 'offline';

function useSyncLineState(): LineState {
  const status = useSyncStore((s) => s.status);
  const [lineState, setLineState] = useState<LineState>('hidden');
  const prevStatus = useRef(status);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (status === 'offline') {
      setLineState('offline');
    } else if (status === 'syncing') {
      // Delay 500ms before showing "Syncing..." — don't flash for fast syncs
      timer = setTimeout(() => setLineState('syncing'), 500);
    } else if (status === 'idle' || status === 'error') {
      if (prevStatus.current === 'syncing') {
        setLineState('synced');
        timer = setTimeout(() => setLineState('hidden'), 1500);
      } else if (prevStatus.current === 'offline') {
        setLineState('hidden');
      }
    }

    prevStatus.current = status;
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [status]);

  return lineState;
}

export default function SyncStatusLine() {
  const { reduced } = useMotion();
  const lineState = useSyncLineState();
  const opacity = useSharedValue(0);

  useEffect(() => {
    const target = lineState !== 'hidden' ? 1 : 0;
    opacity.value = withTiming(target, { duration: reduced ? 0 : 200 });
  }, [lineState, opacity, reduced]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const message =
    lineState === 'syncing'
      ? 'Syncing...'
      : lineState === 'synced'
        ? 'Synced'
        : lineState === 'offline'
          ? "You're offline — changes will sync later"
          : '';

  const isOffline = lineState === 'offline';

  return (
    <Animated.View style={[styles.container, animStyle]} pointerEvents="none">
      <Caption color={isOffline ? 'sage' : 'ink-mute'}>
        {message}
      </Caption>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 6,
  },
});
