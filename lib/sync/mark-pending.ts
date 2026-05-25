// Marks a row as pending sync after a local mutation.
// Sets pending_sync = 1, bumps updated_at, increments version.
// Call after every UPDATE mutation (not INSERT — new rows start at version 1).
// Internally calls schedulePush() so the debounced push fires ~5s later.

import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { rituals, habits, checkIns } from '@/db/schema';
import type { SyncableTable } from './types';

function pendingPatch(now: number) {
  return {
    pendingSync: 1 as const,
    updatedAt: now,
    version: sql`version + 1`,
  };
}

export function markPending(table: 'rituals', id: string): void;
export function markPending(table: 'habits', id: string): void;
export function markPending(table: 'check_ins', id: string): void;
export function markPending(table: SyncableTable, id: string): void {
  const now = Date.now();
  if (table === 'rituals') {
    db.update(rituals).set(pendingPatch(now)).where(eq(rituals.id, id)).run();
  } else if (table === 'habits') {
    db.update(habits).set(pendingPatch(now)).where(eq(habits.id, id)).run();
  } else {
    db.update(checkIns).set(pendingPatch(now)).where(eq(checkIns.id, id)).run();
  }

  // Deferred import to avoid circular dep at module load time; engine is a
  // singleton so this is cheap after first call.
  void import('./engine').then(({ schedulePush }) => schedulePush());
}
