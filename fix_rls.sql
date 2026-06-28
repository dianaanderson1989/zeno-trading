-- ============================================================
-- FIX: RLS policies for admin access
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Fix deposits RLS — admin must be able to SELECT and UPDATE all deposits
DROP POLICY IF EXISTS "deposits_select_own" ON public.deposits;
DROP POLICY IF EXISTS "deposits_insert_own" ON public.deposits;
DROP POLICY IF EXISTS "deposits_update_admin" ON public.deposits;

CREATE POLICY "deposits_select" ON public.deposits
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "deposits_insert" ON public.deposits
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "deposits_update" ON public.deposits
  FOR UPDATE USING (public.is_admin());

-- 2. Fix withdrawals RLS
DROP POLICY IF EXISTS "withdrawals_select_own" ON public.withdrawals;
DROP POLICY IF EXISTS "withdrawals_insert_own" ON public.withdrawals;
DROP POLICY IF EXISTS "withdrawals_update_admin" ON public.withdrawals;

CREATE POLICY "withdrawals_select" ON public.withdrawals
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "withdrawals_insert" ON public.withdrawals
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "withdrawals_update" ON public.withdrawals
  FOR UPDATE USING (public.is_admin());

-- 3. Fix wallets RLS — admin must update wallets when approving deposits
DROP POLICY IF EXISTS "wallets_select_own" ON public.wallets;
DROP POLICY IF EXISTS "wallets_update_own" ON public.wallets;

CREATE POLICY "wallets_select" ON public.wallets
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "wallets_update" ON public.wallets
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());

-- 4. Fix transactions RLS — admin must insert transactions on approval
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;

CREATE POLICY "transactions_select" ON public.transactions
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "transactions_insert" ON public.transactions
  FOR INSERT WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- 5. Fix price_feeds RLS — allow authenticated users to UPDATE prices
-- (needed for the price updater running in the browser)
DROP POLICY IF EXISTS "price_feeds_public_read" ON public.price_feeds;

CREATE POLICY "price_feeds_read" ON public.price_feeds
  FOR SELECT USING (true);

CREATE POLICY "price_feeds_update" ON public.price_feeds
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "price_feeds_insert" ON public.price_feeds
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Verify is_admin() function is correct
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 7. Check current deposit statuses (run to verify)
SELECT status, count(*) FROM public.deposits GROUP BY status;
