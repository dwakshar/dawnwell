// Column mapping (P2 schema → form):
//   targetPerDay  ↔  target
//   archivedAt    ↔  archived (null = active; unix-ms timestamp = archived)
//   reminderTime  ↔  reminderEnabled + reminderTime (null when disabled)
//   orderIndex    — managed here, never exposed in the form

import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid/non-secure';

import { db } from '@/db/client';
import { habits, checkIns } from '@/db/schema';
import type { Habit } from '@/db/schema';
import { getHabit, listHabitsByRitual } from '@/db/repos/habits';
import type { HabitFormValues } from '@/lib/schemas/habit-form';

export async function createHabit(input: HabitFormValues): Promise<Habit> {
  const now = Date.now();
  const existing = await listHabitsByRitual(input.ritualId);
  const orderIndex = existing.length;
  const id = nanoid(12);

  await db.insert(habits)
    .values({
      id,
      ritualId: input.ritualId,
      name: input.name.trim(),
      icon: input.icon,
      color: input.color,
      targetPerDay: input.target,
      reminderTime: input.reminderEnabled ? input.reminderTime : null,
      reminderDays: '1111111',
      graceDaysPerWeek: 1,
      archivedAt: null,
      orderIndex,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return (await getHabit(id))!;
}

export async function updateHabit(id: string, input: HabitFormValues): Promise<Habit> {
  db.update(habits)
    .set({
      ritualId: input.ritualId,
      name: input.name.trim(),
      icon: input.icon,
      color: input.color,
      targetPerDay: input.target,
      reminderTime: input.reminderEnabled ? input.reminderTime : null,
      updatedAt: Date.now(),
    })
    .where(eq(habits.id, id))
    .run();

  const updated = await getHabit(id);
  if (!updated) throw new Error(`Habit ${id} not found after update`);
  return updated;
}

export async function archiveHabit(id: string): Promise<void> {
  const now = Date.now();
  db.update(habits).set({ archivedAt: now, updatedAt: now }).where(eq(habits.id, id)).run();
}

export async function unarchiveHabit(id: string): Promise<void> {
  db.update(habits)
    .set({ archivedAt: null, updatedAt: Date.now() })
    .where(eq(habits.id, id))
    .run();
}

// Deletes the habit row; check_ins cascade-delete via the FK onDelete:'cascade'
// set in the schema. Only used after explicit user confirmation in the edit sheet.
export async function deleteHabitHard(id: string): Promise<void> {
  db.delete(checkIns).where(eq(checkIns.habitId, id)).run();
  db.delete(habits).where(eq(habits.id, id)).run();
}
