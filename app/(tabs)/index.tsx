import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { type Href, useRouter } from 'expo-router';
import HabitRow from '@/components/today/habit-row';
import Button from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import Pill from '@/components/ui/pill';
import Reveal from '@/components/ui/reveal';
import Skeleton from '@/components/ui/skeleton';
import StreakFlame from '@/components/ui/streak-flame';
import SyncStatusLine from '@/components/ui/SyncStatusLine';
import { Body, Caption, Display, Heading } from '@/components/ui/typography';
import { useRangeAggregate } from '@/hooks/use-stats';
import { getGreeting } from '@/lib/greeting';
import { useMotion } from '@/lib/hooks/use-motion';
import { addCheckIn, removeLastCheckIn } from '@/lib/mutations/check-in';
import { dismissDeliveredHabitReminder } from '@/lib/notifications';
import { syncNow } from '@/lib/sync/engine';
import { getTodayView, type TodayRitual, type TodayView } from '@/lib/queries/today';
import { queryKeys } from '@/lib/query-keys';
import { getTodayISO } from '@/lib/today';
import { useTodayStore } from '@/stores/today-store';
import { useTheme } from '@/theme/ThemeProvider';

export default function TodayScreen() {
  const { colors, spacing } = useTheme();
  const { stagger, reduced } = useMotion();
  const queryClientInstance = useQueryClient();
  const router = useRouter();
  const setHasIncompleteHabits = useTodayStore((s) => s.setHasIncompleteHabits);

  // ── Reactive greeting with crossfade (3.4) ─────────────────────────────
  const greetingRef = useRef(getGreeting(new Date()));
  const [greeting, setGreeting] = useState(() => greetingRef.current);
  const greetingOpacity = useSharedValue(1);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = getGreeting(new Date());
      if (next === greetingRef.current) return;
      greetingRef.current = next;
      if (reduced) {
        setGreeting(next);
        return;
      }
      greetingOpacity.value = withTiming(0, { duration: 350 }, (finished) => {
        'worklet';
        if (finished) {
          runOnJS(setGreeting)(next);
          greetingOpacity.value = withTiming(1, { duration: 350 });
        }
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, [reduced, greetingOpacity]);

  const greetingStyle = useAnimatedStyle(() => ({ opacity: greetingOpacity.value }));

  // ── Query ───────────────────────────────────────────────────────────────
  const now = new Date();
  const todayISO = getTodayISO(now);
  const dateFormatted = format(now, 'EEEE, d MMM');
  const queryKey = queryKeys.todayView(todayISO);

  const { data, isLoading, isRefetching } = useQuery({
    queryKey,
    queryFn: () => getTodayView(now),
  });

  // Weekly completion stat (2.4)
  const { data: weeklyAggregate } = useRangeAggregate('week');

  // Keep dataRef for AppState handler without stale closure
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Sync incomplete-habits flag to store for tab dot (3.2)
  useEffect(() => {
    if (!data) return;
    const allHabits = data.rituals.flatMap((r) => r.habits);
    setHasIncompleteHabits(allHabits.some((h) => !h.isComplete));
  }, [data, setHasIncompleteHabits]);

  // ── Foreground re-flash state (3.5) ────────────────────────────────────
  const [flashMap, setFlashMap] = useState<Record<string, { key: number; delay: number }>>({});

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      const now = Date.now();
      const SIXTY_MIN = 60 * 60 * 1000;
      setFlashMap((prev) => {
        const next = { ...prev };
        let count = 0;
        for (const ritual of dataRef.current?.rituals ?? []) {
          for (const h of ritual.habits) {
            if (
              h.completedAtToday !== null &&
              now - h.completedAtToday < SIXTY_MIN &&
              count < 3
            ) {
              next[h.id] = { key: (prev[h.id]?.key ?? 0) + 1, delay: count * 80 };
              count++;
            }
          }
        }
        return next;
      });
    });
    return () => sub.remove();
  }, []);

  // ── Mutations ───────────────────────────────────────────────────────────
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
              return {
                ...h,
                completedCount: newCount,
                isComplete: newCount >= h.target,
                completedAtToday: Date.now(),
              };
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
    mutationFn: ({ habitId }: { habitId: string }) => removeLastCheckIn(habitId, todayISO),
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
    router.push({ pathname: '/habit/[id]', params: { id: habitId } } as Href);
  }, [router]);

  const onRefresh = useCallback(() => {
    queryClientInstance.invalidateQueries({ queryKey });
    void syncNow();
  }, [queryClientInstance, queryKey]);

  const allHabits = data?.rituals.flatMap((r) => r.habits) ?? [];
  const totalCompleted = allHabits.filter((h) => h.isComplete).length;
  const totalCount = allHabits.length;
  const maxStreak = allHabits.reduce((max, h) => Math.max(max, h.currentStreak), 0);
  const hasNoHabits = !isLoading && totalCount === 0;
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
              {/* Greeting with crossfade (3.4) */}
              <Animated.View style={greetingStyle}>
                <Display style={styles.greeting}>{greeting}</Display>
              </Animated.View>
              <Body color="ink-mute">{dateFormatted}</Body>
              {/* Weekly completion stat (2.4) */}
              {weeklyAggregate !== undefined && (
                <Caption color="ink-mute">
                  {`This week: ${weeklyAggregate.completionPct}%`}
                </Caption>
              )}
            </View>
            <IconButton
              icon={Plus}
              variant="filled"
              size="md"
              onPress={() => router.push('/habit/new' as Href)}
              accessibilityLabel="Create a new habit"
            />
          </View>
        </View>

        <SyncStatusLine />

        {/* Summary pills */}
        {!isLoading && totalCount > 0 && (
          <View style={styles.pillRow}>
            <Pill
              variant={totalCompleted === totalCount && totalCount > 0 ? 'accent' : 'default'}>
              {`${totalCompleted} of ${totalCount} done`}
            </Pill>
            {maxStreak >= 2 && (
              <View style={[styles.streakPill, { backgroundColor: colors['surface-2'] }]}>
                <StreakFlame count={maxStreak} size="sm" />
              </View>
            )}
          </View>
        )}

        {isLoading && <LoadingSkeleton />}

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
                onPress={() => router.push('/habit/new' as Href)}>
                Create a habit
              </Button>
            </View>
          </Reveal>
        )}

        {/* Ritual sections */}
        {visibleRituals.map((ritual, index) => {
          const delay = stagger(index, 80);
          return (
            <Animated.View
              key={ritual.id}
              entering={reduced ? undefined : FadeInUp.duration(300).delay(delay)}>
              <RitualSection
                ritual={ritual}
                flashMap={flashMap}
                onCheck={handleCheck}
                onUncheck={handleUncheck}
                onEdit={handleEdit}
                onAddHabit={() =>
                  router.push({ pathname: '/habit/new', params: { ritualId: ritual.id } } as Href)
                }
              />
            </Animated.View>
          );
        })}

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Ritual section ────────────────────────────────────────────────────────

type RitualSectionProps = {
  ritual: TodayRitual;
  flashMap: Record<string, { key: number; delay: number }>;
  onCheck: (habitId: string) => void;
  onUncheck: (habitId: string) => void;
  onEdit: (habitId: string) => void;
  onAddHabit: () => void;
};

function RitualSection({
  ritual,
  flashMap,
  onCheck,
  onUncheck,
  onEdit,
  onAddHabit,
}: RitualSectionProps) {
  const { colors, radii } = useTheme();
  const completed = ritual.habits.filter((h) => h.isComplete).length;
  const total = ritual.habits.length;
  const allDone = completed === total && total > 0;
  const maxStreak = ritual.habits.reduce((max, h) => Math.max(max, h.currentStreak), 0);

  // Last-checked timestamp label (2.2)
  const lastCheckedLabel = useMemo(() => {
    if (ritual.lastCheckedAtToday === null) return 'Not started';
    const timeStr = format(new Date(ritual.lastCheckedAtToday), 'h:mm a');
    return allDone ? `Done · ${timeStr}` : `Last: ${timeStr}`;
  }, [ritual.lastCheckedAtToday, allDone]);

  return (
    <View style={styles.section}>
      {/* Header row: name · streak chip · arc ratio · + button */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Heading color="ink-soft">{ritual.name}</Heading>
          {/* Last-checked timestamp (2.2) */}
          <Caption color="ink-mute" style={styles.lastChecked}>
            {lastCheckedLabel}
          </Caption>
        </View>

        <View style={styles.sectionHeaderRight}>
          {/* Streak chip (2.3) — only when max streak ≥ 3 */}
          {maxStreak >= 3 && (
            <View style={[styles.streakChip, { backgroundColor: colors['surface-2'] }]}>
              <StreakFlame count={maxStreak} size="sm" />
            </View>
          )}

          {/* Progress arc + ratio (2.1) */}
          <View style={styles.arcRow}>
            <RitualArc
              completed={completed}
              total={total}
              accentColor={colors.accent}
              accentDeepColor={colors['accent-deep']}
              hairlineColor={colors.hairline}
            />
            <Caption color="ink-mute">{`${completed} / ${total}`}</Caption>
          </View>

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
              flashKey={flashMap[habit.id]?.key}
              flashDelay={flashMap[habit.id]?.delay}
            />
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

// ─── Ritual progress arc (2.1) ─────────────────────────────────────────────

type RitualArcProps = {
  completed: number;
  total: number;
  accentColor: string;
  accentDeepColor: string;
  hairlineColor: string;
};

function RitualArc({ completed, total, accentColor, accentDeepColor, hairlineColor }: RitualArcProps) {
  const size = 16;
  const stroke = 2;
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.min(completed / total, 1) : 0;
  const dashOffset = circumference * (1 - progress);
  const isDone = completed >= total && total > 0;

  return (
    <Svg width={size} height={size}>
      {/* Track */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={hairlineColor}
        strokeWidth={stroke}
        fill="none"
      />
      {/* Filled arc */}
      {completed > 0 && (
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isDone ? accentDeepColor : accentColor}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      )}
    </Svg>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────

function LoadingSkeleton() {
  const { colors, radii } = useTheme();
  return (
    <>
      {[0, 1].map((i) => (
        <View key={i} style={styles.section}>
          <View style={styles.sectionHeader}>
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
  headerText: { flex: 1, gap: 2 },
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeaderLeft: { flex: 1, gap: 1 },
  lastChecked: { fontSize: 11 },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  streakChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  arcRow: {
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
