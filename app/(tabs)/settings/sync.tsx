import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import { ArrowLeft, RefreshCw } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import IconButton from '@/components/ui/icon-button';
import Pill from '@/components/ui/pill';
import { Body, Caption, Title } from '@/components/ui/typography';
import { syncNow } from '@/lib/sync/engine';
import { useSyncStore } from '@/lib/stores/sync-store';
import { useMotion } from '@/lib/hooks/use-motion';
import { useTheme } from '@/theme/ThemeProvider';

export default function SyncScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { status, lastSyncedAt, lastResult, error, pendingCount } = useSyncStore();
  const { reduced } = useMotion();
  const [triggering, setTriggering] = useState(false);

  const handleSyncNow = useCallback(async () => {
    setTriggering(true);
    try {
      await syncNow();
    } finally {
      setTriggering(false);
    }
  }, []);

  const isBusy = status === 'syncing' || triggering;
  const isOffline = status === 'offline';

  const pillVariant =
    status === 'idle' ? 'sage'
    : status === 'syncing' ? 'amber'
    : status === 'offline' ? 'outlined'
    : 'default';

  // Breathing animation for pending count (3.1) — worklet-only, no JS involvement
  const breatheOpacity = useSharedValue(1);

  useEffect(() => {
    if (pendingCount === 0 || reduced) {
      cancelAnimation(breatheOpacity);
      breatheOpacity.value = withTiming(1, { duration: 200 });
      return;
    }
    breatheOpacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1000 }),
        withTiming(1.0, { duration: 1000 }),
      ),
      -1,
      false,
    );
  }, [pendingCount, reduced, breatheOpacity]);

  const breatheStyle = useAnimatedStyle(() => ({ opacity: breatheOpacity.value }));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: spacing[4] }]}>
        <IconButton
          icon={ArrowLeft}
          variant="ghost"
          size="sm"
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        />
        <Title>Sync</Title>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing[4] }]}
        showsVerticalScrollIndicator={false}>

        <View style={styles.statusRow}>
          <Pill variant={pillVariant}>
            {status === 'syncing' ? 'Syncing…' : status}
          </Pill>
          {isBusy && <ActivityIndicator size="small" color={colors.accent} />}
        </View>

        {lastSyncedAt ? (
          <Caption color="ink-mute" style={styles.lastSynced}>
            Last synced {formatDistanceToNow(lastSyncedAt, { addSuffix: true })}
          </Caption>
        ) : (
          <Caption color="ink-mute" style={styles.lastSynced}>Never synced</Caption>
        )}

        {/* Breathing pending count (3.1) */}
        {pendingCount > 0 && (
          <Animated.View style={breatheStyle}>
            <Caption color="ink-soft">
              {pendingCount} change{pendingCount !== 1 ? 's' : ''} waiting to sync
            </Caption>
          </Animated.View>
        )}

        {lastResult && (
          <Card style={styles.resultCard}>
            <View style={styles.resultRow}>
              <Caption color="ink-mute">Pushed</Caption>
              <Caption>{lastResult.pushed}</Caption>
            </View>
            <View style={styles.resultRow}>
              <Caption color="ink-mute">Pulled</Caption>
              <Caption>{lastResult.pulled}</Caption>
            </View>
            <View style={styles.resultRow}>
              <Caption color="ink-mute">Conflicts resolved</Caption>
              <Caption>{lastResult.conflicts}</Caption>
            </View>
            <View style={styles.resultRow}>
              <Caption color="ink-mute">Duration</Caption>
              <Caption>{lastResult.durationMs}ms</Caption>
            </View>
          </Card>
        )}

        {status === 'error' && error && (
          <Card style={styles.errorCard}>
            <Body color="ink-soft">{error}</Body>
            <Button
              variant="secondary"
              size="sm"
              onPress={handleSyncNow}
              disabled={isBusy}
              accessibilityLabel="Retry sync">
              Retry
            </Button>
          </Card>
        )}

        {isOffline && (
          <Caption color="ink-mute" style={styles.offlineNote}>
            You're offline. Sync will resume automatically when you reconnect.
          </Caption>
        )}

        <View style={styles.syncButton}>
          <Button
            variant="primary"
            size="md"
            icon={RefreshCw}
            disabled={isBusy || isOffline}
            loading={isBusy}
            onPress={handleSyncNow}
            accessibilityLabel="Sync now">
            Sync now
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    paddingBottom: 12,
  },
  scroll: { flex: 1 },
  content: { gap: 12, paddingBottom: 48 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  lastSynced: { marginBottom: 4 },
  resultCard: { gap: 8, padding: 16 },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorCard: { gap: 12, padding: 16 },
  offlineNote: { fontStyle: 'italic' },
  syncButton: { marginTop: 8 },
});
