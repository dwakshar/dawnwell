-- P9b sync columns
-- Adds version, pending_sync, deleted_at to all three mutable tables.
-- check_ins gets created_at + updated_at as well (previously only had completed_at).
-- Backfill sets pending_sync = 1 on existing rows so they push to remote on first sync.

-- ── rituals ──────────────────────────────────────────────────────────────────
ALTER TABLE `rituals` ADD COLUMN `version` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `rituals` ADD COLUMN `pending_sync` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `rituals` ADD COLUMN `deleted_at` integer;
--> statement-breakpoint

-- ── habits ───────────────────────────────────────────────────────────────────
ALTER TABLE `habits` ADD COLUMN `version` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `habits` ADD COLUMN `pending_sync` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `habits` ADD COLUMN `deleted_at` integer;
--> statement-breakpoint

-- ── check_ins ────────────────────────────────────────────────────────────────
ALTER TABLE `check_ins` ADD COLUMN `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000);
--> statement-breakpoint
ALTER TABLE `check_ins` ADD COLUMN `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000);
--> statement-breakpoint
ALTER TABLE `check_ins` ADD COLUMN `version` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `check_ins` ADD COLUMN `pending_sync` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `check_ins` ADD COLUMN `deleted_at` integer;
--> statement-breakpoint

-- ── backfill: mark all existing rows as pending so they push on first sync ───
UPDATE `rituals`   SET `pending_sync` = 1;
--> statement-breakpoint
UPDATE `habits`    SET `pending_sync` = 1;
--> statement-breakpoint
UPDATE `check_ins` SET `pending_sync` = 1;
