import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import HabitSheet, { type HabitSheetHandle } from '@/components/habits/habit-sheet';
import HabitRow from '@/components/today/habit-row';
import Button from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import Pill from '@/components/ui/pill';
import Reveal from '@/components/ui/reveal';
import Skeleton from '@/components/ui/skeleton';
import StreakFlame from '@/components/ui/streak-flame';
import SyncStatusLine from '@/components/ui/SyncStatusLine';
import { Body, Caption, Display, Heading } from '@/components/ui/typography';
import { getGreeting } from '@/lib/greeting';
import { useMotion } from '@/lib/hooks/use-motion';
import { addCheckIn, removeLastCheckIn } from '@/lib/mutations/check-in';
import { dismissDeliveredHabitReminder } from '@/lib/notifications';
import { syncNow } from '@/lib/sync/engine';
import { getTodayView, type TodayRitual, type TodayView } from '@/lib/queries/today';
import { queryKeys } from '@/lib/query-keys';
import { getTodayISO } from '@/lib/today';
import { useTheme } from '@/theme/ThemeProvider';

export default function TodayScreen() {
  const { colors, spacing } = useTheme();
  const { stagger, reduced } = useMotion();
  const queryClientInstance = useQueryClient();
  const sheetRef = useRef<HabitSheetHandle>(null);

  // Mount flag: stagger only fires on first mount, not subsequent re-renders
  const didMount = useRef(false);
  useEffect(() => {
    didMount.current = true;
  }, []);

  const now = new Date();
  const todayISO = getTodayISO(now);
  const greeting = getGreeting(now);
  const dateFormatted = format(now, 'EEEE, d MMM');

  const queryKey = queryKeys.todayView(todayISO);

  const { data, isLoading, isRefetching } = useQuery({
    queryKey,
    queryFn: () => getTodayView(now),
  });

  const invalidateHistory = () => {
    queryClientInstance.invalidateQueries({ queryKey: ['history'] });
    queryClientInstance.invalidateQueries({ queryKey: ['stats'] });
  };

  const checkMutation = useMutation({
    mutationFn: ({ habitId }: { habitId: string }) => addCheckIn(habitId, todayISO),
    onMutate: async ({ habitId }) => {
      await queryClientInstance.cancelQueries({ queryKey });
      const prev = queryClientInstance.getQueryData<TodayView>(queryKey);
      queryClientInstance.setQueryData<TodayView>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          rituals: old.rituals.map((ritual) => ({
            ...ritual,
            habits: ritual.habits.map((h) => {
              if (h.id !== habitId) return h;
              const newCount = Math.min(h.completedCount + 1, h.target);
              return { ...h, completedCount: newCount, isComplete: newCount >= h.target };
            }),
          })),
        };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClientInstance.setQueryData(queryKey, ctx.prev);
    },
    onSettled: (_data, _error, variables) => {
      queryClientInstance.invalidateQueries({ queryKey });
      invalidateHistory();
      void dismissDeliveredHabitReminder(variables.habitId);
    },
  });

  const uncheckMutation = useMutation({
    mutationFn: ({ habitId }: { habitId: string }) =>
      removeLastCheckIn(habitId, todayISO),
    onMutate: async ({ habitId }) => {
      await queryClientInstance.cancelQueries({ queryKey });
      const prev = queryClientInstance.getQueryData<TodayView>(queryKey);
      queryClientInstance.setQueryData<TodayView>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          rituals: old.rituals.map((ritual) => ({
            ...ritual,
            habits: ritual.habits.map((h) => {
              if (h.id !== habitId) return h;
              const newCount = Math.max(h.completedCount - 1, 0);
              return { ...h, completedCount: newCount, isComplete: newCount >= h.target };
            }),
          })),
        };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClientInstance.setQueryData(queryKey, ctx.prev);
    },
    onSettled: () => {
      queryClientInstance.invalidateQueries({ queryKey });
      invalidateHistory();
    },
  });

  const handleCheck = useCallback(
    (habitId: string) => checkMutation.mutate({ habitId }),
    [checkMutation],
  );

  const handleUncheck = useCallback(
    (habitId: string) => uncheckMutation.mutate({ habitId }),
    [uncheckMutation],
  );

  const handleEdit = useCallback((habitId: string) => {
    sheetRef.current?.openEdit(habitId);
  }, []);

  const onRefresh = useCallback(() => {
    queryClientInstance.invalidateQueries({ queryKey });
    void syncNow();
  }, [queryClientInstance, queryKey]);

  const allHabits = data?.rituals.flatMap((r) => r.habits) ?? [];
  const totalCompleted = allHabits.filter((h) => h.isComplete).length;
  const totalCount = allHabits.length;
  const maxStreak = allHabits.reduce((max, h) => Math.max(max, h.currentStreak), 0);
  const hasNoHabits = !isLoading && totalCount === 0;

  // Rituals that have habits — used to compute stagger index
  const visibleRituals = data?.rituals.filter((r) => r.habits.length > 0) ?? [];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing[4] }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Display style={styles.greeting}>{greeting}</Display>
              <Body color="ink-mute">{dateFormatted}</Body>
            </View>
            <IconButton
              icon={Plus}
              variant="filled"
              size="md"
              onPress={() => sheetRef.current?.openCreate()}
              accessibilityLabel="Create a new habit"
            />
          </View>
        </View>

        {/* Sync status line — fades in if sync takes >500ms */}
        <SyncStatusLine />

        {/* Summary pills */}
        {!isLoading && totalCount > 0 && (
          <View style={styles.pillRow}>
            <Pill
              variant={
                totalCompleted === totalCount && totalCount > 0 ? 'accent' : 'default'
              }>
              {`${totalCompleted} of ${totalCount} done`}
            </Pill>
            {maxStreak >= 2 && (
              <View style={[styles.streakPill, { backgroundColor: colors['surface-2'] }]}>
                <StreakFlame count={maxStreak} size="sm" />
              </View>
            )}
          </View>
        )}

        {/* Loading skeleton */}
        {isLoading && <LoadingSkeleton />}

        {/* Empty state */}
        {hasNoHabits && (
          <Reveal direction="up" delay={100}>
            <View style={styles.emptyState}>
              <Display style={styles.emptyTitle}>Your first ritual</Display>
              <Body color="ink-soft" style={styles.emptyBody}>
                Add a habit to get started. Small, gentle, anything that matters to you.
              </Body>
              <Button
                variant="primary"
                size="md"
                accessibilityLabel="Create your first habit"
                onPress={() => sheetRef.current?.openCreate()}>
                Create a habit
              </Button>
            </View>
          </Reveal>
        )}

        {/* Ritual sections — staggered entrance on first mount only */}
        {visibleRituals.map((ritual, index) => {
          // Stagger delay: 0 on subsequent renders (entering only fires on mount)
          const delay = stagger(index, 80);
          return (
            <Animated.View
              key={ritual.id}
              entering={reduced ? undefined : FadeInUp.duration(300).delay(delay)}
            >
              <RitualSection
                ritual={ritual}
                onCheck={handleCheck}
                onUncheck={handleUncheck}
                onEdit={handleEdit}
                onAddHabit={() => sheetRef.current?.openCreate(ritual.id)}
              />
            </Animated.View>
          );
        })}

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Habit sheet — single instance, opened imperatively */}
      <HabitSheet ref={sheetRef} />
    </SafeAreaView>
  );
}

// ─── Ritual section ────────────────────────────────────────────────────────

type RitualSectionProps = {
  ritual: TodayRitual;
  onCheck: (habitId: string) => void;
  onUncheck: (habitId: string) => void;
  onEdit: (habitId: string) => void;
  onAddHabit: () => void;
};

function RitualSection({
  ritual,
  onCheck,
  onUncheck,
  onEdit,
  onAddHabit,
}: RitualSectionProps) {
  const { colors, radii } = useTheme();
  const completed = ritual.habits.filter((h) => h.isComplete).length;
  const total = ritual.habits.length;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Heading color="ink-soft">{ritual.name}</Heading>
        <View style={styles.sectionHeaderRight}>
          <Caption color="ink-mute">{`${completed} / ${total}`}</Caption>
          <IconButton
            icon={Plus}
            variant="ghost"
            size="sm"
            onPress={onAddHabit}
            accessibilityLabel={`Add habit to ${ritual.name}`}
          />
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderRadius: radii.card },
        ]}>
        {ritual.habits.map((habit, index) => (
          <React.Fragment key={habit.id}>
            {index > 0 && (
              <View style={[styles.hairline, { backgroundColor: colors.hairline }]} />
            )}
            <HabitRow
              habit={habit}
              onCheck={onCheck}
              onUncheck={onUncheck}
              onEditPress={onEdit}
            />
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────

function LoadingSkeleton() {
  const { colors, radii } = useTheme();
  return (
    <>
      {[0, 1].map((i) => (
        <View key={i} style={styles.section}>
          <View style={[styles.sectionHeader]}>
            <Skeleton width={72} height={14} radius={4} />
            <Skeleton width={28} height={11} radius={4} />
          </View>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderRadius: radii.card },
            ]}>
            {[0, 1, 2].map((j) => (
              <React.Fragment key={j}>
                {j > 0 && (
                  <View style={[styles.hairline, { backgroundColor: colors.hairline }]} />
                )}
                <View style={styles.skeletonRow}>
                  <Skeleton width={36} height={36} radius={18} />
                  <View style={{ gap: 6, flex: 1 }}>
                    <Skeleton width={120} height={14} radius={4} />
                    <Skeleton width={72} height={11} radius={4} />
                  </View>
                  <Skeleton width={28} height={28} radius={8} />
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingTop: 8, paddingBottom: 32 },

  header: { marginBottom: 8 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerText: { flex: 1, gap: 4 },
  greeting: { fontSize: 32, lineHeight: 40 },

  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  streakPill: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
  },

  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  card: { overflow: 'hidden' },
  hairline: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },

  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
    gap: 12,
  },

  emptyState: {
    paddingTop: 48,
    paddingBottom: 32,
    alignItems: 'center',
    gap: 16,
  },
  emptyTitle: { textAlign: 'center', fontSize: 28, lineHeight: 36 },
  emptyBody: { textAlign: 'center', lineHeight: 24, maxWidth: 280 },

  bottomPad: { height: 40 },
});
