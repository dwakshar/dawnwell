import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid/non-secure';

import { db } from '@/db/client';
import { checkIns } from '@/db/schema';
import { getCheckIn, getCheckInAny } from '@/db/repos/check-ins';
import { schedulePush } from '@/lib/sync/engine';

// Increments the check-in count for a habit on a given date.
// Handles three cases: new row, restore from soft-deleted state, increment existing.
export async function addCheckIn(habitId: string, dateISO: string): Promise<void> {
  // Look up any row, including soft-deleted (to avoid unique-constraint conflicts)
  const existing = await getCheckInAny(habitId, dateISO);
  const now = Date.now();

  if (!existing) {
    db.insert(checkIns)
      .values({
        id: nanoid(12),
        habitId,
        date: dateISO,
        count: 1,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
        version: 1,
        pendingSync: 1,
      })
      .run();
  } else if (existing.deletedAt !== null) {
    // Restore soft-deleted row (user checked in again on a previously un-checked day)
    db.update(checkIns)
      .set({
        deletedAt: null,
        count: 1,
        completedAt: now,
        updatedAt: now,
        pendingSync: 1,
        version: sql`${checkIns.version} + 1`,
      })
      .where(eq(checkIns.id, existing.id))
      .run();
  } else {
    db.update(checkIns)
      .set({
        count: existing.count + 1,
        completedAt: now,
        updatedAt: now,
        pendingSync: 1,
        version: sql`${checkIns.version} + 1`,
      })
      .where(eq(checkIns.id, existing.id))
      .run();
  }

  schedulePush();
}

// Decrements the check-in count for a habit on a given date.
// Soft-deletes the row when count reaches zero (instead of hard-deleting).
export async function removeLastCheckIn(habitId: string, dateISO: string): Promise<void> {
  const existing = await getCheckIn(habitId, dateISO);
  if (!existing) return;
  const now = Date.now();

  if (existing.count <= 1) {
    // Soft-delete: keep the row so it can be pushed to remote with deleted_at set
    db.update(checkIns)
      .set({
        deletedAt: now,
        updatedAt: now,
        pendingSync: 1,
        version: sql`${checkIns.version} + 1`,
      })
      .where(eq(checkIns.id, existing.id))
      .run();
  } else {
    db.update(checkIns)
      .set({
        count: existing.count - 1,
        completedAt: now,
        updatedAt: now,
        pendingSync: 1,
        version: sql`${checkIns.version} + 1`,
      })
      .where(eq(checkIns.id, existing.id))
      .run();
  }

  schedulePush();
}
