-- ============================================================
-- ZENO CRYPTO TRADING PLATFORM - SUPABASE SCHEMA
-- Paste this entire file into Supabase SQL Editor and run it
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned', 'pending_verification')),
  email_verified BOOLEAN DEFAULT false,
  phone TEXT,
  phone_verified BOOLEAN DEFAULT false,
  kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'in_review', 'approved', 'rejected', 'expired')),
  kyc_level INTEGER DEFAULT 0 CHECK (kyc_level >= 0 AND kyc_level <= 3),
  kyc_verified_at TIMESTAMPTZ,
  kyc_documents JSONB,
  date_of_birth TEXT,
  country_code TEXT,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en',
  notification_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Assets
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  decimals INTEGER NOT NULL DEFAULT 8,
  is_active BOOLEAN DEFAULT true,
  icon_url TEXT,
  description TEXT,
  coingecko_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Price Feeds
CREATE TABLE IF NOT EXISTS public.price_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  price DECIMAL(20,8) NOT NULL DEFAULT 0,
  volume_24h DECIMAL DEFAULT 0,
  change_24h DECIMAL DEFAULT 0,
  high_24h DECIMAL DEFAULT 0,
  low_24h DECIMAL DEFAULT 0,
  source TEXT DEFAULT 'coingecko',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asset_id)
);

-- Wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  balance DECIMAL(20,8) DEFAULT 0 CHECK (balance >= 0),
  locked_balance DECIMAL(20,8) DEFAULT 0 CHECK (locked_balance >= 0),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, asset_id)
);

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  base_asset_id UUID NOT NULL REFERENCES public.assets(id),
  quote_asset_id UUID NOT NULL REFERENCES public.assets(id),
  order_type TEXT NOT NULL CHECK (order_type IN ('market', 'limit', 'stop_loss', 'take_profit')),
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity DECIMAL(20,8) NOT NULL CHECK (quantity > 0),
  price DECIMAL(20,8) CHECK (price IS NULL OR price > 0),
  stop_price DECIMAL(20,8) CHECK (stop_price IS NULL OR stop_price > 0),
  filled_quantity DECIMAL(20,8) DEFAULT 0,
  average_price DECIMAL(20,8),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'filled', 'cancelled', 'expired', 'rejected')),
  admin_outcome TEXT CHECK (admin_outcome IN ('win', 'lose', 'random')),
  admin_notes TEXT,
  admin_user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  filled_at TIMESTAMPTZ
);

-- Swaps
CREATE TABLE IF NOT EXISTS public.swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  from_asset_id UUID NOT NULL REFERENCES public.assets(id),
  to_asset_id UUID NOT NULL REFERENCES public.assets(id),
  from_amount DECIMAL(20,8) NOT NULL CHECK (from_amount > 0),
  to_amount DECIMAL(20,8) NOT NULL CHECK (to_amount > 0),
  exchange_rate DECIMAL(20,8) NOT NULL,
  fee DECIMAL(20,8) DEFAULT 0,
  fee_asset_id UUID REFERENCES public.assets(id),
  status TEXT DEFAULT 'completed',
  executed_at TIMESTAMPTZ DEFAULT now()
);

-- Staking Pools
CREATE TABLE IF NOT EXISTS public.staking_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  name TEXT NOT NULL,
  description TEXT,
  apy_rate DECIMAL(5,2) NOT NULL,
  min_stake_amount DECIMAL(20,8) NOT NULL DEFAULT 0,
  max_stake_amount DECIMAL(20,8),
  max_pool_size DECIMAL(20,8),
  lock_period_days INTEGER NOT NULL DEFAULT 0,
  total_staked DECIMAL(20,8) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User Stakes
CREATE TABLE IF NOT EXISTS public.user_stakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  staking_pool_id UUID NOT NULL REFERENCES public.staking_pools(id),
  amount DECIMAL(20,8) NOT NULL CHECK (amount > 0),
  apy_rate DECIMAL(5,2) NOT NULL,
  total_rewards DECIMAL(20,8) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'early_withdrawn')),
  staked_at TIMESTAMPTZ DEFAULT now(),
  unlock_at TIMESTAMPTZ NOT NULL,
  last_reward_calculation TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ
);

-- Staking Rewards
CREATE TABLE IF NOT EXISTS public.staking_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_stake_id UUID NOT NULL REFERENCES public.user_stakes(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  reward_amount DECIMAL(20,8) NOT NULL,
  apy_rate DECIMAL(5,2) NOT NULL,
  calculation_period_start TIMESTAMPTZ NOT NULL,
  calculation_period_end TIMESTAMPTZ NOT NULL,
  distributed_at TIMESTAMPTZ DEFAULT now()
);

-- Deposits
CREATE TABLE IF NOT EXISTS public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  amount DECIMAL(20,8) NOT NULL CHECK (amount > 0),
  network TEXT NOT NULL,
  tx_hash TEXT,
  address TEXT,
  screenshot_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'rejected')),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  admin_notes TEXT,
  admin_user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Withdrawals
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  amount DECIMAL(20,8) NOT NULL CHECK (amount > 0),
  fee DECIMAL(20,8) DEFAULT 0,
  network TEXT NOT NULL,
  address TEXT NOT NULL,
  tx_hash TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'rejected')),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  rejection_reason TEXT,
  admin_notes TEXT,
  admin_user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Transactions (unified history)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'trade_buy', 'trade_sell', 'swap', 'stake', 'unstake', 'staking_reward', 'admin_adjustment')),
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  amount DECIMAL(20,8) NOT NULL,
  fee DECIMAL(20,8) DEFAULT 0,
  description TEXT,
  metadata JSONB,
  swap_id UUID REFERENCES public.swaps(id),
  stake_id UUID REFERENCES public.user_stakes(id),
  order_id UUID REFERENCES public.orders(id),
  deposit_id UUID REFERENCES public.deposits(id),
  withdrawal_id UUID REFERENCES public.withdrawals(id),
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  admin_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_wallets_user ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_asset ON public.wallets(asset_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_user ON public.deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON public.deposits(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_user_stakes_user ON public.user_stakes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stakes_status ON public.user_stakes(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_deposits_updated_at BEFORE UPDATE ON public.deposits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_withdrawals_updated_at BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_staking_pools_updated_at BEFORE UPDATE ON public.staking_pools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create user profile + wallets on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_asset RECORD;
  v_role TEXT := 'user';
BEGIN
  -- Promote specific email to super_admin
  IF NEW.email = 'admin@zeno.com' THEN
    v_role := 'super_admin';
  END IF;

  INSERT INTO public.users (id, email, first_name, last_name, role, status, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    v_role,
    'active',
    NEW.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create a wallet for each active asset
  FOR v_asset IN SELECT id FROM public.assets WHERE is_active = true LOOP
    INSERT INTO public.wallets (user_id, asset_id, balance)
    VALUES (NEW.id, v_asset.id, 0)
    ON CONFLICT (user_id, asset_id) DO NOTHING;
  END LOOP;

  -- Give new users paper trading starter balance (USDT)
  UPDATE public.wallets
  SET balance = 10000
  WHERE user_id = NEW.id
    AND asset_id = (SELECT id FROM public.assets WHERE symbol = 'USDT' LIMIT 1);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Execute a market trade (paper trading)
CREATE OR REPLACE FUNCTION public.execute_market_order(
  p_user_id UUID,
  p_base_asset_id UUID,
  p_quote_asset_id UUID,
  p_side TEXT,
  p_quantity DECIMAL,
  p_price DECIMAL
)
RETURNS JSONB AS $$
DECLARE
  v_total DECIMAL;
  v_fee DECIMAL;
  v_base_wallet_id UUID;
  v_quote_wallet_id UUID;
  v_base_balance DECIMAL;
  v_quote_balance DECIMAL;
  v_order_id UUID;
BEGIN
  v_total := p_quantity * p_price;
  v_fee := v_total * 0.001; -- 0.1% fee

  -- Get wallet IDs and balances
  SELECT id, balance INTO v_base_wallet_id, v_base_balance
  FROM public.wallets WHERE user_id = p_user_id AND asset_id = p_base_asset_id FOR UPDATE;

  SELECT id, balance INTO v_quote_wallet_id, v_quote_balance
  FROM public.wallets WHERE user_id = p_user_id AND asset_id = p_quote_asset_id FOR UPDATE;

  IF p_side = 'buy' THEN
    -- Check USDT balance
    IF v_quote_balance < (v_total + v_fee) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;
    -- Deduct quote, add base
    UPDATE public.wallets SET balance = balance - v_total - v_fee WHERE id = v_quote_wallet_id;
    UPDATE public.wallets SET balance = balance + p_quantity WHERE id = v_base_wallet_id;
  ELSE
    -- Check base asset balance
    IF v_base_balance < p_quantity THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;
    -- Deduct base, add quote (minus fee)
    UPDATE public.wallets SET balance = balance - p_quantity WHERE id = v_base_wallet_id;
    UPDATE public.wallets SET balance = balance + v_total - v_fee WHERE id = v_quote_wallet_id;
  END IF;

  -- Create order record
  INSERT INTO public.orders (user_id, base_asset_id, quote_asset_id, order_type, side, quantity, price, filled_quantity, average_price, status, filled_at)
  VALUES (p_user_id, p_base_asset_id, p_quote_asset_id, 'market', p_side, p_quantity, p_price, p_quantity, p_price, 'filled', now())
  RETURNING id INTO v_order_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, transaction_type, asset_id, amount, fee, description, order_id)
  VALUES (
    p_user_id,
    CASE WHEN p_side = 'buy' THEN 'trade_buy' ELSE 'trade_sell' END,
    p_base_asset_id,
    p_quantity,
    v_fee,
    CASE WHEN p_side = 'buy' THEN 'Bought ' ELSE 'Sold ' END || p_quantity || ' at $' || p_price,
    v_order_id
  );

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute swap
CREATE OR REPLACE FUNCTION public.execute_swap(
  p_user_id UUID,
  p_from_asset_id UUID,
  p_to_asset_id UUID,
  p_from_amount DECIMAL,
  p_exchange_rate DECIMAL
)
RETURNS JSONB AS $$
DECLARE
  v_to_amount DECIMAL;
  v_fee DECIMAL;
  v_swap_id UUID;
  v_from_balance DECIMAL;
BEGIN
  v_fee := p_from_amount * 0.001;
  v_to_amount := (p_from_amount - v_fee) * p_exchange_rate;

  SELECT balance INTO v_from_balance FROM public.wallets
  WHERE user_id = p_user_id AND asset_id = p_from_asset_id FOR UPDATE;

  IF v_from_balance < p_from_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE public.wallets SET balance = balance - p_from_amount
  WHERE user_id = p_user_id AND asset_id = p_from_asset_id;

  UPDATE public.wallets SET balance = balance + v_to_amount
  WHERE user_id = p_user_id AND asset_id = p_to_asset_id;

  INSERT INTO public.swaps (user_id, from_asset_id, to_asset_id, from_amount, to_amount, exchange_rate, fee, fee_asset_id)
  VALUES (p_user_id, p_from_asset_id, p_to_asset_id, p_from_amount, v_to_amount, p_exchange_rate, v_fee, p_from_asset_id)
  RETURNING id INTO v_swap_id;

  INSERT INTO public.transactions (user_id, transaction_type, asset_id, amount, fee, description, swap_id)
  VALUES (p_user_id, 'swap', p_from_asset_id, p_from_amount, v_fee, 'Swap', v_swap_id);

  RETURN jsonb_build_object('success', true, 'swap_id', v_swap_id, 'to_amount', v_to_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staking_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staking_pools ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Public read: assets, price_feeds, staking_pools
CREATE POLICY "assets_public_read" ON public.assets FOR SELECT USING (true);
CREATE POLICY "price_feeds_public_read" ON public.price_feeds FOR SELECT USING (true);
CREATE POLICY "staking_pools_public_read" ON public.staking_pools FOR SELECT USING (true);

-- Users: own row only (admins see all)
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (id = auth.uid() OR public.is_admin());

-- Wallets: own only
CREATE POLICY "wallets_select_own" ON public.wallets FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "wallets_update_own" ON public.wallets FOR UPDATE USING (user_id = auth.uid());

-- Orders
CREATE POLICY "orders_select_own" ON public.orders FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "orders_insert_own" ON public.orders FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "orders_update_admin" ON public.orders FOR UPDATE USING (public.is_admin());

-- Swaps
CREATE POLICY "swaps_select_own" ON public.swaps FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "swaps_insert_own" ON public.swaps FOR INSERT WITH CHECK (user_id = auth.uid());

-- Deposits
CREATE POLICY "deposits_select_own" ON public.deposits FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "deposits_insert_own" ON public.deposits FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "deposits_update_admin" ON public.deposits FOR UPDATE USING (public.is_admin());

-- Withdrawals
CREATE POLICY "withdrawals_select_own" ON public.withdrawals FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "withdrawals_insert_own" ON public.withdrawals FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "withdrawals_update_admin" ON public.withdrawals FOR UPDATE USING (public.is_admin());

-- Transactions
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "transactions_insert_own" ON public.transactions FOR INSERT WITH CHECK (user_id = auth.uid());

-- User Stakes
CREATE POLICY "user_stakes_select_own" ON public.user_stakes FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "user_stakes_insert_own" ON public.user_stakes FOR INSERT WITH CHECK (user_id = auth.uid());

-- Staking Rewards
CREATE POLICY "staking_rewards_select_own" ON public.staking_rewards FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- Audit Logs: admins only
CREATE POLICY "audit_logs_admin_only" ON public.audit_logs FOR SELECT USING (public.is_admin());

-- ============================================================
-- SEED DATA
-- ============================================================

-- Assets
INSERT INTO public.assets (symbol, name, decimals, coingecko_id, icon_url) VALUES
  ('USDT', 'Tether', 6, 'tether', 'https://assets.coingecko.com/coins/images/325/small/Tether.png'),
  ('BTC', 'Bitcoin', 8, 'bitcoin', 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png'),
  ('ETH', 'Ethereum', 18, 'ethereum', 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'),
  ('BNB', 'BNB', 18, 'binancecoin', 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png'),
  ('SOL', 'Solana', 9, 'solana', 'https://assets.coingecko.com/coins/images/4128/small/solana.png'),
  ('ADA', 'Cardano', 6, 'cardano', 'https://assets.coingecko.com/coins/images/975/small/cardano.png'),
  ('DOT', 'Polkadot', 10, 'polkadot', 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png'),
  ('XRP', 'XRP', 6, 'ripple', 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png')
ON CONFLICT (symbol) DO NOTHING;

-- Initial price feeds (will be updated by frontend)
INSERT INTO public.price_feeds (asset_id, price, change_24h)
SELECT id, 
  CASE symbol 
    WHEN 'USDT' THEN 1
    WHEN 'BTC' THEN 67000
    WHEN 'ETH' THEN 3500
    WHEN 'BNB' THEN 580
    WHEN 'SOL' THEN 170
    WHEN 'ADA' THEN 0.45
    WHEN 'DOT' THEN 7.5
    WHEN 'XRP' THEN 0.55
  END,
  0
FROM public.assets
ON CONFLICT (asset_id) DO NOTHING;

-- Staking Pools
INSERT INTO public.staking_pools (asset_id, name, description, apy_rate, min_stake_amount, lock_period_days) VALUES
  ((SELECT id FROM public.assets WHERE symbol='ETH'), 'ETH 2.0 Staking', 'Stake ETH and earn rewards', 5.20, 0.01, 30),
  ((SELECT id FROM public.assets WHERE symbol='ADA'), 'Cardano Staking', 'Delegate ADA to earn rewards', 4.80, 10, 21),
  ((SELECT id FROM public.assets WHERE symbol='DOT'), 'Polkadot Staking', 'Nominate DOT for high yields', 12.50, 1, 28),
  ((SELECT id FROM public.assets WHERE symbol='SOL'), 'Solana Staking', 'Stake SOL with validators', 6.80, 0.1, 14),
  ((SELECT id FROM public.assets WHERE symbol='BNB'), 'BNB Vault', 'Flexible BNB staking', 3.50, 0.01, 7)
ON CONFLICT DO NOTHING;
