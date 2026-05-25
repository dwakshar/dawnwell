import type { Habit, Ritual, CheckIn } from '@/db/schema';

// ─── Table identifiers ─────────────────────────────────────────────────────

export type SyncableTable = 'rituals' | 'habits' | 'check_ins';

// ─── Status & result ──────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export type SyncResult = {
  pushed: number;
  pulled: number;
  conflicts: number;
  durationMs: number;
};

export type ConflictResolution = 'local-wins' | 'remote-wins' | 'merged';

export type PushError = {
  table: SyncableTable;
  id: string;
  message: string;
};

// ─── Remote row shapes (after 0003_schema_align migration) ────────────────
// These mirror the local schema in snake_case. pending_sync is LOCAL-ONLY and
// never appears in remote rows.

export type RemoteRitual = {
  id: string;
  user_id: string;
  name: string;
  slot: string;
  order_index: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version: number;
};

export type RemoteHabit = {
  id: string;
  user_id: string;
  ritual_id: string;
  name: string;
  icon: string;
  color: string;
  target_per_day: number;
  reminder_time: string | null;
  reminder_days: string;
  grace_days_per_week: number;
  archived_at: number | null;
  order_index: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version: number;
  // reminder_notification_id is SYNC-EXCLUDE — absent from this type by design
};

export type RemoteCheckIn = {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
  count: number;
  completed_at: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version: number;
};

// ─── Push payload helpers ─────────────────────────────────────────────────
// Omit local-only fields before sending to Supabase.

export type PushPayload<T> = T extends Habit
  ? RemoteHabit
  : T extends Ritual
  ? RemoteRitual
  : T extends CheckIn
  ? RemoteCheckIn
  : never;

// ─── Mergeable constraint (shared sync fields on every syncable row) ───────

export type Mergeable = {
  deletedAt: number | null;
  pendingSync: number;
  updatedAt: number;
  version: number;
};
