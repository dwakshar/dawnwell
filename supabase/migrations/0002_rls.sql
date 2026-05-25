-- P9a RLS policies
-- All policies: user can only read/write their own rows.
-- FOR ALL with USING + WITH CHECK covers SELECT, INSERT, UPDATE, DELETE in one policy.
-- profiles uses id = auth.uid() (PK is user id); all others use user_id = auth.uid().

ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rituals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_meta  ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles: own rows only"
  ON public.profiles
  FOR ALL
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- rituals
CREATE POLICY "rituals: own rows only"
  ON public.rituals
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- habits
CREATE POLICY "habits: own rows only"
  ON public.habits
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- check_ins
CREATE POLICY "check_ins: own rows only"
  ON public.check_ins
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- sync_meta
CREATE POLICY "sync_meta: own rows only"
  ON public.sync_meta
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── Cross-user read test (run as User A, should return 0 rows of User B) ──
-- SET LOCAL role TO authenticated;
-- SET LOCAL request.jwt.claim.sub TO '<user_a_uuid>';
-- SELECT count(*) FROM public.rituals WHERE user_id = '<user_b_uuid>';
-- → Expected: 0
