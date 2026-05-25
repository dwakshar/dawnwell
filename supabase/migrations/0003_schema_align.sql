-- P9b schema alignment
-- Aligns the remote schema with local SQLite so the sync engine can upsert by ID
-- without format conversion.
--
-- Changes:
--   1. Drop updated_at auto-triggers — client controls updated_at for merge correctness
--   2. All id columns: UUID → TEXT  (accepts nanoid(12) from local)
--   3. All timestamps: TIMESTAMPTZ → BIGINT (unix milliseconds, matches local integers)
--   4. Add missing columns: slot on rituals, reminder_days/grace_days_per_week/
--      archived_at on habits, date on check_ins
--   5. Add version on rituals (habits + check_ins already had it)
--   6. Rename position → order_index on rituals and habits (matches local column name)
--   7. Rename slug → slot on rituals

-- ── 1. Drop auto-update triggers ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_rituals_updated_at   ON public.rituals;
DROP TRIGGER IF EXISTS trg_habits_updated_at    ON public.habits;
DROP TRIGGER IF EXISTS trg_check_ins_updated_at ON public.check_ins;

-- ── 2 & 3. rituals ───────────────────────────────────────────────────────────
-- Drop the inbound FK from habits so we can change rituals.id type
ALTER TABLE public.habits DROP CONSTRAINT IF EXISTS habits_ritual_id_fkey;

ALTER TABLE public.rituals ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE public.rituals
  ALTER COLUMN created_at TYPE BIGINT
  USING (EXTRACT(EPOCH FROM created_at) * 1000)::BIGINT;
ALTER TABLE public.rituals
  ALTER COLUMN updated_at TYPE BIGINT
  USING (EXTRACT(EPOCH FROM updated_at) * 1000)::BIGINT;
ALTER TABLE public.rituals
  ALTER COLUMN deleted_at TYPE BIGINT
  USING (EXTRACT(EPOCH FROM deleted_at) * 1000)::BIGINT;

-- Rename slug → slot (local uses the enum name, not a URL slug)
ALTER TABLE public.rituals RENAME COLUMN slug TO slot;
-- Rename position → order_index
ALTER TABLE public.rituals RENAME COLUMN position TO order_index;

-- Add version (matching habits/check_ins pattern)
ALTER TABLE public.rituals ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- ── 2 & 3. habits ────────────────────────────────────────────────────────────
-- Drop the inbound FK from check_ins so we can change habits.id type
ALTER TABLE public.check_ins DROP CONSTRAINT IF EXISTS check_ins_habit_id_fkey;

ALTER TABLE public.habits ALTER COLUMN id       TYPE TEXT USING id::TEXT;
ALTER TABLE public.habits ALTER COLUMN ritual_id TYPE TEXT USING ritual_id::TEXT;
ALTER TABLE public.habits
  ALTER COLUMN created_at TYPE BIGINT
  USING (EXTRACT(EPOCH FROM created_at) * 1000)::BIGINT;
ALTER TABLE public.habits
  ALTER COLUMN updated_at TYPE BIGINT
  USING (EXTRACT(EPOCH FROM updated_at) * 1000)::BIGINT;
ALTER TABLE public.habits
  ALTER COLUMN deleted_at TYPE BIGINT
  USING (EXTRACT(EPOCH FROM deleted_at) * 1000)::BIGINT;

-- Rename position → order_index
ALTER TABLE public.habits RENAME COLUMN position TO order_index;

-- Add local-only fields that were missing from the remote schema
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS reminder_days      TEXT    NOT NULL DEFAULT '1111111';
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS grace_days_per_week INTEGER NOT NULL DEFAULT 1;
-- archived_at is distinct from deleted_at: archived = hidden but kept; deleted = synced removal
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS archived_at        BIGINT;

-- Re-add FK now that both sides are TEXT
ALTER TABLE public.habits
  ADD CONSTRAINT habits_ritual_id_fkey
  FOREIGN KEY (ritual_id) REFERENCES public.rituals(id) ON DELETE CASCADE;

-- ── 2 & 3. check_ins ─────────────────────────────────────────────────────────
ALTER TABLE public.check_ins ALTER COLUMN id       TYPE TEXT USING id::TEXT;
ALTER TABLE public.check_ins ALTER COLUMN habit_id  TYPE TEXT USING habit_id::TEXT;
ALTER TABLE public.check_ins
  ALTER COLUMN completed_at TYPE BIGINT
  USING (EXTRACT(EPOCH FROM completed_at) * 1000)::BIGINT;
ALTER TABLE public.check_ins
  ALTER COLUMN created_at TYPE BIGINT
  USING (EXTRACT(EPOCH FROM created_at) * 1000)::BIGINT;
ALTER TABLE public.check_ins
  ALTER COLUMN updated_at TYPE BIGINT
  USING (EXTRACT(EPOCH FROM updated_at) * 1000)::BIGINT;
ALTER TABLE public.check_ins
  ALTER COLUMN deleted_at TYPE BIGINT
  USING (EXTRACT(EPOCH FROM deleted_at) * 1000)::BIGINT;

-- Add date column (YYYY-MM-DD string, primary semantic key for local check-ins)
ALTER TABLE public.check_ins ADD COLUMN IF NOT EXISTS date TEXT;

-- Re-add FK now that both sides are TEXT
ALTER TABLE public.check_ins
  ADD CONSTRAINT check_ins_habit_id_fkey
  FOREIGN KEY (habit_id) REFERENCES public.habits(id) ON DELETE CASCADE;

-- ── sync_meta ─────────────────────────────────────────────────────────────────
ALTER TABLE public.sync_meta
  ALTER COLUMN last_pulled_at TYPE BIGINT
  USING (EXTRACT(EPOCH FROM last_pulled_at) * 1000)::BIGINT;
ALTER TABLE public.sync_meta
  ALTER COLUMN last_pushed_at TYPE BIGINT
  USING (EXTRACT(EPOCH FROM last_pushed_at) * 1000)::BIGINT;
