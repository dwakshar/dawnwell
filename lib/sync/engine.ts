// ─── Sync engine — public entry point ─────────────────────────────────────
//
// syncNow()     — check connectivity → push → pull → update store
// schedulePush() — 5-second debounced trigger, called by markPending()
//
// Push-before-pull is intentional: local edits must propagate to remote before
// the pull overwrites them. Without this ordering, an offline edit pushed after
// pull would be treated as a stale update by the next pull cycle.
//
// Concurrent syncNow() calls coalesce via a simple promise-mutex so only one
// sync cycle runs at a time.

import NetInfo from '@react-native-community/netinfo';
import { pushAll } from './push';
import { pullAll } from './pull';
import { acquireMutex } from './mutex';
import { useSyncStore } from '@/lib/stores/sync-store';
import { logger } from '@/lib/logger';
import { useAuthStore } from '@/stores/auth-store';
import type { SyncResult } from './types';

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let netInfoUnsubscribe: (() => void) | null = null;

// ─── syncNow ──────────────────────────────────────────────────────────────

export async function syncNow(): Promise<SyncResult> {
  // Only sync when authenticated
  const authStatus = useAuthStore.getState().status;
  if (authStatus !== 'authenticated') {
    return { pushed: 0, pulled: 0, conflicts: 0, durationMs: 0 };
  }

  // Connectivity check
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    useSyncStore.getState().setStatus('offline');
    return { pushed: 0, pulled: 0, conflicts: 0, durationMs: 0 };
  }

  // Mutex — coalesce concurrent calls
  const { waitFor, release } = acquireMutex();
  await waitFor;

  try {
    const start = Date.now();
    useSyncStore.getState().setStatus('syncing');

    // Push BEFORE pull: ensures local edits reach the server before the server's
    // state is pulled down and potentially merged against them.
    const { pushed } = await pushAll();
    const { pulled, conflicts } = await pullAll();

    const result: SyncResult = {
      pushed,
      pulled,
      conflicts,
      durationMs: Date.now() - start,
    };

    useSyncStore.getState().setResult(result);
    useSyncStore.getState().setStatus('idle');
    await useSyncStore.getState().refreshPendingCount();

    logger.info('[sync] complete', result);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    // Surface 401 (session expiry) with a user-friendly hint
    const friendlyMsg = msg.includes('401') || msg.toLowerCase().includes('jwt')
      ? 'Session expired — please sign in again.'
      : msg;

    logger.error('[sync] error', msg);
    useSyncStore.getState().setError(friendlyMsg);
    useSyncStore.getState().setStatus('error');

    // Sync is best-effort: never throw from here. App continues from local SQLite.
    return { pushed: 0, pulled: 0, conflicts: 0, durationMs: 0 };
  } finally {
    release();
  }
}

// ─── schedulePush ─────────────────────────────────────────────────────────

export function schedulePush(): void {
  if (pushTimer !== null) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void syncNow();
  }, 5_000);
}

// ─── Connectivity-aware auto-sync ─────────────────────────────────────────
// Called once at app boot from _layout.tsx.
// On transition offline → online, trigger syncNow after a 1s settle delay
// so the stack has time to fully reconnect before we hit the network.

export function initConnectivityWatcher(): void {
  if (netInfoUnsubscribe) return; // already watching

  netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      useSyncStore.getState().setStatus('idle');
      setTimeout(() => void syncNow(), 1_000);
    } else {
      useSyncStore.getState().setStatus('offline');
    }
  });
}

export function teardownConnectivityWatcher(): void {
  netInfoUnsubscribe?.();
  netInfoUnsubscribe = null;
}

// ─── getters ──────────────────────────────────────────────────────────────

export function getStatus() {
  return useSyncStore.getState().status;
}

export function getLastResult() {
  return useSyncStore.getState().lastResult;
}
