import { create } from 'zustand';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { rituals, habits, checkIns } from '@/db/schema';
import type { SyncStatus, SyncResult } from '@/lib/sync/types';

type SyncStore = {
  status: SyncStatus;
  /** Mirrors remote sync_meta.last_pulled_at; updated after each successful pull. */
  lastSyncedAt: number | null;
  lastResult: SyncResult | null;
  error: string | null;
  /** Count of local rows with pending_sync = 1 across all tables. */
  pendingCount: number;
  // ── actions ──────────────────────────────────────────────────────────────
  setStatus: (s: SyncStatus) => void;
  setResult: (r: SyncResult) => void;
  setError: (e: string) => void;
  /** Re-counts pending rows from local DB; called after every sync cycle. */
  refreshPendingCount: () => Promise<void>;
};

export const useSyncStore = create<SyncStore>((set) => ({
  status: 'idle',
  lastSyncedAt: null,
  lastResult: null,
  error: null,
  pendingCount: 0,

  setStatus: (status) =>
    set({ status, ...(status !== 'error' ? { error: null } : {}) }),

  setResult: (lastResult) =>
    set({ lastResult, lastSyncedAt: Date.now() }),

  setError: (error) => set({ error }),

  refreshPendingCount: async () => {
    const ritualCount = db.select().from(rituals).where(eq(rituals.pendingSync, 1)).all().length;
    const habitCount = db.select().from(habits).where(eq(habits.pendingSync, 1)).all().length;
    const checkInCount = db.select().from(checkIns).where(eq(checkIns.pendingSync, 1)).all().length;
    set({ pendingCount: ritualCount + habitCount + checkInCount });
  },
}));
