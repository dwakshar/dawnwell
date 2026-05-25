-- P10: delete_user_account() RPC
--
-- Called from the client when a user requests account deletion.
-- SECURITY DEFINER bypasses RLS so the function can delete across all
-- app-schema tables for the authenticated user. The auth.uid() check
-- inside the function guards against unauthenticated calls — if someone
-- calls this without a valid JWT, auth.uid() returns null and the
-- explicit check raises an exception before any rows are deleted.
--
-- V1 LIMITATION: This function deletes all app-schema rows but does NOT
-- delete the auth.users row. Supabase does not allow client-side deletion
-- of auth.users via the anon key. The pending_deletion_at column on
-- profiles flags the row for server-side cleanup (manual or Edge Function).
-- auth.users deletion is planned for v1.1.
--
-- To apply: run in Supabase SQL editor (Database → SQL editor).

-- ─── Add pending_deletion_at to profiles ─────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pending_deletion_at TIMESTAMPTZ;

-- ─── RPC: delete_user_account ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _uid uuid;
BEGIN
  -- Assign in BEGIN so auth context is fully resolved under SECURITY DEFINER
  _uid := auth.uid();

  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete app-schema data in reverse FK order.
  -- user_id columns are still UUID (0003 only changed row-id columns to TEXT).
  DELETE FROM public.check_ins WHERE user_id = _uid;
  DELETE FROM public.habits    WHERE user_id = _uid;
  DELETE FROM public.rituals   WHERE user_id = _uid;
  DELETE FROM public.sync_meta WHERE user_id = _uid;

  -- Stamp profiles row for server-side auth.users cleanup.
  -- The profiles row itself is left so a cleanup job can find it via
  -- pending_deletion_at. auth.users CASCADE will remove it once the auth
  -- row is deleted in v1.1.
  UPDATE public.profiles
  SET pending_deletion_at = NOW()
  WHERE id = _uid;
END;
$$;

-- ─── Permissions ──────────────────────────────────────────────────────────────
-- By default PostgreSQL grants EXECUTE to PUBLIC, which includes the anon role.
-- REVOKE from PUBLIC first, then grant only to authenticated.
REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- ─── RLS verification notes ───────────────────────────────────────────────────
-- SECURITY DEFINER bypasses RLS by design. The _uid IS NULL check is the
-- auth guard. Verify the guard works:
--
--   SET LOCAL role TO anon;
--   SELECT public.delete_user_account();
--   -- Expected: permission denied (anon no longer has EXECUTE after the REVOKE above)
--
-- Also verify from an authenticated session that only the caller's rows are deleted:
--
--   SELECT count(*) FROM public.rituals  WHERE user_id = auth.uid();  -- should be 0 after call
--   SELECT count(*) FROM public.habits   WHERE user_id = auth.uid();  -- should be 0 after call
--   SELECT count(*) FROM public.check_ins WHERE user_id = auth.uid(); -- should be 0 after call
