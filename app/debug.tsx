import { format } from 'date-fns';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';

import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import Pill from '@/components/ui/pill';
import { Body, Heading, Label, Mono, Title } from '@/components/ui/typography';
import { db } from '@/db/client';
import { getStreakInfo, listCheckInsForDate, toggleCheckIn } from '@/db/repos/check-ins';
import { listHabits } from '@/db/repos/habits';
import { listRituals } from '@/db/repos/rituals';
import type { Habit, Ritual } from '@/db/schema';
import { checkIns, habits as habitsTable, rituals as ritualsTable } from '@/db/schema';
import { seedIfEmpty } from '@/db/seed';
import { storage, StorageKey } from '@/lib/storage';
import { useTheme } from '@/theme/ThemeProvider';
import { tokens } from '@/theme/tokens';

type StreakInfo = { current: number; longest: number; lastCompletedDate: string | null };

export default function DebugScreen() {
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  // ── MMKV state ───────────────────────────────────────────────────────────
  const [mmkvValues, setMmkvValues] = useState<Record<string, string>>({});

  // ── DB state ─────────────────────────────────────────────────────────────
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [habitList, setHabitList] = useState<Habit[]>([]);
  const [checkInDates, setCheckInDates] = useState<string[]>([]);
  const [streaks, setStreaks] = useState<Record<string, StreakInfo>>({});

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const loadAll = useCallback(async () => {
    // MMKV
    const snapshot: Record<string, string> = {};
    for (const [key, val] of Object.entries(StorageKey)) {
      const str = storage.getString(val);
      const bool = storage.getBoolean(val);
      const num = storage.getNumber(val);
      if (str !== undefined) snapshot[key] = String(str);
      else if (bool !== undefined) snapshot[key] = String(bool);
      else if (num !== undefined) snapshot[key] = String(num);
      else snapshot[key] = '(unset)';
    }
    setMmkvValues(snapshot);

    // DB
    const r = await listRituals();
    setRituals(r);
    const h = await listHabits({ includeArchived: true });
    setHabitList(h);
    const ci = await listCheckInsForDate(todayStr);
    setCheckInDates(ci.map((c) => c.habitId));

    // Streaks
    const streakMap: Record<string, StreakInfo> = {};
    for (const habit of h) {
      streakMap[habit.id] = await getStreakInfo(habit.id);
    }
    setStreaks(streakMap);
  }, [todayStr]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  // ── Danger zone helpers ───────────────────────────────────────────────────
  const clearAllCheckIns = () => {
    Alert.alert('Clear all check-ins?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          db.delete(checkIns).run();
          await loadAll();
        },
      },
    ]);
  };

  const reseed = () => {
    Alert.alert('Re-seed database?', 'Wipes all rituals, habits, and check-ins.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Wipe & seed',
        style: 'destructive',
        onPress: async () => {
          db.delete(checkIns).run();
          db.delete(habitsTable).run();
          db.delete(ritualsTable).run();
          await seedIfEmpty();
          await loadAll();
        },
      },
    ]);
  };

  const clearMMKV = () => {
    Alert.alert('Clear MMKV?', 'Removes all stored settings.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          storage.clearAll();
          loadAll();
        },
      },
    ]);
  };

  const toggleHaptics = () => {
    const current = storage.getBoolean(StorageKey.SETTINGS_HAPTICS) ?? true;
    storage.setBoolean(StorageKey.SETTINGS_HAPTICS, !current);
    loadAll();
  };

  const toggleNotifications = () => {
    const current = storage.getBoolean(StorageKey.SETTINGS_NOTIFICATIONS) ?? true;
    storage.setBoolean(StorageKey.SETTINGS_NOTIFICATIONS, !current);
    loadAll();
  };

  const cycleTheme = () => {
    const current = storage.getString(StorageKey.SETTINGS_THEME) ?? 'system';
    const next = current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system';
    storage.setString(StorageKey.SETTINGS_THEME, next);
    loadAll();
  };

  const addRandomCheckIn = async () => {
    const first = habitList.find((h) => h.archivedAt == null);
    if (!first) return;
    await toggleCheckIn(first.id, todayStr);
    await loadAll();
  };

  const sep = {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: tokens.spacing[3],
  };
  const section = { marginBottom: tokens.spacing[6] };

  return (
    <>
      <Stack.Screen options={{ title: 'Debug', headerShown: true }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: tokens.spacing[4], paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {/* ── Storage section ───────────────────────────────────────────── */}
        <View style={section}>
          <Title style={{ marginBottom: tokens.spacing[3] }}>Storage (MMKV)</Title>
          <Card>
            {Object.entries(mmkvValues).map(([key, val], i, arr) => (
              <View key={key}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: tokens.spacing[2],
                  }}>
                  <Label style={{ color: colors['ink-mute'] }}>{key}</Label>
                  <Mono style={{ color: colors.ink }}>{val}</Mono>
                </View>
                {i < arr.length - 1 && <View style={sep} />}
              </View>
            ))}
          </Card>

          <View
            style={{
              flexDirection: 'row',
              gap: tokens.spacing[2],
              marginTop: tokens.spacing[3],
              flexWrap: 'wrap',
            }}>
            <Button
              variant="secondary"
              size="sm"
              accessibilityLabel="Toggle haptics"
              onPress={toggleHaptics}>
              Toggle haptics
            </Button>
            <Button
              variant="secondary"
              size="sm"
              accessibilityLabel="Toggle notifications"
              onPress={toggleNotifications}>
              Toggle notifications
            </Button>
            <Button
              variant="secondary"
              size="sm"
              accessibilityLabel="Cycle theme"
              onPress={cycleTheme}>
              Cycle theme
            </Button>
          </View>
        </View>

        {/* ── DB section ────────────────────────────────────────────────── */}
        <View style={section}>
          <Title style={{ marginBottom: tokens.spacing[3] }}>Database</Title>

          {rituals.map((ritual) => {
            const ritualHabits = habitList.filter((h) => h.ritualId === ritual.id);
            return (
              <Card key={ritual.id} style={{ marginBottom: tokens.spacing[3] }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: tokens.spacing[2],
                    marginBottom: tokens.spacing[2],
                  }}>
                  <Heading>{ritual.name}</Heading>
                  <Pill variant="accent">{ritual.slot}</Pill>
                  <Label style={{ color: colors['ink-mute'] }}>
                    {ritualHabits.length} habits
                  </Label>
                </View>
                {ritualHabits.map((h) => {
                  const checkedIn = checkInDates.includes(h.id);
                  return (
                    <View
                      key={h.id}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        paddingVertical: tokens.spacing[1],
                      }}>
                      <Body>{h.name}</Body>
                      <View style={{ flexDirection: 'row', gap: tokens.spacing[2] }}>
                        {h.archivedAt != null && <Pill variant="outlined">archived</Pill>}
                        {checkedIn && <Pill variant="sage">✓ today</Pill>}
                      </View>
                    </View>
                  );
                })}
              </Card>
            );
          })}

          <View style={{ marginTop: tokens.spacing[2] }}>
            <Button
              variant="secondary"
              size="sm"
              accessibilityLabel="Add check-in to first habit"
              onPress={addRandomCheckIn}>
              Add check-in to first habit (today)
            </Button>
          </View>
        </View>

        {/* ── Streak section ────────────────────────────────────────────── */}
        <View style={section}>
          <Title style={{ marginBottom: tokens.spacing[3] }}>Streaks</Title>
          <Card>
            {habitList
              .filter((h) => h.archivedAt == null)
              .map((h, i, arr) => {
                const s = streaks[h.id] ?? {
                  current: 0,
                  longest: 0,
                  lastCompletedDate: null,
                };
                return (
                  <View key={h.id}>
                    <View style={{ paddingVertical: tokens.spacing[2] }}>
                      <Body style={{ marginBottom: tokens.spacing[1] }}>{h.name}</Body>
                      <View style={{ flexDirection: 'row', gap: tokens.spacing[3] }}>
                        <Label style={{ color: colors['ink-mute'] }}>
                          current <Mono>{s.current}d</Mono>
                        </Label>
                        <Label style={{ color: colors['ink-mute'] }}>
                          longest <Mono>{s.longest}d</Mono>
                        </Label>
                        {s.lastCompletedDate && (
                          <Label style={{ color: colors['ink-mute'] }}>
                            last <Mono>{s.lastCompletedDate}</Mono>
                          </Label>
                        )}
                      </View>
                    </View>
                    {i < arr.length - 1 && <View style={sep} />}
                  </View>
                );
              })}
          </Card>
        </View>

        {/* ── Danger zone ───────────────────────────────────────────────── */}
        <View style={section}>
          <Title
            style={{ marginBottom: tokens.spacing[3], color: colors['accent-deep'] }}>
            Danger Zone
          </Title>
          <Card style={{ gap: tokens.spacing[3] }}>
            <Button
              variant="destructive"
              size="sm"
              accessibilityLabel="Clear all check-ins"
              onPress={clearAllCheckIns}>
              Clear all check-ins
            </Button>
            <Button
              variant="destructive"
              size="sm"
              accessibilityLabel="Re-seed database"
              onPress={reseed}>
              Re-seed (wipes everything)
            </Button>
            <Button
              variant="destructive"
              size="sm"
              accessibilityLabel="Clear MMKV storage"
              onPress={clearMMKV}>
              Clear MMKV
            </Button>
          </Card>
        </View>
      </ScrollView>
    </>
  );
}
