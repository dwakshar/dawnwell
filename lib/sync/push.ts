// ─── Push: local → remote ──────────────────────────────────────────────────
// Finds all rows with pending_sync = 1, strips local-only fields, converts
// camelCase → snake_case, upserts to Supabase, then clears pending_sync.
//
// Push order: rituals → habits → check_ins (FK dependency order).

import type { SupabaseClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { rituals, habits, checkIns } from '@/db/schema';
import type { Ritual, Habit, CheckIn } from '@/db/schema';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { useAuthStore } from '@/stores/auth-store';
import type { RemoteRitual, RemoteHabit, RemoteCheckIn, PushError } from './types';

// Cast away Database generic — the remote schema changed in 0003 and the
// generated types are stale. Raw SupabaseClient is safe here.
const sb = supabase as unknown as SupabaseClient;

// ─── Field mappers ─────────────────────────────────────────────────────────

function toRemoteRitual(local: Ritual, userId: string): RemoteRitual {
  return {
    id: local.id,
    user_id: userId,
    name: local.name,
    slot: local.slot,
    order_index: local.orderIndex,
    created_at: local.createdAt,
    updated_at: local.updatedAt,
    deleted_at: local.deletedAt ?? null,
    version: local.version,
  };
}

function toRemoteHabit(local: Habit, userId: string): RemoteHabit {
  // reminderNotificationId is SYNC-EXCLUDE — absent from RemoteHabit by type design
  return {
    id: local.id,
    user_id: userId,
    ritual_id: local.ritualId,
    name: local.name,
    icon: local.icon,
    color: local.color,
    target_per_day: local.targetPerDay,
    reminder_time: local.reminderTime ?? null,
    reminder_days: local.reminderDays,
    grace_days_per_week: local.graceDaysPerWeek,
    archived_at: local.archivedAt ?? null,
    order_index: local.orderIndex,
    created_at: local.createdAt,
    updated_at: local.updatedAt,
    deleted_at: local.deletedAt ?? null,
    version: local.version,
  };
}

function toRemoteCheckIn(local: CheckIn, userId: string): RemoteCheckIn {
  return {
    id: local.id,
    user_id: userId,
    habit_id: local.habitId,
    date: local.date,
    count: local.count,
    completed_at: local.completedAt,
    created_at: local.createdAt,
    updated_at: local.updatedAt,
    deleted_at: local.deletedAt ?? null,
    version: local.version,
  };
}

// ─── Push implementation ───────────────────────────────────────────────────

export async function pushAll(): Promise<{ pushed: number; errors: PushError[] }> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return { pushed: 0, errors: [] };

  let pushed = 0;
  const errors: PushError[] = [];

  // ── rituals ──────────────────────────────────────────────────────────────
  const pendingRituals = db.select().from(rituals).where(eq(rituals.pendingSync, 1)).all();

  if (pendingRituals.length > 0) {
    const payload = pendingRituals.map((r) => toRemoteRitual(r, userId));
    const { error } = await sb.from('rituals').upsert(payload, { onConflict: 'id' });

    if (error) {
      logger.error('[sync:push] rituals upsert failed', error.message);
      errors.push(
        ...pendingRituals.map((r) => ({
          table: 'rituals' as const,
          id: r.id,
          message: error.message,
        })),
      );
    } else {
      for (const r of pendingRituals) {
        db.update(rituals).set({ pendingSync: 0 }).where(eq(rituals.id, r.id)).run();
        pushed++;
      }
    }
  }

  // ── habits ───────────────────────────────────────────────────────────────
  const pendingHabits = db.select().from(habits).where(eq(habits.pendingSync, 1)).all();

  if (pendingHabits.length > 0) {
    const payload = pendingHabits.map((h) => toRemoteHabit(h, userId));
    const { error } = await sb.from('habits').upsert(payload, { onConflict: 'id' });

    if (error) {
      logger.error('[sync:push] habits upsert failed', error.message);
      errors.push(
        ...pendingHabits.map((h) => ({
          table: 'habits' as const,
          id: h.id,
          message: error.message,
        })),
      );
    } else {
      for (const h of pendingHabits) {
        db.update(habits).set({ pendingSync: 0 }).where(eq(habits.id, h.id)).run();
        pushed++;
      }
    }
  }

  // ── check_ins ────────────────────────────────────────────────────────────
  const pendingCheckIns = db.select().from(checkIns).where(eq(checkIns.pendingSync, 1)).all();

  if (pendingCheckIns.length > 0) {
    const payload = pendingCheckIns.map((c) => toRemoteCheckIn(c, userId));
    const { error } = await sb.from('check_ins').upsert(payload, { onConflict: 'id' });

    if (error) {
      logger.error('[sync:push] check_ins upsert failed', error.message);
      errors.push(
        ...pendingCheckIns.map((c) => ({
          table: 'check_ins' as const,
          id: c.id,
          message: error.message,
        })),
      );
    } else {
      for (const c of pendingCheckIns) {
        db.update(checkIns).set({ pendingSync: 0 }).where(eq(checkIns.id, c.id)).run();
        pushed++;
      }
    }
  }

  // ── update sync_meta ──────────────────────────────────────────────────────
  if (pushed > 0) {
    await sb
      .from('sync_meta')
      .upsert({ user_id: userId, last_pushed_at: Date.now() }, { onConflict: 'user_id' });
  }

  return { pushed, errors };
}
