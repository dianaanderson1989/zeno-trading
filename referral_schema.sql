-- ============================================================
-- ZENO REFERRAL SYSTEM - Run in Supabase SQL Editor
-- ============================================================

-- Referral codes table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  reward_amount DECIMAL(20,8) DEFAULT 0,
  reward_asset_id UUID REFERENCES public.assets(id),
  reward_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Index
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_id);

-- RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals_select_own" ON public.referrals FOR SELECT USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR public.is_admin());
CREATE POLICY "referrals_insert_own" ON public.referrals FOR INSERT WITH CHECK (referrer_id = auth.uid());
CREATE POLICY "referrals_update_admin" ON public.referrals FOR UPDATE USING (public.is_admin() OR referrer_id = auth.uid());

-- Add referral_code column to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.users(id);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_referral_earnings DECIMAL(20,8) DEFAULT 0;

-- Auto-generate referral code on user creation
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Generate a unique 8-char alphanumeric code
  LOOP
    v_code := upper(substring(encode(gen_random_bytes(6), 'base64') FROM 1 FOR 8));
    v_code := replace(replace(replace(v_code, '+', 'A'), '/', 'B'), '=', 'C');
    SELECT EXISTS(SELECT 1 FROM public.users WHERE referral_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  NEW.referral_code := v_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON public.users
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION public.generate_referral_code();

-- Backfill referral codes for existing users
UPDATE public.users SET referral_code = NULL WHERE referral_code IS NULL;

-- Function: claim referral reward after first trade
CREATE OR REPLACE FUNCTION public.process_referral_reward(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_referral RECORD;
  v_usdt_id UUID;
  v_reward DECIMAL := 10; -- $10 USDT reward per referral
BEGIN
  -- Find a pending referral for this user
  SELECT r.* INTO v_referral
  FROM public.referrals r
  WHERE r.referred_id = p_user_id
    AND r.status = 'pending'
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  -- Check this user has made at least one trade
  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE user_id = p_user_id AND status = 'filled'
    LIMIT 1
  ) THEN RETURN; END IF;

  SELECT id INTO v_usdt_id FROM public.assets WHERE symbol = 'USDT' LIMIT 1;

  -- Pay referrer
  UPDATE public.wallets
  SET balance = balance + v_reward
  WHERE user_id = v_referral.referrer_id AND asset_id = v_usdt_id;

  -- Record transaction for referrer
  INSERT INTO public.transactions (user_id, transaction_type, asset_id, amount, description, status)
  VALUES (v_referral.referrer_id, 'admin_adjustment', v_usdt_id, v_reward, 'Referral reward for inviting a friend', 'completed');

  -- Update referral record
  UPDATE public.referrals SET
    status = 'completed',
    reward_amount = v_reward,
    reward_asset_id = v_usdt_id,
    reward_paid = true,
    completed_at = now()
  WHERE id = v_referral.id;

  -- Update referrer earnings total
  UPDATE public.users
  SET total_referral_earnings = total_referral_earnings + v_reward
  WHERE id = v_referral.referrer_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
