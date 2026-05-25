// Column mapping (P2 schema → form):
//   targetPerDay  ↔  target
//   archivedAt    ↔  archived (null = active; unix-ms timestamp = archived)
//   reminderTime  ↔  reminderEnabled + reminderTime (null when disabled)
//   orderIndex    — managed here, never exposed in the form

import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid/non-secure';

import { db } from '@/db/client';
import { habits, checkIns } from '@/db/schema';
import type { Habit } from '@/db/schema';
import { getHabit, listHabitsByRitual } from '@/db/repos/habits';
import type { HabitFormValues } from '@/lib/schemas/habit-form';
import { markPending } from '@/lib/sync/mark-pending';

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
      // New rows start at version 1, marked pending so they push on first sync
      version: 1,
      pendingSync: 1,
    })
    .run();

  // schedulePush fires via the deferred import in mark-pending, but for inserts
  // we call engine directly to trigger the debounced push without bumping version.
  void import('@/lib/sync/engine').then(({ schedulePush }) => schedulePush());

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

  markPending('habits', id);

  const updated = await getHabit(id);
  if (!updated) throw new Error(`Habit ${id} not found after update`);
  return updated;
}

export async function archiveHabit(id: string): Promise<void> {
  const now = Date.now();
  db.update(habits).set({ archivedAt: now, updatedAt: now }).where(eq(habits.id, id)).run();
  markPending('habits', id);
}

export async function unarchiveHabit(id: string): Promise<void> {
  db.update(habits)
    .set({ archivedAt: null, updatedAt: Date.now() })
    .where(eq(habits.id, id))
    .run();
  markPending('habits', id);
}

// Soft-deletes the habit and all its check_ins locally.
// The row stays in SQLite (pending_sync = 1) until pushed, after which it can be
// hard-deleted on the next sync or left in place (default: leave it).
export async function deleteHabitHard(id: string): Promise<void> {
  const now = Date.now();

  // Soft-delete all check_ins for this habit
  db.update(checkIns)
    .set({
      deletedAt: now,
      updatedAt: now,
      pendingSync: 1,
      version: sql`${checkIns.version} + 1`,
    })
    .where(eq(checkIns.habitId, id))
    .run();

  // Soft-delete the habit itself (mark pending; version bump happens in markPending)
  db.update(habits)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(habits.id, id))
    .run();

  markPending('habits', id);
}
