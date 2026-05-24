import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { eachDayOfInterval, format, parseISO } from 'date-fns';

import { db } from '@/db/client';
import { habits, checkIns } from '@/db/schema';
import type { Habit } from '@/db/schema';

export type DayCheckIn = {
  date: string;      // YYYY-MM-DD
  completed: number;
  target: number;
};

export type DayDetailEntry = {
  habit: Habit;
  completed: number;
  target: number;
};

/**
 * Returns one DayCheckIn per calendar day in [monthStart, monthEnd].
 *
 * For habitId === 'all': aggregation is sum(completed) / sum(target) across
 * every habit that existed on each day. This is a ratio of *totals*, NOT an
 * average of per-habit percentages — so two habits at 100% + one at 0% gives
 * 2/3 ≈ 67%, not (100+100+0)/3 = 67% either. The semantic difference matters
 * when habits have different targets (e.g. target=1 vs target=5).
 *
 * target === 0 in a returned row means no habit existed on that day.
 */
export async function getMonthCheckIns(
  habitId: string | 'all',
  monthStart: Date,
  monthEnd: Date,
): Promise<DayCheckIn[]> {
  const fromISO = format(monthStart, 'yyyy-MM-dd');
  const toISO = format(monthEnd, 'yyyy-MM-dd');

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd }).map((d) =>
    format(d, 'yyyy-MM-dd'),
  );

  if (habitId === 'all') {
    const allHabits = db
      .select({
        id: habits.id,
        targetPerDay: habits.targetPerDay,
        createdAt: habits.createdAt,
        archivedAt: habits.archivedAt,
      })
      .from(habits)
      .where(lte(habits.createdAt, monthEnd.getTime()))
      .all();

    const checkInRows = db
      .select({ habitId: checkIns.habitId, date: checkIns.date, count: checkIns.count })
      .from(checkIns)
      .where(and(gte(checkIns.date, fromISO), lte(checkIns.date, toISO)))
      .all();

    const checkInMap = new Map<string, number>();
    for (const ci of checkInRows) {
      checkInMap.set(`${ci.habitId}:${ci.date}`, ci.count);
    }

    return days.map((date) => {
      let totalCompleted = 0;
      let totalTarget = 0;

      for (const h of allHabits) {
        const createdDateISO = format(new Date(h.createdAt), 'yyyy-MM-dd');
        if (createdDateISO > date) continue;

        if (h.archivedAt != null) {
          const archivedDateISO = format(new Date(h.archivedAt), 'yyyy-MM-dd');
          if (archivedDateISO < date) continue;
        }

        totalTarget += h.targetPerDay;
        const raw = checkInMap.get(`${h.id}:${date}`) ?? 0;
        totalCompleted += Math.min(raw, h.targetPerDay);
      }

      return { date, completed: totalCompleted, target: totalTarget };
    });
  }

  // ── Single habit ──────────────────────────────────────────────────────────
  const habitRows = db.select().from(habits).where(eq(habits.id, habitId)).all();
  const habit = habitRows[0];
  if (!habit) return days.map((date) => ({ date, completed: 0, target: 0 }));

  const createdDateISO = format(new Date(habit.createdAt), 'yyyy-MM-dd');

  const checkInRows = db
    .select({ date: checkIns.date, count: checkIns.count })
    .from(checkIns)
    .where(
      and(
        eq(checkIns.habitId, habitId),
        gte(checkIns.date, fromISO),
        lte(checkIns.date, toISO),
      ),
    )
    .all();

  const checkInMap = new Map<string, number>(checkInRows.map((ci) => [ci.date, ci.count]));

  return days.map((date) => {
    if (date < createdDateISO) return { date, completed: 0, target: 0 };

    if (habit.archivedAt != null) {
      const archivedDateISO = format(new Date(habit.archivedAt), 'yyyy-MM-dd');
      if (archivedDateISO < date) return { date, completed: 0, target: 0 };
    }

    return {
      date,
      completed: Math.min(checkInMap.get(date) ?? 0, habit.targetPerDay),
      target: habit.targetPerDay,
    };
  });
}

/**
 * Returns the oldest of (earliest habit.createdAt) and (earliest check-in date).
 * Used to disable the left month-navigation chevron when there's no older data.
 */
export async function getEarliestActivityDate(): Promise<Date | null> {
  const oldestHabit = db
    .select({ createdAt: habits.createdAt })
    .from(habits)
    .orderBy(asc(habits.createdAt))
    .limit(1)
    .all()[0];

  const oldestCheckIn = db
    .select({ date: checkIns.date })
    .from(checkIns)
    .orderBy(asc(checkIns.date))
    .limit(1)
    .all()[0];

  const candidates: Date[] = [];
  if (oldestHabit) candidates.push(new Date(oldestHabit.createdAt));
  if (oldestCheckIn) candidates.push(parseISO(oldestCheckIn.date));

  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (a < b ? a : b));
}

/**
 * Returns all habits that existed on `date`, each with their completion count
 * and target for that day. Habits created after `date` are omitted.
 * Habits archived before `date` are omitted.
 */
export async function getDayDetail(date: Date): Promise<DayDetailEntry[]> {
  const dateISO = format(date, 'yyyy-MM-dd');

  const allHabits = db.select().from(habits).orderBy(habits.orderIndex).all();

  const existedOnDay = allHabits.filter((h) => {
    const createdDateISO = format(new Date(h.createdAt), 'yyyy-MM-dd');
    if (createdDateISO > dateISO) return false;
    if (h.archivedAt != null) {
      const archivedDateISO = format(new Date(h.archivedAt), 'yyyy-MM-dd');
      if (archivedDateISO < dateISO) return false;
    }
    return true;
  });

  const checkInRows = db
    .select({ habitId: checkIns.habitId, count: checkIns.count })
    .from(checkIns)
    .where(eq(checkIns.date, dateISO))
    .all();

  const checkInMap = new Map<string, number>(checkInRows.map((ci) => [ci.habitId, ci.count]));

  return existedOnDay.map((habit) => ({
    habit,
    completed: Math.min(checkInMap.get(habit.id) ?? 0, habit.targetPerDay),
    target: habit.targetPerDay,
  }));
}
