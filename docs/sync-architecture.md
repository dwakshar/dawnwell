# Sync Architecture — Dawnwell P9b

> **Case-study quote:** "The engine resolved N conflicts across M sync cycles with zero data loss — every write, even those made offline during a full flight, was eventually consistent."

---

## Why local-first?

Dawnwell's core promise is a frictionless check-in, even at 6 AM in airplane mode. The app must work without a network connection — creating habits, logging completions, editing details — and sync whenever it can. This is the offline-first guarantee.

A traditional "fetch on load" design would make the whole app broken without wifi. SQLite as the source of truth gives us:
- Sub-millisecond reads (no spinner)
- Full functionality offline
- A single, well-typed data model

---

## Why SQLite over AsyncStorage?

AsyncStorage is a flat key-value blob. Dawnwell's data is relational: rituals have habits have check-ins. We need:
- JOIN queries (today view: habits × rituals × check-ins in one pass)
- Range queries (history: `date BETWEEN start AND end`)
- Transactional writes (increment count or insert, atomically)
- Schema migrations (ALTER TABLE, FK cascades)

SQLite gives all of this. AsyncStorage gives none of it.

---

## Why Drizzle over raw SQL?

Drizzle generates TypeScript types from the schema definition. When a column is renamed or a table is dropped, the compiler errors before runtime. This matters for a solo/small-team project where "run all the queries mentally" isn't feasible. Migrations are also versioned and applied via `useMigrations` at boot, giving a reliable schema lifecycle.

---

## Why last-write-wins + version tiebreaker, not full CRDT?

Dawnwell is a single-user, multi-device app — not a collaborative document editor. CRDTs (like automerge or y.js) add significant complexity: operation logs, tombstone management, vector clocks per field. For Dawnwell:

- The realistic conflict scenario is: edit habit on phone (offline), edit same habit on iPad (online), reconnect.
- Both devices have the full edit; one is simply more recent.
- LWW by `updated_at` with `version` as a millisecond-tie-breaker handles this correctly.
- The conflict counter tracks cases where a local edit was overwritten — surfaced in the sync result, zero data is ever silently dropped.

---

## Merge algorithm (the talking point)

Six rules, evaluated top-to-bottom:

| Rule | Condition | Winner | Reasoning |
|------|-----------|--------|-----------|
| a | `remote.deleted_at` set, local not | Remote | Deletion from another device must propagate |
| b | `local.deleted_at` set, remote not | Local | Pending delete hasn't pushed yet — honor it |
| c | Local pending + `local.updated_at` > remote | Local | Unsent edit is newer |
| d | Local pending + timestamps equal | Higher version; remote on tie | Deterministic tiebreaker, avoids ping-pong |
| e | Local pending + `local.updated_at` < remote | Remote | **Genuine conflict** — LWW, logged for audit |
| f | `local.pending_sync = 0` | Remote | No local divergence, accept remote state |

Rule (e) is the only true conflict. It increments a counter visible in `SyncResult.conflicts`. In testing, deliberately setting a device clock back and editing the same habit on both devices produced this case — the conflict was logged, the newer remote edit won, and the local device received the remote state on next pull.

---

## Push before pull — why?

If we pulled first and then pushed:
1. Remote state lands in local DB.
2. Local pending edit (from before pull) is now on top of a merged row.
3. Push sends the now-merged row — which was already shaped by the remote state.

This creates an accidental merge rather than a true LWW. Pushing first ensures the local edit reaches the server *before* the server's state is used to update local. If the push succeeds, the local row is no longer pending when pull runs, so merge rule (f) applies (remote wins cleanly). If the push fails, pending_sync remains 1 and merge rule (c) still correctly preferrs the local edit.

---

## SYNC-EXCLUDE pattern

`reminder_notification_id` on habits is scheduled by iOS/Android Notification APIs and is device-specific. Notification IDs from Device A are meaningless on Device B. Syncing them would:
- Cause Device B to silently cancel its own scheduled reminders
- Create orphaned notifications on Device A after a remote overwrite

The type system enforces this: `RemoteHabit` is defined with `Omit<Habit, 'reminderNotificationId' | 'pendingSync'>`. TypeScript will error if anyone tries to include it in a push payload.

---

## Soft deletes

Hard deletes can't be synced — the row is gone, and there's nothing to push. Instead:
- `deleted_at: number | null` on all tables (unix ms, NULL = active)
- Delete mutations set `deleted_at = now, pending_sync = 1`
- Push sends the tombstone row to remote
- Pull on other devices receives the tombstone; merge rule (a) applies; the row gets `deleted_at` set locally
- UI queries filter `WHERE deleted_at IS NULL`

Local tombstones are kept indefinitely (not hard-deleted after push). This allows offline devices that were away for a long time to still receive the deletion on reconnect.

---

## Deferred: realtime subscriptions

Supabase Realtime (Postgres LISTEN/NOTIFY via websocket) would enable sub-second multi-device sync. It was deliberately deferred for v1.1 because:
- It adds connection lifecycle management (reconnect on app foreground, backoff)
- It requires careful multiplexing with the existing pull loop
- Pull-on-foreground covers the primary use case (sync after switching devices)

When added, it should coexist with pull (duplicate rows handled by merge) rather than replace it.

---

## Known future work

- Android notification channel split (single `habit-reminders` channel may be lossy if per-habit channels are added later — see `lib/notifications/`)
- Realtime subscription (v1.1)
- Conflict UI: surface rule-(e) conflicts to the user with a "keep mine / keep theirs" prompt for high-value fields like habit name
