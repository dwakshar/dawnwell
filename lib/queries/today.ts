import { eq, isNull } from 'drizzle-orm';
import { format } from 'date-fns';

import { db } from '@/db/client';
import { habits, rituals, checkIns } from '@/db/schema';
import { getStreakInfo } from '@/db/repos/check-ins';

export type TodayHabit = {
  id: string;
  name: string;
  icon: string;
  color: string;
  target: number;
  completedCount: number;
  isComplete: boolean;
  currentStreak: number;
  reminderTime: string | null;
};

export type TodayRitual = {
  id: string;
  name: string;
  kind: string;
  habits: TodayHabit[];
};

export type TodayView = {
  dateISO: string;
  rituals: TodayRitual[];
};

const SLOT_ORDER = ['morning', 'focus', 'evening', 'custom'];

export async function getTodayView(date: Date): Promise<TodayView> {
  const dateISO = format(date, 'yyyy-MM-dd');

  const rows = db
    .select({
      habitId: habits.id,
      habitName: habits.name,
      icon: habits.icon,
      color: habits.color,
      targetPerDay: habits.targetPerDay,
      reminderTime: habits.reminderTime,
      habitOrderIndex: habits.orderIndex,
      ritualId: rituals.id,
      ritualName: rituals.name,
      ritualSlot: rituals.slot,
      ritualOrderIndex: rituals.orderIndex,
    })
    .from(habits)
    .innerJoin(rituals, eq(habits.ritualId, rituals.id))
    .where(isNull(habits.archivedAt))
    .orderBy(rituals.orderIndex, habits.orderIndex)
    .all();

  const todayCheckIns = db
    .select({ habitId: checkIns.habitId, count: checkIns.count })
    .from(checkIns)
    .where(eq(checkIns.date, dateISO))
    .all();

  const checkInMap = new Map<string, number>(
    todayCheckIns.map((ci) => [ci.habitId, ci.count]),
  );

  const streakMap = new Map<string, number>();
  await Promise.all(
    rows.map(async (row) => {
      const info = await getStreakInfo(row.habitId);
      streakMap.set(row.habitId, info.current);
    }),
  );

  type RitualEntry = {
    ritual: { id: string; name: string; slot: string; orderIndex: number };
    ritualHabits: TodayHabit[];
  };

  const ritualMap = new Map<string, RitualEntry>();

  for (const row of rows) {
    if (!ritualMap.has(row.ritualId)) {
      ritualMap.set(row.ritualId, {
        ritual: {
          id: row.ritualId,
          name: row.ritualName,
          slot: row.ritualSlot,
          orderIndex: row.ritualOrderIndex,
        },
        ritualHabits: [],
      });
    }
    const completedCount = checkInMap.get(row.habitId) ?? 0;
    const isComplete = completedCount >= row.targetPerDay;
    ritualMap.get(row.ritualId)!.ritualHabits.push({
      id: row.habitId,
      name: row.habitName,
      icon: row.icon,
      color: row.color,
      target: row.targetPerDay,
      completedCount,
      isComplete,
      currentStreak: streakMap.get(row.habitId) ?? 0,
      reminderTime: row.reminderTime ?? null,
    });
  }

  const sorted = [...ritualMap.values()].sort((a, b) => {
    const aIdx = SLOT_ORDER.indexOf(a.ritual.slot);
    const bIdx = SLOT_ORDER.indexOf(b.ritual.slot);
    const aSort = aIdx === -1 ? 999 : aIdx;
    const bSort = bIdx === -1 ? 999 : bIdx;
    if (aSort !== bSort) return aSort - bSort;
    return a.ritual.orderIndex - b.ritual.orderIndex;
  });

  return {
    dateISO,
    rituals: sorted.map(({ ritual, ritualHabits }) => ({
      id: ritual.id,
      name: ritual.name,
      kind: ritual.slot,
      habits: ritualHabits,
    })),
  };
}
