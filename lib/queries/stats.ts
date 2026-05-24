import { asc, gte, lte, and } from 'drizzle-orm';
import {
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
  subDays,
  subWeeks,
} from 'date-fns';

import { db } from '@/db/client';
import { habits, checkIns } from '@/db/schema';
import { getEarliestActivityDate } from '@/lib/queries/history';

export type StatRange = 'week' | 'month' | 'alltime';

export type RangeAggregateResult = {
  completionPct: number;
  checkInCount: number;
  perfectDays: number;
  activeHabits: number;
  /** Max of currentStreakDays across all habits right now — NOT historical longest-ever. */
  currentLongestStreakDays: number;
  /** null for 'alltime', or when both windows have zero target (render "Even"). */
  previousCompletionPct: number | null;
};

export type SeriesPoint = {
  label: string;
  key: string;
  pct: number;
  isToday?: boolean;
};

export type ScorecardEntry = {
  habitId: string;
  name: string;
  colorTag: string;
  targetPerDay: number;
  completionPct: number;
  currentStreakDays: number;
  /** pct is ratio 0..1, not 0..100. hasData=false means habit didn't exist on that day/week. */
  cells: Array<{ key: string; pct: number; hasData: boolean }>;
};

// ── Internal types ────────────────────────────────────────────────────────────

type RawHabit = {
  id: string;
  name: string;
  color: string;
  targetPerDay: number;
  createdAt: number;
  archivedAt: number | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadHabits(): RawHabit[] {
  return db
    .select({
      id: habits.id,
      name: habits.name,
      color: habits.color,
      targetPerDay: habits.targetPerDay,
      createdAt: habits.createdAt,
      archivedAt: habits.archivedAt,
    })
    .from(habits)
    .orderBy(asc(habits.orderIndex))
    .all();
}

function loadCheckInsRange(fromISO: string, toISO: string) {
  return db
    .select({ habitId: checkIns.habitId, date: checkIns.date, count: checkIns.count })
    .from(checkIns)
    .where(and(gte(checkIns.date, fromISO), lte(checkIns.date, toISO)))
    .all();
}

function loadAllCheckIns() {
  return db
    .select({ habitId: checkIns.habitId, date: checkIns.date, count: checkIns.count })
    .from(checkIns)
    .all();
}

function buildCheckInMap(rows: { habitId: string; date: string; count: number }[]) {
  const m = new Map<string, number>();
  for (const ci of rows) m.set(`${ci.habitId}:${ci.date}`, ci.count);
  return m;
}

function habitActiveOnDate(h: RawHabit, dateISO: string): boolean {
  const createdISO = format(new Date(h.createdAt), 'yyyy-MM-dd');
  if (createdISO > dateISO) return false;
  if (h.archivedAt != null) {
    const archivedISO = format(new Date(h.archivedAt), 'yyyy-MM-dd');
    if (archivedISO < dateISO) return false;
  }
  return true;
}

type DayAgg = {
  totalCompleted: number;
  totalTarget: number;
  checkInCount: number;
  perfectDays: number;
  activeHabitIds: Set<string>;
};

function aggregateDays(
  days: string[],
  allHabits: RawHabit[],
  checkInMap: Map<string, number>,
): DayAgg {
  let totalCompleted = 0;
  let totalTarget = 0;
  let checkInCount = 0;
  let perfectDays = 0;
  const activeHabitIds = new Set<string>();

  for (const date of days) {
    let dayCompleted = 0;
    let dayTarget = 0;
    let dayPerfect = true;
    let dayHasHabits = false;

    for (const h of allHabits) {
      if (!habitActiveOnDate(h, date)) continue;
      dayHasHabits = true;
      dayTarget += h.targetPerDay;
      const raw = checkInMap.get(`${h.id}:${date}`) ?? 0;
      const completed = Math.min(raw, h.targetPerDay);
      dayCompleted += completed;
      if (completed < h.targetPerDay) dayPerfect = false;
      if (raw > 0) {
        checkInCount += completed;
        activeHabitIds.add(h.id);
      }
    }

    totalCompleted += dayCompleted;
    totalTarget += dayTarget;
    if (dayHasHabits && dayPerfect) perfectDays++;
  }

  return { totalCompleted, totalTarget, checkInCount, perfectDays, activeHabitIds };
}

/**
 * Computes the current streak for a single habit walking backward from today.
 *
 * GRACE RULE: One missed day per rolling 7-day window does NOT break the streak.
 * Walking backward from today, any 7-day span [d−6, d] may contain at most one
 * missed day (target > 0, completed < target). The second miss within the same
 * rolling window ends the streak at that point.
 *
 * currentStreakDays counts only hit days, not the graced miss days.
 * entryMap must include every day from habit creation through today; a date absent
 * from the map (target === 0) is treated as "habit didn't exist" and stops the walk.
 */
function computeCurrentStreak(
  entryMap: Map<string, { completed: number; target: number }>,
  todayISO: string,
): number {
  let streak = 0;
  const missDates: string[] = [];
  let d = parseISO(todayISO);

  for (let i = 0; i < 365; i++) {
    const dateISO = format(d, 'yyyy-MM-dd');
    const entry = entryMap.get(dateISO);

    if (!entry || entry.target === 0) break;

    if (entry.completed >= entry.target) {
      streak++;
    } else {
      const windowStartISO = format(subDays(d, 6), 'yyyy-MM-dd');
      const missesInWindow = missDates.filter((m) => m >= windowStartISO).length + 1;
      if (missesInWindow > 1) break;
      missDates.push(dateISO);
    }

    d = subDays(d, 1);
  }

  return streak;
}

function buildHabitEntryMap(
  h: RawHabit,
  todayISO: string,
  checkInMap: Map<string, number>,
): Map<string, { completed: number; target: number }> {
  const hCreatedISO = format(new Date(h.createdAt), 'yyyy-MM-dd');
  const hArchivedISO = h.archivedAt ? format(new Date(h.archivedAt), 'yyyy-MM-dd') : null;
  const hEndISO = hArchivedISO && hArchivedISO < todayISO ? hArchivedISO : todayISO;

  const entryMap = new Map<string, { completed: number; target: number }>();
  const days = eachDayOfInterval({ start: parseISO(hCreatedISO), end: parseISO(hEndISO) });

  for (const day of days) {
    const dISO = format(day, 'yyyy-MM-dd');
    const raw = checkInMap.get(`${h.id}:${dISO}`) ?? 0;
    entryMap.set(dISO, { completed: Math.min(raw, h.targetPerDay), target: h.targetPerDay });
  }
  return entryMap;
}

// ── Public query functions ────────────────────────────────────────────────────

/**
 * Returns aggregate stats for a rolling range ending at `anchor` (today).
 *
 * Rolling windows (all ending at anchor, inclusive):
 *   week    = last 7 days  [anchor−6 .. anchor]
 *   month   = last 30 days [anchor−29 .. anchor]
 *   alltime = [earliestActivity .. anchor]
 *
 * Completion % = sum(completed) / sum(target) — NOT mean of per-habit percentages.
 * Previous-range comparison uses the immediately preceding equal-length window.
 * previousCompletionPct is null for 'alltime' and when both windows have zero target.
 * When prior window has zero target but current has data, previousCompletionPct = 0.
 *
 * currentLongestStreakDays = max(currentStreakDays) across all habits as of today.
 * This is the longest active streak right now, NOT a historical longest-ever value.
 */
export async function getRangeAggregate(
  range: StatRange,
  anchor: Date,
): Promise<RangeAggregateResult> {
  const todayISO = format(anchor, 'yyyy-MM-dd');
  const allHabits = loadHabits();

  let fromDate: Date;
  if (range === 'week') {
    fromDate = subDays(anchor, 6);
  } else if (range === 'month') {
    fromDate = subDays(anchor, 29);
  } else {
    const earliest = await getEarliestActivityDate();
    fromDate = earliest ?? anchor;
  }

  const prevFrom =
    range === 'week' ? subDays(fromDate, 7) : range === 'month' ? subDays(fromDate, 30) : null;

  const loadFrom = prevFrom ?? fromDate;
  const rawCheckIns = loadCheckInsRange(format(loadFrom, 'yyyy-MM-dd'), todayISO);
  const checkInMap = buildCheckInMap(rawCheckIns);

  const days = eachDayOfInterval({ start: fromDate, end: anchor }).map((d) =>
    format(d, 'yyyy-MM-dd'),
  );
  const agg = aggregateDays(days, allHabits, checkInMap);
  const completionPct =
    agg.totalTarget > 0 ? Math.round((agg.totalCompleted / agg.totalTarget) * 100) : 0;

  let previousCompletionPct: number | null = null;
  if (prevFrom) {
    const prevDays = eachDayOfInterval({ start: prevFrom, end: subDays(fromDate, 1) }).map((d) =>
      format(d, 'yyyy-MM-dd'),
    );
    const prevAgg = aggregateDays(prevDays, allHabits, checkInMap);

    if (prevAgg.totalTarget === 0 && agg.totalTarget === 0) {
      previousCompletionPct = null;
    } else if (prevAgg.totalTarget === 0) {
      previousCompletionPct = 0;
    } else {
      previousCompletionPct = Math.round(
        (prevAgg.totalCompleted / prevAgg.totalTarget) * 100,
      );
    }
  }

  // Streak computation needs full all-time history per habit
  const allTimeMap = buildCheckInMap(loadAllCheckIns());
  let currentLongestStreakDays = 0;
  for (const h of allHabits) {
    const entryMap = buildHabitEntryMap(h, todayISO, allTimeMap);
    const s = computeCurrentStreak(entryMap, todayISO);
    if (s > currentLongestStreakDays) currentLongestStreakDays = s;
  }

  return {
    completionPct,
    checkInCount: agg.checkInCount,
    perfectDays: agg.perfectDays,
    activeHabits: agg.activeHabitIds.size,
    currentLongestStreakDays,
    previousCompletionPct,
  };
}

/**
 * Returns the chart data series for the selected range.
 *
 * week:    7 points, one per day (oldest → newest). label = 3-char weekday.
 * month:   30 points, one per day. label = day-of-month number string.
 * alltime: 12 points, one per ISO week (Mon-start) ending this week. label = "Mmm d".
 *          The most-recent bucket is marked isToday=true.
 */
export async function getRangeSeries(range: StatRange, anchor: Date): Promise<SeriesPoint[]> {
  const todayISO = format(anchor, 'yyyy-MM-dd');
  const allHabits = loadHabits();

  if (range === 'week' || range === 'month') {
    const nDays = range === 'week' ? 7 : 30;
    const from = subDays(anchor, nDays - 1);
    const dates = eachDayOfInterval({ start: from, end: anchor });
    const rawCheckIns = loadCheckInsRange(format(from, 'yyyy-MM-dd'), todayISO);
    const checkInMap = buildCheckInMap(rawCheckIns);

    return dates.map((d) => {
      const dateISO = format(d, 'yyyy-MM-dd');
      let totalCompleted = 0;
      let totalTarget = 0;
      for (const h of allHabits) {
        if (!habitActiveOnDate(h, dateISO)) continue;
        totalTarget += h.targetPerDay;
        const raw = checkInMap.get(`${h.id}:${dateISO}`) ?? 0;
        totalCompleted += Math.min(raw, h.targetPerDay);
      }
      const pct = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;
      const label = range === 'week' ? format(d, 'EEE').slice(0, 3) : format(d, 'd');
      return { label, key: dateISO, pct, isToday: dateISO === todayISO };
    });
  }

  // alltime: 12 weekly buckets (ISO weeks, Mon-start)
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const from = subWeeks(weekStart, 11);
  const weekStarts = eachWeekOfInterval(
    { start: from, end: weekStart },
    { weekStartsOn: 1 },
  ).slice(0, 12);

  const rawCheckIns = loadCheckInsRange(format(from, 'yyyy-MM-dd'), todayISO);
  const checkInMap = buildCheckInMap(rawCheckIns);

  return weekStarts.map((ws, idx) => {
    const we = endOfWeek(ws, { weekStartsOn: 1 });
    const clampedEnd = we > anchor ? anchor : we;
    const weekDays = eachDayOfInterval({ start: ws, end: clampedEnd });

    let totalCompleted = 0;
    let totalTarget = 0;
    for (const d of weekDays) {
      const dateISO = format(d, 'yyyy-MM-dd');
      for (const h of allHabits) {
        if (!habitActiveOnDate(h, dateISO)) continue;
        totalTarget += h.targetPerDay;
        const raw = checkInMap.get(`${h.id}:${dateISO}`) ?? 0;
        totalCompleted += Math.min(raw, h.targetPerDay);
      }
    }

    const pct = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;
    return {
      label: format(ws, 'MMM d'),
      key: format(ws, 'yyyy-MM-dd'),
      pct,
      isToday: idx === weekStarts.length - 1,
    };
  });
}

/**
 * Returns per-habit scorecards for the selected range.
 *
 * Cell arrays:
 *   week    → 7 day cells
 *   month   → 30 day cells
 *   alltime → 12 weekly cells
 *
 * cell.pct is a ratio 0..1 (not 0..100) for compatibility with getCellInfo.
 */
export async function getPerHabitScorecards(
  range: StatRange,
  anchor: Date,
): Promise<ScorecardEntry[]> {
  const todayISO = format(anchor, 'yyyy-MM-dd');
  const allHabits = loadHabits();
  if (allHabits.length === 0) return [];

  let fromDate: Date;
  if (range === 'week') {
    fromDate = subDays(anchor, 6);
  } else if (range === 'month') {
    fromDate = subDays(anchor, 29);
  } else {
    const earliest = await getEarliestActivityDate();
    fromDate = earliest ?? anchor;
  }

  // Single DB round-trip for all check-ins (streak + range both need history)
  const allTimeMap = buildCheckInMap(loadAllCheckIns());

  // Cell date list
  let cellDates: Date[];
  let isCellWeekly = false;

  if (range === 'alltime') {
    const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
    const wFrom = subWeeks(weekStart, 11);
    cellDates = eachWeekOfInterval(
      { start: wFrom, end: weekStart },
      { weekStartsOn: 1 },
    ).slice(0, 12);
    isCellWeekly = true;
  } else {
    cellDates = eachDayOfInterval({ start: fromDate, end: anchor });
  }

  const rangeDayDates = isCellWeekly
    ? eachDayOfInterval({ start: fromDate, end: anchor })
    : cellDates;

  return allHabits.map((h) => {
    let rangeCompleted = 0;
    let rangeTarget = 0;
    for (const d of rangeDayDates) {
      const dISO = format(d, 'yyyy-MM-dd');
      if (!habitActiveOnDate(h, dISO)) continue;
      rangeTarget += h.targetPerDay;
      const raw = allTimeMap.get(`${h.id}:${dISO}`) ?? 0;
      rangeCompleted += Math.min(raw, h.targetPerDay);
    }
    const completionPct = rangeTarget > 0 ? Math.round((rangeCompleted / rangeTarget) * 100) : 0;

    const entryMap = buildHabitEntryMap(h, todayISO, allTimeMap);
    const currentStreakDays = computeCurrentStreak(entryMap, todayISO);

    const cells = cellDates.map((cd) => {
      if (!isCellWeekly) {
        const dateISO = format(cd, 'yyyy-MM-dd');
        const active = habitActiveOnDate(h, dateISO);
        const raw = active ? (allTimeMap.get(`${h.id}:${dateISO}`) ?? 0) : 0;
        const completed = active ? Math.min(raw, h.targetPerDay) : 0;
        const target = active ? h.targetPerDay : 0;
        return { key: dateISO, pct: target > 0 ? completed / target : 0, hasData: active };
      }

      const we = endOfWeek(cd, { weekStartsOn: 1 });
      const clampedEnd = we > anchor ? anchor : we;
      const weekDays = eachDayOfInterval({ start: cd, end: clampedEnd });
      let wCompleted = 0;
      let wTarget = 0;
      for (const wd of weekDays) {
        const wdISO = format(wd, 'yyyy-MM-dd');
        if (!habitActiveOnDate(h, wdISO)) continue;
        wTarget += h.targetPerDay;
        const raw = allTimeMap.get(`${h.id}:${wdISO}`) ?? 0;
        wCompleted += Math.min(raw, h.targetPerDay);
      }
      return {
        key: format(cd, 'yyyy-MM-dd'),
        pct: wTarget > 0 ? wCompleted / wTarget : 0,
        hasData: wTarget > 0,
      };
    });

    return {
      habitId: h.id,
      name: h.name,
      colorTag: h.color,
      targetPerDay: h.targetPerDay,
      completionPct,
      currentStreakDays,
      cells,
    };
  });
}
