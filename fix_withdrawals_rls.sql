-- Fix withdrawals RLS — same as deposits fix
DROP POLICY IF EXISTS "withdrawals_select_own" ON public.withdrawals;
DROP POLICY IF EXISTS "withdrawals_insert_own" ON public.withdrawals;
DROP POLICY IF EXISTS "withdrawals_update_admin" ON public.withdrawals;
DROP POLICY IF EXISTS "withdrawals_select" ON public.withdrawals;
DROP POLICY IF EXISTS "withdrawals_insert" ON public.withdrawals;
DROP POLICY IF EXISTS "withdrawals_update" ON public.withdrawals;

CREATE POLICY "withdrawals_select" ON public.withdrawals
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "withdrawals_insert" ON public.withdrawals
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "withdrawals_update" ON public.withdrawals
  FOR UPDATE USING (public.is_admin());

-- Verify
SELECT status, count(*) FROM public.withdrawals GROUP BY status;
