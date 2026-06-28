-- ============================================================
-- ZENO PHASE 7 - Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. FIX: Binary win rate 30% win / 70% lose
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_binary_option(
  p_trade_id UUID, p_exit_price DECIMAL
)
RETURNS JSONB AS $$
DECLARE
  v_trade RECORD;
  v_usdt_id UUID;
  v_outcome TEXT;
  v_payout DECIMAL := 0;
BEGIN
  SELECT * INTO v_trade FROM public.binary_options
  WHERE id = p_trade_id AND status = 'active' FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found or already resolved');
  END IF;

  SELECT id INTO v_usdt_id FROM public.assets WHERE symbol = 'USDT' LIMIT 1;

  -- Outcome logic: admin override takes priority, else 30% win / 70% lose
  IF v_trade.admin_outcome_override = 'win' THEN
    v_outcome := 'win';
  ELSIF v_trade.admin_outcome_override = 'lose' THEN
    v_outcome := 'lose';
  ELSE
    -- 30% win, 70% lose
    v_outcome := CASE WHEN random() <= 0.30 THEN 'win' ELSE 'lose' END;
  END IF;

  IF v_outcome = 'win' THEN
    v_payout := v_trade.stake_amount + (v_trade.stake_amount * v_trade.total_payout_percent / 100);
    UPDATE public.wallets SET balance = balance + v_payout
    WHERE user_id = v_trade.user_id AND asset_id = v_usdt_id;
  END IF;

  UPDATE public.binary_options SET
    exit_price = p_exit_price,
    outcome = v_outcome,
    payout_amount = CASE WHEN v_outcome = 'win' THEN v_payout ELSE 0 END,
    status = 'completed',
    exit_time = now()
  WHERE id = p_trade_id;

  INSERT INTO public.transactions (user_id, transaction_type, asset_id, amount, description, status)
  VALUES (
    v_trade.user_id,
    CASE WHEN v_outcome = 'win' THEN 'trade_buy' ELSE 'trade_sell' END,
    v_usdt_id,
    CASE WHEN v_outcome = 'win' THEN v_payout ELSE v_trade.stake_amount END,
    'Binary ' || v_trade.direction || ' ' ||
      CASE WHEN v_trade.duration_seconds = 86400 THEN '1 Day'
           ELSE v_trade.duration_seconds || 's' END ||
      ' — ' || upper(v_outcome) || ' | Entry: $' || v_trade.entry_price || ' Exit: $' || p_exit_price,
    'completed'
  );

  RETURN jsonb_build_object('success', true, 'outcome', v_outcome, 'payout', v_payout, 'exit_price', p_exit_price);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. EXTENDED USER PROFILE COLUMNS
-- ============================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS notify_trades BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_deposits BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_withdrawals BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_promotions BOOLEAN DEFAULT false;

-- ============================================================
-- 3. KYC DOCUMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('passport', 'national_id', 'drivers_license', 'selfie', 'proof_of_address')),
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_documents_user ON public.kyc_documents(user_id);

ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kyc_docs_own" ON public.kyc_documents FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "kyc_docs_insert" ON public.kyc_documents FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "kyc_docs_admin_update" ON public.kyc_documents FOR UPDATE USING (public.is_admin());

-- ============================================================
-- 4. TWO-FACTOR AUTH TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.two_factor_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  backup_codes TEXT[], -- hashed backup codes
  enabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.two_factor_auth ENABLE ROW LEVEL SECURITY;
CREATE POLICY "2fa_own" ON public.two_factor_auth FOR ALL USING (user_id = auth.uid() OR public.is_admin());

CREATE TRIGGER trg_2fa_updated_at
  BEFORE UPDATE ON public.two_factor_auth
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 5. ADMIN USER SETTINGS — add 2FA withdrawal requirement
-- ============================================================
ALTER TABLE public.admin_user_settings
  ADD COLUMN IF NOT EXISTS require_2fa_withdrawal BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS withdrawal_limit DECIMAL(20,8),
  ADD COLUMN IF NOT EXISTS deposit_limit DECIMAL(20,8);

-- ============================================================
-- 6. BINARY OPTIONS TIERED THRESHOLDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.binary_tier_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  duration_seconds INTEGER NOT NULL UNIQUE CHECK (duration_seconds IN (30, 60, 90, 120, 86400)),
  duration_label TEXT NOT NULL,
  min_balance DECIMAL(20,8) NOT NULL DEFAULT 0,
  base_payout_percent DECIMAL(5,2) NOT NULL,
  max_stake DECIMAL(20,8) NOT NULL,
  high_roller_threshold DECIMAL(20,8),
  high_roller_bonus DECIMAL(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.binary_tier_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "binary_tier_read" ON public.binary_tier_config FOR SELECT USING (true);
CREATE POLICY "binary_tier_admin" ON public.binary_tier_config FOR ALL USING (public.is_admin());

-- Seed tier config with your specified thresholds
INSERT INTO public.binary_tier_config
  (duration_seconds, duration_label, min_balance, base_payout_percent, max_stake, high_roller_threshold, high_roller_bonus)
VALUES
  (30,    '30s',   20,      15, 100,   NULL,  0),
  (60,    '60s',   5000,    25, 500,   500,   2),
  (90,    '90s',   25000,   35, 1000,  1000,  3),
  (120,   '120s',  50000,   45, 2000,  2000,  5),
  (86400, '1 Day', 100000,  60, 5000,  5000,  8)
ON CONFLICT (duration_seconds) DO UPDATE SET
  min_balance = EXCLUDED.min_balance,
  base_payout_percent = EXCLUDED.base_payout_percent,
  max_stake = EXCLUDED.max_stake,
  high_roller_threshold = EXCLUDED.high_roller_threshold,
  high_roller_bonus = EXCLUDED.high_roller_bonus;

-- ============================================================
-- 7. UPDATE place_binary_option to use tier config
-- ============================================================
CREATE OR REPLACE FUNCTION public.place_binary_option(
  p_user_id UUID, p_asset_id UUID, p_direction TEXT,
  p_duration_seconds INTEGER, p_stake_amount DECIMAL, p_entry_price DECIMAL
)
RETURNS JSONB AS $$
DECLARE
  v_usdt_id UUID;
  v_usdt_balance DECIMAL;
  v_tier RECORD;
  v_bonus DECIMAL := 0;
  v_total_payout DECIMAL;
  v_exit_time TIMESTAMPTZ;
  v_trade_id UUID;
  v_outcome_override TEXT := 'random';
BEGIN
  SELECT id INTO v_usdt_id FROM public.assets WHERE symbol = 'USDT' LIMIT 1;

  -- Check USDT balance
  SELECT balance INTO v_usdt_balance FROM public.wallets
  WHERE user_id = p_user_id AND asset_id = v_usdt_id FOR UPDATE;

  IF v_usdt_balance IS NULL OR v_usdt_balance < p_stake_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient USDT balance');
  END IF;

  -- Get tier config
  SELECT * INTO v_tier FROM public.binary_tier_config
  WHERE duration_seconds = p_duration_seconds AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive duration');
  END IF;

  -- Check minimum balance requirement
  IF v_usdt_balance < v_tier.min_balance THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Minimum balance of $' || v_tier.min_balance || ' required for ' || v_tier.duration_label || ' trades'
    );
  END IF;

  -- High roller bonus
  IF v_tier.high_roller_threshold IS NOT NULL AND p_stake_amount > v_tier.high_roller_threshold THEN
    v_bonus := v_tier.high_roller_bonus;
  END IF;

  v_total_payout := v_tier.base_payout_percent + v_bonus;
  v_exit_time := now() + (p_duration_seconds || ' seconds')::INTERVAL;

  -- Get admin outcome override
  SELECT binary_outcome INTO v_outcome_override
  FROM public.admin_user_settings WHERE user_id = p_user_id;
  IF NOT FOUND THEN v_outcome_override := 'random'; END IF;

  -- Deduct stake
  UPDATE public.wallets SET balance = balance - p_stake_amount
  WHERE user_id = p_user_id AND asset_id = v_usdt_id;

  -- Create trade
  INSERT INTO public.binary_options (
    user_id, asset_id, direction, duration_seconds,
    stake_amount, entry_price, payout_percent, high_roller_bonus,
    total_payout_percent, exit_time, admin_outcome_override, status
  ) VALUES (
    p_user_id, p_asset_id, p_direction, p_duration_seconds,
    p_stake_amount, p_entry_price, v_tier.base_payout_percent, v_bonus,
    v_total_payout, v_exit_time, v_outcome_override, 'active'
  ) RETURNING id INTO v_trade_id;

  RETURN jsonb_build_object(
    'success', true,
    'trade_id', v_trade_id,
    'exit_time', v_exit_time,
    'payout_percent', v_total_payout,
    'base_payout', v_tier.base_payout_percent,
    'bonus', v_bonus
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. SUPABASE STORAGE BUCKETS
-- Run these separately if needed in Storage UI
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false) ON CONFLICT DO NOTHING;

-- Storage policies (run after creating buckets)
-- CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
-- CREATE POLICY "avatars_own_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "kyc_own_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "kyc_own_read" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));
