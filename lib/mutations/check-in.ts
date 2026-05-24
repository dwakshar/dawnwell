import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid/non-secure';

import { db } from '@/db/client';
import { checkIns } from '@/db/schema';
import { getCheckIn } from '@/db/repos/check-ins';

// Increments the check-in count for a habit on a given date.
// Inserts a new row if none exists (unique constraint: one row per habit+date with a count field).
export async function addCheckIn(habitId: string, dateISO: string): Promise<void> {
  const existing = await getCheckIn(habitId, dateISO);
  if (!existing) {
    db.insert(checkIns)
      .values({ id: nanoid(12), habitId, date: dateISO, count: 1, completedAt: Date.now() })
      .run();
  } else {
    db.update(checkIns)
      .set({ count: existing.count + 1, completedAt: Date.now() })
      .where(eq(checkIns.id, existing.id))
      .run();
  }
}

// Decrements the check-in count for a habit on a given date.
// Deletes the row if count reaches zero.
export async function removeLastCheckIn(habitId: string, dateISO: string): Promise<void> {
  const existing = await getCheckIn(habitId, dateISO);
  if (!existing) return;
  if (existing.count <= 1) {
    db.delete(checkIns).where(eq(checkIns.id, existing.id)).run();
  } else {
    db.update(checkIns)
      .set({ count: existing.count - 1, completedAt: Date.now() })
      .where(eq(checkIns.id, existing.id))
      .run();
  }
}
