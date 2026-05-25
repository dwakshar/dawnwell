import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { format, getISOWeek, getISOWeekYear, parseISO, subDays } from 'date-fns';
import { nanoid } from 'nanoid/non-secure';

import { db } from '../client';
import { checkIns, habits, type CheckIn, type NewCheckIn } from '../schema';

function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

// ─── Reads ────────────────────────────────────────────────────────────────

export async function listCheckInsForDate(date: string): Promise<CheckIn[]> {
  return db
    .select()
    .from(checkIns)
    .where(and(eq(checkIns.date, date), isNull(checkIns.deletedAt)))
    .all();
}

export async function listCheckInsForHabit(
  habitId: string,
  opts: { from?: string; to?: string } = {},
): Promise<CheckIn[]> {
  return db
    .select()
    .from(checkIns)
    .where(
      and(
        eq(checkIns.habitId, habitId),
        isNull(checkIns.deletedAt),
        opts.from ? gte(checkIns.date, opts.from) : undefined,
        opts.to ? lte(checkIns.date, opts.to) : undefined,
      ),
    )
    .orderBy(checkIns.date)
    .all();
}

/** Active check-in for the given habit+date (excludes soft-deleted). */
export async function getCheckIn(habitId: string, date: string): Promise<CheckIn | null> {
  const rows = db
    .select()
    .from(checkIns)
    .where(
      and(eq(checkIns.habitId, habitId), eq(checkIns.date, date), isNull(checkIns.deletedAt)),
    )
    .all();
  return rows[0] ?? null;
}

/** Returns any check-in row for the given habit+date, including soft-deleted ones.
 *  Used by addCheckIn to detect unique-constraint conflicts before inserting. */
export async function getCheckInAny(habitId: string, date: string): Promise<CheckIn | null> {
  const rows = db
    .select()
    .from(checkIns)
    .where(and(eq(checkIns.habitId, habitId), eq(checkIns.date, date)))
    .all();
  return rows[0] ?? null;
}

// ─── Toggle ───────────────────────────────────────────────────────────────

export async function toggleCheckIn(habitId: string, date: string): Promise<CheckIn | null> {
  const habitRows = db.select().from(habits).where(eq(habits.id, habitId)).all();
  const habit = habitRows[0];
  if (!habit) throw new Error(`Habit ${habitId} not found`);

  const existing = await getCheckIn(habitId, date);
  const now = Date.now();

  if (!existing) {
    const row: NewCheckIn = {
      id: nanoid(12),
      habitId,
      date,
      count: 1,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
      pendingSync: 1,
      version: 1,
    };
    db.insert(checkIns).values(row).run();
    return (await getCheckIn(habitId, date))!;
  }

  if (existing.count < habit.targetPerDay) {
    db.update(checkIns)
      .set({ count: existing.count + 1, completedAt: now, updatedAt: now, pendingSync: 1 })
      .where(eq(checkIns.id, existing.id))
      .run();
    return (await getCheckIn(habitId, date))!;
  }

  // count == targetPerDay → cycle back to 0 (soft-delete)
  db.update(checkIns)
    .set({ deletedAt: now, updatedAt: now, pendingSync: 1, version: sql`${checkIns.version} + 1` })
    .where(eq(checkIns.id, existing.id))
    .run();
  return null;
}

// ─── Streak ───────────────────────────────────────────────────────────────

type StreakInfo = {
  current: number;
  longest: number;
  lastCompletedDate: string | null;
};

export async function getStreakInfo(habitId: string): Promise<StreakInfo> {
  const habitRows = db.select().from(habits).where(eq(habits.id, habitId)).all();
  const habit = habitRows[0];
  if (!habit) throw new Error(`Habit ${habitId} not found`);

  const graceDays = habit.graceDaysPerWeek;

  const allRows = db
    .select({ date: checkIns.date })
    .from(checkIns)
    .where(and(eq(checkIns.habitId, habitId), isNull(checkIns.deletedAt)))
    .orderBy(checkIns.date)
    .all();

  if (allRows.length === 0) {
    return { current: 0, longest: 0, lastCompletedDate: null };
  }

  const completedDates = new Set(allRows.map((r) => r.date));
  const lastCompletedDate = allRows[allRows.length - 1]?.date ?? null;

  const todayStr = today();

  const current = computeStreakBackward(completedDates, todayStr, graceDays);
  const longest = computeLongestStreak(completedDates, lastCompletedDate ?? todayStr, graceDays);

  return { current, longest, lastCompletedDate };
}

function computeStreakBackward(
  completedDates: Set<string>,
  startDate: string,
  graceDays: number,
): number {
  let streak = 0;
  const weekMisses: Map<string, number> = new Map();

  let cursor = parseISO(startDate);

  if (!completedDates.has(startDate)) {
    cursor = subDays(cursor, 1);
  }

  while (true) {
    const dateStr = format(cursor, 'yyyy-MM-dd');
    const weekKey = `${getISOWeekYear(cursor)}-W${getISOWeek(cursor)}`;

    if (completedDates.has(dateStr)) {
      streak++;
    } else {
      const misses = (weekMisses.get(weekKey) ?? 0) + 1;
      weekMisses.set(weekKey, misses);
      if (misses > graceDays) break;
    }

    cursor = subDays(cursor, 1);

    const oldestDate = [...completedDates].sort()[0];
    if (!oldestDate) break;
    if (format(cursor, 'yyyy-MM-dd') < oldestDate) break;
  }

  return streak;
}

function computeLongestStreak(
  completedDates: Set<string>,
  endDate: string,
  graceDays: number,
): number {
  if (completedDates.size === 0) return 0;

  const sortedDates = [...completedDates].sort();
  const oldest = sortedDates[0]!;
  const newest =
    endDate > (sortedDates[sortedDates.length - 1] ?? '')
      ? sortedDates[sortedDates.length - 1]!
      : endDate;

  let longest = 0;
  let currentStreak = 0;
  const weekMisses: Map<string, number> = new Map();

  let cursor = parseISO(oldest);
  const end = parseISO(newest);

  while (format(cursor, 'yyyy-MM-dd') <= format(end, 'yyyy-MM-dd')) {
    const dateStr = format(cursor, 'yyyy-MM-dd');
    const weekKey = `${getISOWeekYear(cursor)}-W${getISOWeek(cursor)}`;

    if (completedDates.has(dateStr)) {
      currentStreak++;
      longest = Math.max(longest, currentStreak);
    } else {
      const misses = (weekMisses.get(weekKey) ?? 0) + 1;
      weekMisses.set(weekKey, misses);
      if (misses > graceDays) {
        currentStreak = 0;
        weekMisses.clear();
      }
    }

    cursor = subDays(cursor, -1);
  }

  return longest;
}
