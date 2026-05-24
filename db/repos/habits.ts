import { eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid/non-secure';

import { db } from '../client';
import { habits, type Habit, type NewHabit } from '../schema';

export async function listHabits(opts: { includeArchived?: boolean } = {}): Promise<Habit[]> {
  const rows = db.select().from(habits).orderBy(habits.orderIndex).all();
  if (opts.includeArchived) return rows;
  return rows.filter((h) => h.archivedAt == null);
}

export async function listHabitsByRitual(ritualId: string): Promise<Habit[]> {
  return db
    .select()
    .from(habits)
    .where(eq(habits.ritualId, ritualId))
    .orderBy(habits.orderIndex)
    .all()
    .filter((h) => h.archivedAt == null);
}

export async function getHabit(id: string): Promise<Habit | null> {
  const rows = db.select().from(habits).where(eq(habits.id, id)).all();
  return rows[0] ?? null;
}

export async function createHabit(
  input: Omit<NewHabit, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Habit> {
  const now = Date.now();
  const row: NewHabit = {
    ...input,
    id: nanoid(12),
    createdAt: now,
    updatedAt: now,
  };
  db.insert(habits).values(row).run();
  return (await getHabit(row.id))!;
}

export async function updateHabit(
  id: string,
  patch: Partial<Omit<NewHabit, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<Habit> {
  db.update(habits)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(habits.id, id))
    .run();
  const updated = await getHabit(id);
  if (!updated) throw new Error(`Habit ${id} not found after update`);
  return updated;
}

export async function archiveHabit(id: string): Promise<Habit> {
  const now = Date.now();
  db.update(habits).set({ archivedAt: now, updatedAt: now }).where(eq(habits.id, id)).run();
  const updated = await getHabit(id);
  if (!updated) throw new Error(`Habit ${id} not found after archive`);
  return updated;
}

export async function unarchiveHabit(id: string): Promise<Habit> {
  db.update(habits)
    .set({ archivedAt: null, updatedAt: Date.now() })
    .where(eq(habits.id, id))
    .run();
  const updated = await getHabit(id);
  if (!updated) throw new Error(`Habit ${id} not found after unarchive`);
  return updated;
}

export async function deleteHabit(id: string): Promise<void> {
  db.delete(habits).where(eq(habits.id, id)).run();
}
