import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, BellOff, RefreshCw } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import IconButton from '@/components/ui/icon-button';
import { Body, Caption, Title } from '@/components/ui/typography';
import { listHabits } from '@/db/repos/habits';
import type { Habit } from '@/db/schema';
import {
  cancelAllReminders,
  cancelHabitReminder,
  getPermissionStatus,
  rescheduleAll,
  scheduleHabitReminder,
} from '@/lib/notifications';
import { storage, StorageKey } from '@/lib/storage';
import { useTheme } from '@/theme/ThemeProvider';

function useMasterEnabled() {
  const [enabled, setEnabled] = useState<boolean>(
    () => storage.getBoolean(StorageKey.SETTINGS_NOTIFICATIONS) !== false,
  );

  const toggle = useCallback(async (next: boolean) => {
    storage.setBoolean(StorageKey.SETTINGS_NOTIFICATIONS, next);
    setEnabled(next);
    if (next) {
      await rescheduleAll();
    } else {
      await cancelAllReminders();
    }
  }, []);

  return { enabled, toggle };
}

export default function NotificationsScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();

  const [permission, setPermission] = useState<
    'granted' | 'denied' | 'undetermined' | null
  >(null);
  const { enabled: masterEnabled, toggle: toggleMaster } = useMasterEnabled();
  const [rescheduling, setRescheduling] = useState(false);

  useEffect(() => {
    getPermissionStatus().then(setPermission);
  }, []);

  const habitsQuery = useQuery({
    queryKey: ['habits', 'withReminders'],
    queryFn: () => listHabits({ includeArchived: false }),
    select: (all) => all.filter((h) => h.reminderTime != null),
  });

  const habitsWithReminders: Habit[] = habitsQuery.data ?? [];

  const handleHabitToggle = useCallback(
    async (habit: Habit, next: boolean) => {
      if (next) {
        await scheduleHabitReminder(habit);
      } else {
        await cancelHabitReminder(habit.id);
      }
      await qc.invalidateQueries({ queryKey: ['habits', 'withReminders'] });
    },
    [qc],
  );

  const handleRescheduleAll = useCallback(async () => {
    setRescheduling(true);
    try {
      await rescheduleAll();
      await qc.invalidateQueries({ queryKey: ['habits', 'withReminders'] });
    } finally {
      setRescheduling(false);
    }
  }, [qc]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: spacing[4] }]}>
        <IconButton
          icon={ArrowLeft}
          variant="ghost"
          size="sm"
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        />
        <Title>Notifications</Title>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing[4] }]}
        showsVerticalScrollIndicator={false}>
        {/* Permission denied state */}
        {permission === 'denied' && (
          <Card variant="flat" style={styles.deniedCard}>
            <View style={styles.deniedRow}>
              <BellOff size={20} color={colors['ink-mute']} />
              <View style={{ flex: 1, gap: 4 }}>
                <Body>Notifications are disabled</Body>
                <Caption color="ink-mute">
                  Enable notifications in System Settings so Dawnwell can remind you of
                  your habits.
                </Caption>
              </View>
            </View>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => Linking.openSettings()}
              accessibilityLabel="Open system settings">
              Open Settings
            </Button>
          </Card>
        )}

        {/* Granted state */}
        {permission === 'granted' && (
          <>
            {/* Master toggle */}
            <Card variant="flat" style={styles.toggleCard}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Body>Habit reminders</Body>
                  <Caption color="ink-mute">
                    {masterEnabled ? 'Reminders are active' : 'All reminders cancelled'}
                  </Caption>
                </View>
                <Switch
                  value={masterEnabled}
                  onValueChange={toggleMaster}
                  trackColor={{ false: colors.hairline, true: colors.accent }}
                  thumbColor="#ffffff"
                />
              </View>
            </Card>

            {/* Per-habit list */}
            {habitsWithReminders.length > 0 && (
              <>
                <Caption
                  color="ink-mute"
                  style={{ ...styles.sectionLabel, marginHorizontal: spacing[2] }}>
                  Habits with reminders
                </Caption>
                <Card variant="flat" style={styles.habitListCard}>
                  {habitsWithReminders.map((habit, i) => (
                    <View
                      key={habit.id}
                      style={[
                        styles.habitRow,
                        { paddingHorizontal: spacing[5], paddingVertical: spacing[3] },
                        i < habitsWithReminders.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.hairline,
                        },
                      ]}>
                      <View style={[styles.habitDot, { backgroundColor: habit.color }]} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Body>{habit.name}</Body>
                        <Caption color="ink-mute">{habit.reminderTime}</Caption>
                      </View>
                      <Switch
                        value={!!habit.reminderNotificationId}
                        onValueChange={(next) => handleHabitToggle(habit, next)}
                        disabled={!masterEnabled}
                        trackColor={{ false: colors.hairline, true: colors.accent }}
                        thumbColor="#ffffff"
                      />
                    </View>
                  ))}
                </Card>
              </>
            )}

            {habitsWithReminders.length === 0 && !habitsQuery.isLoading && (
              <Card variant="flat">
                <View style={styles.emptyRow}>
                  <Bell size={20} color={colors['ink-mute']} />
                  <Caption color="ink-mute">
                    No habits have reminder times set. Add a reminder time when creating
                    or editing a habit.
                  </Caption>
                </View>
              </Card>
            )}

            {/* Reschedule all */}
            <View style={styles.rescheduleRow}>
              <Button
                variant="secondary"
                size="sm"
                icon={RefreshCw}
                loading={rescheduling}
                disabled={!masterEnabled || rescheduling}
                onPress={handleRescheduleAll}
                accessibilityLabel="Reschedule all reminders">
                Reschedule all
              </Button>
            </View>
          </>
        )}
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
  deniedCard: { gap: 16, padding: 16 },
  deniedRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  toggleCard: { padding: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 11,
    marginTop: 8,
    marginBottom: 4,
  },
  habitListCard: { padding: 0, overflow: 'hidden' },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
  },
  habitDot: { width: 10, height: 10, borderRadius: 5 },
  emptyRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  rescheduleRow: { alignItems: 'flex-start' },
});
