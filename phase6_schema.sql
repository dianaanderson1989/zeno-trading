-- ============================================================
-- ZENO PHASE 6 - Run in Supabase SQL Editor
-- ============================================================

-- 1. FIX: Remove starter balance - new users start at $0
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_asset RECORD;
  v_role TEXT := 'user';
BEGIN
  IF NEW.email = 'admin@zeno.com' THEN
    v_role := 'super_admin';
  END IF;

  INSERT INTO public.users (id, email, first_name, last_name, role, status, email_verified)
  VALUES (
    NEW.id, NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    v_role, 'active',
    NEW.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO NOTHING;

  FOR v_asset IN SELECT id FROM public.assets WHERE is_active = true LOOP
    INSERT INTO public.wallets (user_id, asset_id, balance)
    VALUES (NEW.id, v_asset.id, 0)
    ON CONFLICT (user_id, asset_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. DEPOSIT ADDRESSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deposit_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  network TEXT NOT NULL,
  address TEXT NOT NULL,
  label TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asset_id, network)
);

ALTER TABLE public.deposit_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deposit_addresses_read" ON public.deposit_addresses FOR SELECT USING (true);
CREATE POLICY "deposit_addresses_admin_write" ON public.deposit_addresses FOR ALL USING (public.is_admin());

CREATE TRIGGER trg_deposit_addresses_updated_at
  BEFORE UPDATE ON public.deposit_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 3. ADMIN USER SETTINGS (per-user binary outcome)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  binary_outcome TEXT DEFAULT 'random' CHECK (binary_outcome IN ('win', 'lose', 'random')),
  notes TEXT,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_settings_admin" ON public.admin_user_settings FOR ALL USING (public.is_admin());
CREATE POLICY "admin_settings_read_own" ON public.admin_user_settings FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- 4. BINARY OPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.binary_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  direction TEXT NOT NULL CHECK (direction IN ('up', 'down')),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds IN (30, 60, 90, 120, 86400)),
  stake_amount DECIMAL(20,8) NOT NULL CHECK (stake_amount > 0),
  entry_price DECIMAL(20,8) NOT NULL,
  exit_price DECIMAL(20,8),
  payout_percent DECIMAL(5,2) NOT NULL,
  high_roller_bonus DECIMAL(5,2) DEFAULT 0,
  total_payout_percent DECIMAL(5,2) NOT NULL,
  payout_amount DECIMAL(20,8),
  outcome TEXT CHECK (outcome IN ('win', 'lose', 'pending')),
  admin_outcome_override TEXT DEFAULT 'random' CHECK (admin_outcome_override IN ('win', 'lose', 'random')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  entry_time TIMESTAMPTZ DEFAULT now(),
  exit_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_binary_options_user ON public.binary_options(user_id);
CREATE INDEX IF NOT EXISTS idx_binary_options_status ON public.binary_options(status);

ALTER TABLE public.binary_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "binary_own" ON public.binary_options FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "binary_insert" ON public.binary_options FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "binary_update" ON public.binary_options FOR UPDATE USING (public.is_admin() OR user_id = auth.uid());

-- ============================================================
-- 5. PLACE BINARY OPTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.place_binary_option(
  p_user_id UUID, p_asset_id UUID, p_direction TEXT,
  p_duration_seconds INTEGER, p_stake_amount DECIMAL, p_entry_price DECIMAL
)
RETURNS JSONB AS $$
DECLARE
  v_usdt_id UUID;
  v_usdt_balance DECIMAL;
  v_base_payout DECIMAL;
  v_bonus DECIMAL := 0;
  v_total_payout DECIMAL;
  v_exit_time TIMESTAMPTZ;
  v_trade_id UUID;
  v_outcome_override TEXT := 'random';
BEGIN
  SELECT id INTO v_usdt_id FROM public.assets WHERE symbol = 'USDT' LIMIT 1;

  SELECT balance INTO v_usdt_balance FROM public.wallets
  WHERE user_id = p_user_id AND asset_id = v_usdt_id FOR UPDATE;

  IF v_usdt_balance IS NULL OR v_usdt_balance < p_stake_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient USDT balance');
  END IF;

  CASE p_duration_seconds
    WHEN 30   THEN v_base_payout := 15;
    WHEN 60   THEN v_base_payout := 25; IF p_stake_amount > 500  THEN v_bonus := 2; END IF;
    WHEN 90   THEN v_base_payout := 35; IF p_stake_amount > 1000 THEN v_bonus := 3; END IF;
    WHEN 120  THEN v_base_payout := 45; IF p_stake_amount > 2000 THEN v_bonus := 5; END IF;
    WHEN 86400 THEN v_base_payout := 60; IF p_stake_amount > 5000 THEN v_bonus := 8; END IF;
    ELSE RETURN jsonb_build_object('success', false, 'error', 'Invalid duration');
  END CASE;

  v_total_payout := v_base_payout + v_bonus;
  v_exit_time := now() + (p_duration_seconds || ' seconds')::INTERVAL;

  SELECT binary_outcome INTO v_outcome_override
  FROM public.admin_user_settings WHERE user_id = p_user_id;
  IF NOT FOUND THEN v_outcome_override := 'random'; END IF;

  UPDATE public.wallets SET balance = balance - p_stake_amount
  WHERE user_id = p_user_id AND asset_id = v_usdt_id;

  INSERT INTO public.binary_options (
    user_id, asset_id, direction, duration_seconds,
    stake_amount, entry_price, payout_percent, high_roller_bonus,
    total_payout_percent, exit_time, admin_outcome_override, status
  ) VALUES (
    p_user_id, p_asset_id, p_direction, p_duration_seconds,
    p_stake_amount, p_entry_price, v_base_payout, v_bonus,
    v_total_payout, v_exit_time, v_outcome_override, 'active'
  ) RETURNING id INTO v_trade_id;

  RETURN jsonb_build_object(
    'success', true, 'trade_id', v_trade_id,
    'exit_time', v_exit_time, 'payout_percent', v_total_payout,
    'base_payout', v_base_payout, 'bonus', v_bonus
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. RESOLVE BINARY OPTION
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

  IF v_trade.admin_outcome_override = 'win' THEN
    v_outcome := 'win';
  ELSIF v_trade.admin_outcome_override = 'lose' THEN
    v_outcome := 'lose';
  ELSE
    v_outcome := CASE WHEN random() >= 0.5 THEN 'win' ELSE 'lose' END;
  END IF;

  IF v_outcome = 'win' THEN
    v_payout := v_trade.stake_amount + (v_trade.stake_amount * v_trade.total_payout_percent / 100);
    UPDATE public.wallets SET balance = balance + v_payout
    WHERE user_id = v_trade.user_id AND asset_id = v_usdt_id;
  END IF;

  UPDATE public.binary_options SET
    exit_price = p_exit_price, outcome = v_outcome,
    payout_amount = CASE WHEN v_outcome = 'win' THEN v_payout ELSE 0 END,
    status = 'completed', exit_time = now()
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
-- 7. SEED DEPOSIT ADDRESSES (replace with your real addresses)
-- ============================================================
INSERT INTO public.deposit_addresses (asset_id, network, address, label)
SELECT id, 'ERC20', '0xReplaceWithYourERC20Address', 'Ethereum / ERC-20'
FROM public.assets WHERE symbol = 'USDT' ON CONFLICT (asset_id, network) DO NOTHING;

INSERT INTO public.deposit_addresses (asset_id, network, address, label)
SELECT id, 'TRC20', 'TReplaceWithYourTRC20Address', 'Tron / TRC-20'
FROM public.assets WHERE symbol = 'USDT' ON CONFLICT (asset_id, network) DO NOTHING;

INSERT INTO public.deposit_addresses (asset_id, network, address, label)
SELECT id, 'BEP20', '0xReplaceWithYourBEP20Address', 'BNB Smart Chain / BEP-20'
FROM public.assets WHERE symbol = 'USDT' ON CONFLICT (asset_id, network) DO NOTHING;

INSERT INTO public.deposit_addresses (asset_id, network, address, label)
SELECT id, 'BTC', 'bc1ReplaceWithYourBTCAddress', 'Bitcoin Mainnet'
FROM public.assets WHERE symbol = 'BTC' ON CONFLICT (asset_id, network) DO NOTHING;

INSERT INTO public.deposit_addresses (asset_id, network, address, label)
SELECT id, 'ERC20', '0xReplaceWithYourETHAddress', 'Ethereum Mainnet'
FROM public.assets WHERE symbol = 'ETH' ON CONFLICT (asset_id, network) DO NOTHING;
