// Thin strip displayed below the tab bar when the device is offline AND there
// are pending local writes. Disappears automatically on reconnect (which also
// triggers syncNow via the connectivity watcher in engine.ts).

import { StyleSheet, View } from 'react-native';
import { useSyncStore } from '@/lib/stores/sync-store';
import { Caption } from '@/components/ui/typography';
import { useTheme } from '@/theme/ThemeProvider';

export default function OfflineBar() {
  const { colors } = useTheme();
  const status = useSyncStore((s) => s.status);
  const pendingCount = useSyncStore((s) => s.pendingCount);

  if (status !== 'offline' || pendingCount === 0) return null;

  return (
    <View style={[styles.bar, { backgroundColor: colors['surface-2'] }]}>
      <Caption color="ink-mute">
        {`Offline · ${pendingCount} change${pendingCount !== 1 ? 's' : ''} will sync`}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
