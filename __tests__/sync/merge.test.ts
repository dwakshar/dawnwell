// Unit tests for lib/sync/merge.ts — all six merge rules.
//
// TODO: No test framework is configured in this project (no Jest/Vitest in devDependencies).
//       To run these tests, add vitest: `npm install -D vitest` and add
//       `"test": "vitest"` to package.json scripts.
//
// To run:  npx vitest __tests__/sync/merge.test.ts
//
// These cover the six-rule merge algorithm (see docs/sync-architecture.md):
//   a. remote deleted   → remote wins
//   b. local deleted    → local wins
//   c. local newer      → local wins
//   d. same timestamp   → version tiebreaker (higher wins; remote on tie)
//   e. remote newer     → conflict logged, remote wins
//   f. local clean      → remote wins

import { describe, it, expect, vi } from 'vitest';
import { mergeRow } from '../../lib/sync/merge';
import type { Mergeable } from '../../lib/sync/types';

function row(overrides: Partial<Mergeable> = {}): Mergeable {
  return {
    deletedAt: null,
    pendingSync: 0,
    updatedAt: 1000,
    version: 1,
    ...overrides,
  };
}

describe('mergeRow', () => {
  it('rule a — remote deleted, local not → remote wins', () => {
    const local = row({ deletedAt: null, pendingSync: 1 });
    const remote = row({ deletedAt: 9999 });
    const counter = { count: 0 };
    const { resolution } = mergeRow(local, remote, counter);
    expect(resolution).toBe('remote-wins');
    expect(counter.count).toBe(0);
  });

  it('rule b — local deleted, remote not → local wins', () => {
    const local = row({ deletedAt: 5000, pendingSync: 1, updatedAt: 5000 });
    const remote = row({ deletedAt: null, updatedAt: 6000 });
    const counter = { count: 0 };
    const { resolution } = mergeRow(local, remote, counter);
    expect(resolution).toBe('local-wins');
    expect(counter.count).toBe(0);
  });

  it('rule c — local pending and newer → local wins', () => {
    const local = row({ pendingSync: 1, updatedAt: 2000, version: 2 });
    const remote = row({ updatedAt: 1000, version: 1 });
    const counter = { count: 0 };
    const { resolution } = mergeRow(local, remote, counter);
    expect(resolution).toBe('local-wins');
    expect(counter.count).toBe(0);
  });

  it('rule d — same timestamp, local higher version → local wins', () => {
    const local = row({ pendingSync: 1, updatedAt: 1000, version: 3 });
    const remote = row({ updatedAt: 1000, version: 2 });
    const counter = { count: 0 };
    const { resolution } = mergeRow(local, remote, counter);
    expect(resolution).toBe('local-wins');
  });

  it('rule d — same timestamp, same version → remote wins (deterministic)', () => {
    const local = row({ pendingSync: 1, updatedAt: 1000, version: 1 });
    const remote = row({ updatedAt: 1000, version: 1 });
    const counter = { count: 0 };
    const { resolution } = mergeRow(local, remote, counter);
    expect(resolution).toBe('remote-wins');
    expect(counter.count).toBe(0);
  });

  it('rule e — local pending but older → conflict logged, remote wins', () => {
    const local = row({ pendingSync: 1, updatedAt: 500, version: 1 });
    const remote = row({ updatedAt: 2000, version: 2 });
    const counter = { count: 0 };
    const { resolution } = mergeRow(local, remote, counter);
    expect(resolution).toBe('remote-wins');
    expect(counter.count).toBe(1);
  });

  it('rule f — local clean → remote wins without conflict', () => {
    const local = row({ pendingSync: 0, updatedAt: 1000, version: 1 });
    const remote = row({ updatedAt: 2000, version: 2 });
    const counter = { count: 0 };
    const { resolution } = mergeRow(local, remote, counter);
    expect(resolution).toBe('remote-wins');
    expect(counter.count).toBe(0);
  });
});
