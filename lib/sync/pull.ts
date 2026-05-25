// ─── Pull: remote → local ──────────────────────────────────────────────────
// Reads sync_meta.last_pulled_at from Supabase (server-authoritative).
// Fetches all rows updated since that timestamp.
// For each remote row: insert if new, else hand to merge.ts.
// Uses server-observed updated_at values (not Date.now()) to set last_pulled_at,
// which avoids clock-skew gaps between devices.
//
// Pull order: rituals → habits → check_ins (FK dependency order).

import type { SupabaseClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { rituals, habits, checkIns } from '@/db/schema';
import type { Ritual, Habit, CheckIn, RitualSlot } from '@/db/schema';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { useAuthStore } from '@/stores/auth-store';
import { mergeRow } from './merge';
import type { RemoteRitual, RemoteHabit, RemoteCheckIn } from './types';

const sb = supabase as unknown as SupabaseClient;

// ─── Field mappers: remote → local ────────────────────────────────────────

function fromRemoteRitual(r: RemoteRitual): Ritual & { pendingSync: 0 } {
  return {
    id: r.id,
    name: r.name,
    slot: r.slot as RitualSlot,
    orderIndex: r.order_index,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at ?? null,
    version: r.version,
    pendingSync: 0,
  };
}

function fromRemoteHabit(h: RemoteHabit): Omit<Habit, 'reminderNotificationId'> & { pendingSync: 0 } {
  return {
    id: h.id,
    ritualId: h.ritual_id,
    name: h.name,
    icon: h.icon,
    color: h.color,
    targetPerDay: h.target_per_day,
    reminderTime: h.reminder_time ?? null,
    reminderDays: h.reminder_days,
    graceDaysPerWeek: h.grace_days_per_week,
    archivedAt: h.archived_at ?? null,
    orderIndex: h.order_index,
    createdAt: h.created_at,
    updatedAt: h.updated_at,
    deletedAt: h.deleted_at ?? null,
    version: h.version,
    pendingSync: 0,
  };
}

function fromRemoteCheckIn(c: RemoteCheckIn): CheckIn & { pendingSync: 0 } {
  return {
    id: c.id,
    habitId: c.habit_id,
    date: c.date,
    count: c.count,
    completedAt: c.completed_at,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    deletedAt: c.deleted_at ?? null,
    version: c.version,
    pendingSync: 0,
  };
}

// ─── Pull implementation ───────────────────────────────────────────────────

export async function pullAll(): Promise<{ pulled: number; conflicts: number }> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return { pulled: 0, conflicts: 0 };

  // Read last_pulled_at from the remote sync_meta — single source of truth
  const { data: metaRows } = await sb
    .from('sync_meta')
    .select('last_pulled_at')
    .eq('user_id', userId)
    .limit(1);

  const lastPulledAt: number = (metaRows as Array<{ last_pulled_at: number | null }>)?.[0]?.last_pulled_at ?? 0;

  let pulled = 0;
  let maxUpdatedAt = lastPulledAt;
  const conflictCounter = { count: 0 };

  // ── rituals ──────────────────────────────────────────────────────────────
  const { data: remoteRituals, error: ritualsError } = await sb
    .from('rituals')
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', lastPulledAt);

  if (ritualsError) {
    logger.error('[sync:pull] rituals fetch failed', ritualsError.message);
  } else {
    for (const raw of (remoteRituals as RemoteRitual[] ?? [])) {
      maxUpdatedAt = Math.max(maxUpdatedAt, raw.updated_at);
      const local = db.select().from(rituals).where(eq(rituals.id, raw.id)).all()[0];

      if (!local) {
        const mapped = fromRemoteRitual(raw);
        db.insert(rituals).values(mapped).run();
        pulled++;
      } else {
        const { winner, resolution } = mergeRow(local, {
          ...fromRemoteRitual(raw),
          pendingSync: local.pendingSync,
        }, conflictCounter);

        if (resolution !== 'local-wins') {
          const { pendingSync: _ps, ...patch } = winner as typeof winner & { pendingSync: number };
          db.update(rituals)
            .set({ ...patch, pendingSync: 0 })
            .where(eq(rituals.id, raw.id))
            .run();
          pulled++;
        }
      }
    }
  }

  // ── habits ───────────────────────────────────────────────────────────────
  const { data: remoteHabits, error: habitsError } = await sb
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', lastPulledAt);

  if (habitsError) {
    logger.error('[sync:pull] habits fetch failed', habitsError.message);
  } else {
    for (const raw of (remoteHabits as RemoteHabit[] ?? [])) {
      maxUpdatedAt = Math.max(maxUpdatedAt, raw.updated_at);
      const local = db.select().from(habits).where(eq(habits.id, raw.id)).all()[0];

      if (!local) {
        const mapped = fromRemoteHabit(raw);
        // reminderNotificationId stays null on new-from-remote habits (device-local field)
        db.insert(habits).values({ ...mapped, reminderNotificationId: null }).run();
        pulled++;
      } else {
        const remoteAsLocal = {
          ...fromRemoteHabit(raw),
          pendingSync: local.pendingSync,
          reminderNotificationId: local.reminderNotificationId,
        };
        const { winner, resolution } = mergeRow(local, remoteAsLocal, conflictCounter);

        if (resolution !== 'local-wins') {
          const { reminderNotificationId: _rni, pendingSync: _ps, ...patch } = winner as typeof winner & {
            reminderNotificationId: string | null;
            pendingSync: number;
          };
          db.update(habits)
            .set({ ...patch, pendingSync: 0 })
            .where(eq(habits.id, raw.id))
            .run();
          pulled++;
        }
      }
    }
  }

  // ── check_ins ────────────────────────────────────────────────────────────
  const { data: remoteCheckIns, error: checkInsError } = await sb
    .from('check_ins')
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', lastPulledAt);

  if (checkInsError) {
    logger.error('[sync:pull] check_ins fetch failed', checkInsError.message);
  } else {
    for (const raw of (remoteCheckIns as RemoteCheckIn[] ?? [])) {
      maxUpdatedAt = Math.max(maxUpdatedAt, raw.updated_at);
      // Include all local rows (even soft-deleted) for merge comparison
      const local = db.select().from(checkIns).where(eq(checkIns.id, raw.id)).all()[0];

      if (!local) {
        const mapped = fromRemoteCheckIn(raw);
        db.insert(checkIns).values(mapped).run();
        pulled++;
      } else {
        const remoteAsLocal = { ...fromRemoteCheckIn(raw), pendingSync: local.pendingSync };
        const { winner, resolution } = mergeRow(local, remoteAsLocal, conflictCounter);

        if (resolution !== 'local-wins') {
          const { pendingSync: _ps, ...patch } = winner as typeof winner & { pendingSync: number };
          db.update(checkIns)
            .set({ ...patch, pendingSync: 0 })
            .where(eq(checkIns.id, raw.id))
            .run();
          pulled++;
        }
      }
    }
  }

  // ── update sync_meta.last_pulled_at ──────────────────────────────────────
  // Use the max updated_at from server rows (not Date.now()) to avoid clock-skew gaps
  if (maxUpdatedAt > lastPulledAt) {
    await sb
      .from('sync_meta')
      .upsert(
        { user_id: userId, last_pulled_at: maxUpdatedAt },
        { onConflict: 'user_id' },
      );
  }

  return { pulled, conflicts: conflictCounter.count };
}
