// ─── Conflict resolution (vector-clock-lite) ───────────────────────────────
//
// Priority order — evaluated top-to-bottom, first match wins:
//
//   a. remote.deletedAt set, local not  → remote wins (deletion from other device)
//   b. local.deletedAt set, remote not  → local wins  (pending delete hasn't pushed yet)
//   c. local pending + local newer      → local wins  (unsent local edit supersedes remote)
//   d. local pending + same timestamp   → version tiebreaker; remote wins on tie
//   e. local pending + local older      → CONFLICT — remote wins by LWW; logged for audit
//   f. local clean (pendingSync = 0)    → remote wins (no divergence, accept new remote state)
//
// The conflict counter in (e) feeds SyncResult.conflicts — the "N conflicts, zero
// data loss" case-study metric.

import { logger } from '@/lib/logger';
import type { ConflictResolution, Mergeable } from './types';

export type MergeResult<T> = {
  winner: T;
  resolution: ConflictResolution;
};

export function mergeRow<T extends Mergeable>(
  local: T,
  remote: T,
  conflictCounter: { count: number },
): MergeResult<T> {
  // a — remote deleted, local not
  if (remote.deletedAt !== null && local.deletedAt === null) {
    return { winner: remote, resolution: 'remote-wins' };
  }

  // b — local deleted, remote not (pending delete)
  if (local.deletedAt !== null && remote.deletedAt === null) {
    return { winner: local, resolution: 'local-wins' };
  }

  // Only evaluate c–e when local has unpushed edits
  if (local.pendingSync === 1) {
    // c — local is newer: local edit supersedes remote
    if (local.updatedAt > remote.updatedAt) {
      return { winner: local, resolution: 'local-wins' };
    }

    // d — same-millisecond timestamp: break tie by version; remote wins on tie
    if (local.updatedAt === remote.updatedAt) {
      if (local.version > remote.version) {
        return { winner: local, resolution: 'local-wins' };
      }
      return { winner: remote, resolution: 'remote-wins' };
    }

    // e — remote is newer: genuine conflict — remote wins by last-write-wins
    conflictCounter.count += 1;
    logger.warn('[sync:merge] conflict — remote wins by LWW', {
      localUpdatedAt: local.updatedAt,
      remoteUpdatedAt: remote.updatedAt,
      localVersion: local.version,
      remoteVersion: remote.version,
    });
    return { winner: remote, resolution: 'remote-wins' };
  }

  // f — no local pending: remote is authoritative
  return { winner: remote, resolution: 'remote-wins' };
}
