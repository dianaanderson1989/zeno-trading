-- Add per-user KYC enforcement flag
ALTER TABLE public.admin_user_settings
  ADD COLUMN IF NOT EXISTS require_kyc BOOLEAN DEFAULT false;

-- Update the withdrawal check function to respect per-user KYC flag
CREATE OR REPLACE FUNCTION public.submit_withdrawal_with_checks(
  p_user_id    UUID,
  p_asset_id   UUID,
  p_amount     DECIMAL,
  p_network    TEXT,
  p_address    TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user              RECORD;
  v_usdt_price        DECIMAL := 1;
  v_usd_value         DECIMAL;
  v_kyc_global        BOOLEAN := false;
  v_kyc_threshold     DECIMAL := 500;
  v_large_threshold   DECIMAL := 1000;
  v_new_addr_flag     BOOLEAN := true;
  v_bal_pct_flag      DECIMAL := 50;
  v_require_kyc_user  BOOLEAN := false;
  v_total_balance     DECIMAL := 0;
  v_wallet            RECORD;
  v_withdrawal_id     UUID;
  v_is_new_address    BOOLEAN := false;
  v_flags             TEXT[] := '{}';
  v_risk_level        TEXT := 'low';
BEGIN
  -- Fetch user
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Blocked if suspended/banned
  IF v_user.status IN ('suspended', 'banned') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your account is currently restricted. Please contact support.');
  END IF;

  -- Get price for USD value calculation
  SELECT COALESCE(pf.price, 1) INTO v_usdt_price
  FROM public.price_feeds pf WHERE pf.asset_id = p_asset_id;
  v_usd_value := p_amount * COALESCE(v_usdt_price, 1);

  -- Load platform settings
  SELECT value::boolean INTO v_kyc_global    FROM public.platform_settings WHERE key = 'kyc_required_global';
  SELECT value::decimal INTO v_kyc_threshold  FROM public.platform_settings WHERE key = 'kyc_threshold_usd';
  SELECT value::decimal INTO v_large_threshold FROM public.platform_settings WHERE key = 'large_withdrawal_usd';
  SELECT value::boolean INTO v_new_addr_flag  FROM public.platform_settings WHERE key = 'new_address_flag';
  SELECT value::decimal INTO v_bal_pct_flag   FROM public.platform_settings WHERE key = 'balance_pct_flag';

  -- Per-user KYC override
  SELECT COALESCE(require_kyc, false) INTO v_require_kyc_user
  FROM public.admin_user_settings WHERE user_id = p_user_id;

  -- KYC enforcement: global OR threshold OR per-user override
  IF v_kyc_global OR v_require_kyc_user OR v_usd_value >= v_kyc_threshold THEN
    IF v_user.kyc_status != 'approved' THEN
      RETURN jsonb_build_object(
        'success', false,
        'kyc_required', true,
        'error',
          CASE
            WHEN v_require_kyc_user THEN 'KYC verification is required on your account. Please complete identity verification in Account Settings.'
            WHEN v_kyc_global       THEN 'KYC verification is required for all withdrawals on this platform.'
            ELSE 'KYC verification is required for withdrawals above $' || v_kyc_threshold::TEXT || '. Please complete identity verification in Account Settings.'
          END
      );
    END IF;
  END IF;

  -- Check wallet balance
  SELECT * INTO v_wallet FROM public.wallets
  WHERE user_id = p_user_id AND asset_id = p_asset_id FOR UPDATE;

  IF NOT FOUND OR v_wallet.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- New address flag
  IF v_new_addr_flag THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.withdrawals
      WHERE user_id = p_user_id AND address = p_address AND status = 'completed'
    ) THEN
      v_is_new_address := true;
      v_flags := array_append(v_flags, 'new_address');
    END IF;
  END IF;

  -- Large amount flag
  IF v_usd_value >= v_large_threshold THEN
    v_flags := array_append(v_flags, 'large_amount');
  END IF;

  -- High balance % flag
  SELECT COALESCE(SUM(w.balance * COALESCE(pf.price, 1)), 0) INTO v_total_balance
  FROM public.wallets w
  LEFT JOIN public.price_feeds pf ON pf.asset_id = w.asset_id
  WHERE w.user_id = p_user_id;

  IF v_total_balance > 0 AND (v_usd_value / v_total_balance * 100) >= v_bal_pct_flag THEN
    v_flags := array_append(v_flags, 'high_balance_pct');
  END IF;

  -- Set risk level
  v_risk_level := CASE
    WHEN array_length(v_flags, 1) >= 2 THEN 'high'
    WHEN array_length(v_flags, 1) = 1  THEN 'medium'
    ELSE 'low'
  END;

  -- Create withdrawal
  INSERT INTO public.withdrawals (
    user_id, asset_id, amount, network, address,
    status, risk_level, is_new_address, flag_count
  ) VALUES (
    p_user_id, p_asset_id, p_amount, p_network, p_address,
    'pending', v_risk_level, v_is_new_address,
    COALESCE(array_length(v_flags, 1), 0)
  ) RETURNING id INTO v_withdrawal_id;

  -- Insert flags
  FOR i IN 1..COALESCE(array_length(v_flags, 1), 0) LOOP
    INSERT INTO public.withdrawal_flags (withdrawal_id, user_id, flag_type, details)
    VALUES (
      v_withdrawal_id, p_user_id, v_flags[i],
      CASE v_flags[i]
        WHEN 'new_address'      THEN 'Withdrawal to a new, unverified address'
        WHEN 'large_amount'     THEN 'Amount exceeds $' || v_large_threshold::TEXT || ' threshold'
        WHEN 'high_balance_pct' THEN 'Withdrawal exceeds ' || v_bal_pct_flag::TEXT || '% of total balance'
        ELSE v_flags[i]
      END
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'risk_level', v_risk_level,
    'flags', v_flags,
    'message', CASE
      WHEN v_risk_level = 'high'   THEN 'Withdrawal submitted but flagged for manual review.'
      WHEN v_risk_level = 'medium' THEN 'Withdrawal submitted and will be reviewed shortly.'
      ELSE 'Withdrawal submitted successfully.'
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
