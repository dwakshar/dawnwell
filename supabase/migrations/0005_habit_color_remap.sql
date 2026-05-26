-- One-time remap from P11.5 warm palette to P11.7 cool palette.
-- Safe to run multiple times (idempotent via CASE WHEN matching on old hex values only).
UPDATE habits
SET
  color = CASE color
    WHEN '#c2410c' THEN '#0066ff'
    WHEN '#9a3412' THEN '#0066ff'
    WHEN '#d97706' THEN '#06b6d4'
    WHEN '#f59e0b' THEN '#06b6d4'
    WHEN '#65735a' THEN '#10b981'
    WHEN '#84a07a' THEN '#10b981'
    WHEN '#5b8fb9' THEN '#0284c7'
    WHEN '#c084a0' THEN '#7c3aed'
    WHEN '#7c5e8c' THEN '#4f46e5'
    WHEN '#a855f7' THEN '#4f46e5'
    WHEN '#5a8a80' THEN '#0d9488'
    WHEN '#a89070' THEN '#475569'
    WHEN '#78716c' THEN '#475569'
    WHEN '#44403c' THEN '#475569'
  END,
  pending_sync = 1,
  version = version + 1,
  updated_at = EXTRACT(EPOCH FROM now())::bigint * 1000
WHERE color IN (
  '#c2410c', '#9a3412',
  '#d97706', '#f59e0b',
  '#65735a', '#84a07a',
  '#5b8fb9', '#c084a0',
  '#7c5e8c', '#a855f7',
  '#5a8a80', '#a89070',
  '#78716c', '#44403c'
);
