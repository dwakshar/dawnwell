import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';
import { Body, Caption, Heading, Label, Mono, Title } from '@/components/ui/typography';
import Button from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import HabitDot from '@/components/ui/habit-dot';
import Skeleton from '@/components/ui/skeleton';
import Reveal from '@/components/ui/reveal';
import BottomSheet, { BottomSheetScrollView } from '@/components/ui/bottom-sheet';
import { getCellInfo } from '@/lib/history';
import { getTodayISO } from '@/lib/today';
import {
  useDayDetail,
  useEarliestActivityDate,
  useHistoryHabits,
  useMonthCheckIns,
} from '@/hooks/use-history';
import type { Habit } from '@/db/schema';
import type { DayCheckIn } from '@/lib/queries/history';

// ─── Constants ─────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CELL_GAP = 4;
const H_PAD = 20;
const SELECTED_HABIT_ID_ALL = 'all' as const;

// ─── Root screen ───────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { colors, spacing, tabBar } = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  const todayISO = getTodayISO();
  const today = new Date();

  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(today));
  const [selectedHabitId, setSelectedHabitId] = useState<string>(SELECTED_HABIT_ID_ALL);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const monthKey = format(currentMonth, 'yyyy-MM');
  const isCurrentMonth = isSameMonth(currentMonth, today);

  const { data: habits = [], isLoading: habitsLoading } = useHistoryHabits();
  const {
    data: checkIns,
    isLoading: checkInsLoading,
    isError: checkInsError,
    refetch: refetchCheckIns,
  } = useMonthCheckIns(selectedHabitId, currentMonth);
  const { data: earliestDate } = useEarliestActivityDate();

  const selectedHabit = useMemo(
    () => habits.find((h) => h.id === selectedHabitId) ?? null,
    [habits, selectedHabitId],
  );

  const accentColor =
    selectedHabitId === SELECTED_HABIT_ID_ALL
      ? undefined
      : (selectedHabit?.color ?? undefined);

  // ── Month bounds ────────────────────────────────────────────────────────
  const canGoBack = useMemo(() => {
    if (!earliestDate) return false;
    return startOfMonth(currentMonth) > startOfMonth(earliestDate);
  }, [currentMonth, earliestDate]);

  const canGoForward = !isCurrentMonth;

  const goToPrevMonth = useCallback(() => {
    if (canGoBack) setCurrentMonth((m) => startOfMonth(subMonths(m, 1)));
  }, [canGoBack]);

  const goToNextMonth = useCallback(() => {
    if (canGoForward) setCurrentMonth((m) => startOfMonth(addMonths(m, 1)));
  }, [canGoForward]);

  const goToToday = useCallback(() => {
    setCurrentMonth(startOfMonth(today));
  }, [today]);

  // ── Day tap ─────────────────────────────────────────────────────────────
  const handleDayPress = useCallback(
    (date: Date) => {
      const dateISO = format(date, 'yyyy-MM-dd');
      if (dateISO > todayISO) return; // future — no-op
      setSelectedDay(date);
      setSheetOpen(true);
    },
    [todayISO],
  );

  // ── Check-in map ────────────────────────────────────────────────────────
  const checkInMap = useMemo(() => {
    const m = new Map<string, DayCheckIn>();
    if (checkIns) {
      for (const ci of checkIns) m.set(ci.date, ci);
    }
    return m;
  }, [checkIns]);

  // ── Cell size ───────────────────────────────────────────────────────────
  const cellSize = (screenWidth - H_PAD * 2 - CELL_GAP * 6) / 7;

  // ── Empty states ────────────────────────────────────────────────────────
  const hasNoHabits = !habitsLoading && habits.length === 0;
  const hasHabitsNoCheckIns = !habitsLoading && habits.length > 0 && earliestDate == null;

  const habitCount = habits.length;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingHorizontal: H_PAD }]}>
        <Title>History</Title>
        {!habitsLoading && (
          <Label color="ink-mute">
            {habitCount === 0
              ? 'No habits yet'
              : habitCount === 1
                ? '1 habit tracked'
                : `${habitCount} habits tracked`}
          </Label>
        )}
      </View>

      {hasNoHabits ? (
        <EmptyNoHabits />
      ) : (
        <>
          {/* ── Habit selector ────────────────────────────────────────── */}
          {habits.length > 0 && (
            <HabitSelector
              habits={habits}
              selectedId={selectedHabitId}
              onSelect={setSelectedHabitId}
            />
          )}

          {/* ── Month strip ───────────────────────────────────────────── */}
          <MonthStrip
            currentMonth={currentMonth}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            isCurrentMonth={isCurrentMonth}
            onPrev={goToPrevMonth}
            onNext={goToNextMonth}
            onToday={goToToday}
          />

          {/* ── Calendar / error ──────────────────────────────────────── */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingHorizontal: H_PAD, paddingBottom: tabBar.height + 32 },
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              checkInsError ? (
                <RefreshControl
                  refreshing={checkInsLoading}
                  onRefresh={refetchCheckIns}
                  tintColor={colors.accent}
                  colors={[colors.accent]}
                />
              ) : undefined
            }
          >
            {checkInsError ? (
              <View style={styles.errorState}>
                <Body color="ink-soft" align="center">
                  Couldn't load history. Pull down to retry.
                </Body>
              </View>
            ) : (
              <>
                <HeatmapCalendar
                  key={`${monthKey}-${selectedHabitId}`}
                  currentMonth={currentMonth}
                  todayISO={todayISO}
                  checkInMap={checkInMap}
                  isLoading={checkInsLoading}
                  cellSize={cellSize}
                  accentColor={accentColor}
                  onDayPress={handleDayPress}
                />

                {hasHabitsNoCheckIns && (
                  <Caption
                    color="ink-mute"
                    align="center"
                    style={styles.emptyCaption}
                  >
                    Check in on Today to start filling this in.
                  </Caption>
                )}
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* ── Day detail sheet ──────────────────────────────────────────── */}
      <DayDetailSheet
        open={sheetOpen}
        date={selectedDay}
        onClose={() => setSheetOpen(false)}
      />
    </SafeAreaView>
  );
}

// ─── Habit selector ────────────────────────────────────────────────────────

type HabitSelectorProps = {
  habits: Habit[];
  selectedId: string;
  onSelect: (id: string) => void;
};

function HabitSelector({ habits, selectedId, onSelect }: HabitSelectorProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.selectorContent,
        { paddingHorizontal: H_PAD, gap: 8 },
      ]}
      style={styles.selector}
    >
      {/* "All habits" pill */}
      <SelectorPill
        label="All habits"
        selected={selectedId === SELECTED_HABIT_ID_ALL}
        onPress={() => onSelect(SELECTED_HABIT_ID_ALL)}
      />

      {habits.map((habit) => (
        <SelectorPill
          key={habit.id}
          label={habit.name}
          habitColor={habit.color}
          selected={selectedId === habit.id}
          onPress={() => onSelect(habit.id)}
        />
      ))}
    </ScrollView>
  );
}

type SelectorPillProps = {
  label: string;
  selected: boolean;
  habitColor?: string;
  onPress: () => void;
};

function SelectorPill({ label, selected, habitColor, onPress }: SelectorPillProps) {
  const { colors, radii } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[
        styles.selectorPill,
        {
          backgroundColor: selected ? colors['surface-2'] : 'transparent',
          borderColor: colors.hairline,
          borderRadius: radii.pill,
        },
      ]}
    >
      {habitColor && (
        <View
          style={[
            styles.pillDot,
            { backgroundColor: habitColor },
          ]}
        />
      )}
      <Label style={{ color: selected ? colors.ink : colors['ink-soft'] }}>{label}</Label>
    </Pressable>
  );
}

// ─── Month strip ────────────────────────────────────────────────────────────

type MonthStripProps = {
  currentMonth: Date;
  canGoBack: boolean;
  canGoForward: boolean;
  isCurrentMonth: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
};

function MonthStrip({
  currentMonth,
  canGoBack,
  canGoForward,
  isCurrentMonth,
  onPrev,
  onNext,
  onToday,
}: MonthStripProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.monthStrip, { paddingHorizontal: H_PAD }]}>
      <IconButton
        icon={ChevronLeft}
        variant="ghost"
        size="sm"
        disabled={!canGoBack}
        onPress={onPrev}
        accessibilityLabel="Previous month"
      />

      <Heading style={styles.monthLabel}>{format(currentMonth, 'MMMM yyyy')}</Heading>

      <View style={styles.monthStripRight}>
        {!isCurrentMonth && (
          <Reveal direction="fade" delay={0}>
            <Pressable
              onPress={onToday}
              accessibilityRole="button"
              accessibilityLabel="Jump to current month"
            >
              <Label color="accent">Today</Label>
            </Pressable>
          </Reveal>
        )}
        <IconButton
          icon={ChevronRight}
          variant="ghost"
          size="sm"
          disabled={!canGoForward}
          onPress={onNext}
          accessibilityLabel="Next month"
        />
      </View>
    </View>
  );
}

// ─── Heatmap calendar ───────────────────────────────────────────────────────

type HeatmapCalendarProps = {
  currentMonth: Date;
  todayISO: string;
  checkInMap: Map<string, DayCheckIn>;
  isLoading: boolean;
  cellSize: number;
  accentColor: string | undefined;
  onDayPress: (date: Date) => void;
};

function HeatmapCalendar({
  currentMonth,
  todayISO,
  checkInMap,
  isLoading,
  cellSize,
  accentColor,
  onDayPress,
}: HeatmapCalendarProps) {
  const { colors } = useTheme();
  const isReducedMotion = useReducedMotion();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const leadingEmpties = getDay(monthStart);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const totalCells = leadingEmpties + daysInMonth.length;
  const trailingEmpties = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);

  // Build flat cell list then chunk into rows
  type EmptyCell = { type: 'empty'; key: string };
  type DayCell = {
    type: 'day';
    key: string;
    date: Date;
    dateISO: string;
    index: number;
  };
  type Cell = EmptyCell | DayCell;

  const cells = useMemo<Cell[]>(() => {
    const result: Cell[] = [];
    let dayIndex = 0;
    for (let i = 0; i < leadingEmpties; i++) {
      result.push({ type: 'empty', key: `lead-${i}` });
    }
    for (const day of daysInMonth) {
      result.push({
        type: 'day',
        key: format(day, 'yyyy-MM-dd'),
        date: day,
        dateISO: format(day, 'yyyy-MM-dd'),
        index: dayIndex++,
      });
    }
    for (let i = 0; i < trailingEmpties; i++) {
      result.push({ type: 'empty', key: `trail-${i}` });
    }
    return result;
    // currentMonth is a stable reference within a given component mount (keyed by monthKey+habitId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  const rows = useMemo<Cell[][]>(() => {
    const r: Cell[][] = [];
    for (let i = 0; i < cells.length; i += 7) r.push(cells.slice(i, i + 7));
    return r;
  }, [cells]);

  let globalCellIndex = 0;

  return (
    <View>
      {/* Weekday header */}
      <View style={[styles.weekdayRow, { gap: CELL_GAP }]}>
        {WEEKDAY_LABELS.map((label, i) => (
          <View key={i} style={[styles.weekdayCell, { width: cellSize }]}>
            <Caption color="ink-mute" align="center">
              {label}
            </Caption>
          </View>
        ))}
      </View>

      {/* Day rows */}
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={[styles.calRow, { gap: CELL_GAP, marginBottom: CELL_GAP }]}>
          {row.map((cell) => {
            const idx = globalCellIndex++;
            if (cell.type === 'empty') {
              return (
                <View
                  key={cell.key}
                  style={{ width: cellSize, height: cellSize }}
                />
              );
            }

            if (isLoading) {
              return (
                <Skeleton
                  key={cell.key}
                  width={cellSize}
                  height={cellSize}
                  radius={10}
                />
              );
            }

            const ci = checkInMap.get(cell.dateISO);
            const completed = ci?.completed ?? 0;
            const target = ci?.target ?? 0;
            const cellInfo = getCellInfo(
              cell.dateISO,
              todayISO,
              completed,
              target,
              colors,
              accentColor,
            );

            const isToday = cell.dateISO === todayISO;
            const isFuture = cell.dateISO > todayISO;

            const borderStyle =
              isToday
                ? {
                    borderWidth: 1.5,
                    borderColor:
                      cellInfo.state === 'complete'
                        ? 'rgba(255,255,255,0.75)'
                        : colors.accent,
                  }
                : cellInfo.borderColor
                  ? { borderWidth: StyleSheet.hairlineWidth, borderColor: cellInfo.borderColor }
                  : {};

            const dayNumber = format(cell.date, 'd');
            const a11yPct = Math.round(
              target > 0 ? (completed / target) * 100 : 0,
            );
            const a11yLabel =
              isFuture
                ? `${format(cell.date, 'MMMM d')}, future`
                : target === 0
                  ? `${format(cell.date, 'MMMM d')}, no data`
                  : `${format(cell.date, 'MMMM d')}, ${completed} of ${target} completed, ${a11yPct} percent`;

            const cellContent = (
              <Pressable
                onPress={isFuture ? undefined : () => onDayPress(cell.date)}
                accessibilityLabel={a11yLabel}
                accessibilityRole={isFuture ? 'none' : 'button'}
                style={[
                  styles.dayCell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: cellInfo.bgColor,
                    opacity: isFuture ? 0.3 : 1,
                    ...borderStyle,
                  },
                ]}
              >
                {cellInfo.state !== 'future' && (
                  <Label
                    style={{
                      fontSize: 12,
                      fontFamily: 'Inter_600SemiBold',
                      lineHeight: cellSize,
                      color:
                        cellInfo.state === 'no-data' ? colors['ink-mute'] : cellInfo.textColor,
                    }}
                  >
                    {cellInfo.state === 'no-data' ? '·' : dayNumber}
                  </Label>
                )}
              </Pressable>
            );

            if (isReducedMotion) {
              return <View key={cell.key}>{cellContent}</View>;
            }

            return (
              <Animated.View
                key={cell.key}
                entering={FadeIn.duration(180).delay(idx * 8)}
              >
                {cellContent}
              </Animated.View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Day detail sheet ───────────────────────────────────────────────────────

type DayDetailSheetProps = {
  open: boolean;
  date: Date | null;
  onClose: () => void;
};

function DayDetailSheet({ open, date, onClose }: DayDetailSheetProps) {
  const { colors } = useTheme();
  const { data: entries = [], isLoading } = useDayDetail(open ? date : null);

  const totalCompleted = entries.filter((e) => e.completed >= e.target).length;
  const totalCount = entries.length;
  const pct = totalCount > 0 ? Math.round((totalCompleted / totalCount) * 100) : 0;

  const pillColor: 'sage' | 'amber' | 'ink-mute' =
    pct === 100 ? 'sage' : pct > 0 ? 'amber' : 'ink-mute';

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      snapPoints={['45%', '85%']}
      raw
    >
      <View
        // accessibilityViewIsModal so VoiceOver traps focus inside on iOS
        accessibilityViewIsModal
        style={styles.sheetContainer}
      >
        {/* Sheet header */}
        {date && (
          <View style={[styles.sheetHeader, { borderBottomColor: colors.hairline }]}>
            <Heading style={styles.sheetTitle}>
              {format(date, 'EEEE, MMMM d')}
            </Heading>

            {!isLoading && entries.length > 0 && (
              <View style={styles.sheetStatRow}>
                <Label color="ink-soft">
                  {`${totalCompleted} of ${totalCount} completed`}
                </Label>
                <View
                  style={[
                    styles.pctPill,
                    {
                      backgroundColor:
                        pillColor === 'sage'
                          ? colors.sage
                          : pillColor === 'amber'
                            ? colors.amber
                            : colors['surface-2'],
                    },
                  ]}
                >
                  <Caption
                    style={{
                      color:
                        pillColor === 'ink-mute' ? colors['ink-mute'] : '#ffffff',
                      fontFamily: 'Inter_600SemiBold',
                    }}
                  >
                    {`${pct}%`}
                  </Caption>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Habit list */}
        <BottomSheetScrollView contentContainerStyle={styles.sheetList}>
          {isLoading && (
            <>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.sheetRow}>
                  <Skeleton width={24} height={24} radius={12} />
                  <Skeleton width={140} height={14} radius={4} />
                </View>
              ))}
            </>
          )}

          {!isLoading && entries.length === 0 && (
            <View style={styles.sheetEmpty}>
              <Label color="ink-mute" align="center">
                Nothing tracked yet on this day.
              </Label>
            </View>
          )}

          {!isLoading &&
            entries.map((entry, i) => (
              <React.Fragment key={entry.habit.id}>
                {i > 0 && (
                  <View
                    style={[
                      styles.sheetHairline,
                      { backgroundColor: colors.hairline },
                    ]}
                  />
                )}
                <View style={styles.sheetRow}>
                  <HabitDot
                    state={
                      entry.completed >= entry.target
                        ? 'complete'
                        : entry.completed > 0
                          ? 'partial'
                          : 'empty'
                    }
                    size="sm"
                    color={entry.habit.color}
                    accessibilityLabel={entry.habit.name}
                  />
                  <Body style={styles.sheetHabitName}>{entry.habit.name}</Body>
                  <View style={styles.sheetRight}>
                    <Mono color="ink-soft">{`${entry.completed} / ${entry.target}`}</Mono>
                    {entry.completed >= entry.target && (
                      <Check size={14} color={colors.sage} strokeWidth={2.5} />
                    )}
                  </View>
                </View>
              </React.Fragment>
            ))}
        </BottomSheetScrollView>
      </View>
    </BottomSheet>
  );
}

// ─── Empty state A: zero habits ─────────────────────────────────────────────

function EmptyNoHabits() {
  const { spacing } = useTheme();
  return (
    <Reveal direction="up" delay={80}>
      <View style={[styles.emptyCenter, { paddingHorizontal: H_PAD }]}>
        <Title style={styles.emptyTitle}>No history yet</Title>
        <Body color="ink-mute" align="center" style={styles.emptyBody}>
          Create your first habit to start building a rhythm.
        </Body>
        <Button
          variant="primary"
          size="md"
          accessibilityLabel="Create your first habit"
          onPress={() => router.navigate('/')}
        >
          Create habit
        </Button>
      </View>
    </Reveal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: { paddingTop: 8, paddingBottom: 4, gap: 2 },

  selector: { flexGrow: 0 },
  selectorContent: {
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillDot: { width: 8, height: 8, borderRadius: 4 },

  monthStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  monthLabel: { fontSize: 20, lineHeight: 26 },
  monthStripRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 12 },

  weekdayRow: {
    flexDirection: 'row',
    marginBottom: CELL_GAP,
  },
  weekdayCell: { alignItems: 'center' },
  calRow: { flexDirection: 'row' },
  dayCell: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  errorState: {
    paddingTop: 64,
    paddingHorizontal: 32,
    alignItems: 'center',
  },

  emptyCaption: { marginTop: 12 },

  emptyCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 16,
  },
  emptyTitle: { textAlign: 'center' },
  emptyBody: { maxWidth: 280 },

  sheetContainer: { flex: 1 },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 22, lineHeight: 28 },
  sheetStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pctPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  sheetList: { paddingBottom: 32 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 20,
    gap: 12,
  },
  sheetHabitName: { flex: 1, fontSize: 15, lineHeight: 20 },
  sheetRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetHairline: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  sheetEmpty: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
});
