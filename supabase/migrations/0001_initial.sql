-- P9a initial remote schema
-- Mirror of local drizzle schema, excluding SYNC-EXCLUDE fields (reminder_notification_id).
-- Soft-delete pattern: deleted_at nullable timestamp on all mutable tables.
-- version column on habits + check_ins is the vector-clock-lite counter for P9b sync.

-- ─── updated_at trigger ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ─── profiles ──────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  display_name TEXT,
  timezone    TEXT NOT NULL DEFAULT 'UTC'
);

-- ─── rituals ───────────────────────────────────────────────────────────────
CREATE TABLE public.rituals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE TRIGGER trg_rituals_updated_at
  BEFORE UPDATE ON public.rituals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_rituals_user_id         ON public.rituals (user_id);
CREATE INDEX idx_rituals_user_updated_at ON public.rituals (user_id, updated_at);

-- ─── habits ────────────────────────────────────────────────────────────────
-- NOTE: NO reminder_notification_id column — that field is SYNC-EXCLUDE (device-local).
CREATE TABLE public.habits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ritual_id      UUID NOT NULL REFERENCES public.rituals(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  icon           TEXT NOT NULL,
  color          TEXT NOT NULL,
  target_per_day INTEGER NOT NULL DEFAULT 1,
  reminder_time  TEXT,
  position       INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ,
  version        INTEGER NOT NULL DEFAULT 1
);

CREATE TRIGGER trg_habits_updated_at
  BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_habits_user_id         ON public.habits (user_id);
CREATE INDEX idx_habits_user_updated_at ON public.habits (user_id, updated_at);

-- ─── check_ins ─────────────────────────────────────────────────────────────
CREATE TABLE public.check_ins (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id     UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL,
  count        INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  version      INTEGER NOT NULL DEFAULT 1
);

CREATE TRIGGER trg_check_ins_updated_at
  BEFORE UPDATE ON public.check_ins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_check_ins_user_id         ON public.check_ins (user_id);
CREATE INDEX idx_check_ins_user_updated_at ON public.check_ins (user_id, updated_at);

-- ─── sync_meta ─────────────────────────────────────────────────────────────
-- One row per user. P9b writes last_pulled_at / last_pushed_at here.
CREATE TABLE public.sync_meta (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_pulled_at TIMESTAMPTZ,
  last_pushed_at TIMESTAMPTZ
);
