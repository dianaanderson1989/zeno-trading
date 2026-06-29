-- ============================================================
-- ZENO NOTIFICATIONS - Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'deposit_approved', 'deposit_rejected',
    'withdrawal_approved', 'withdrawal_rejected',
    'kyc_approved', 'kyc_rejected', 'kyc_in_review',
    'trade_win', 'trade_lose',
    'binary_win', 'binary_lose',
    'general'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_own" ON public.notifications
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "notifications_insert_admin" ON public.notifications
  FOR INSERT WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- Helper function to create a notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update resolve_binary_option to also create notifications
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

  -- Notification for trade settlement
  PERFORM public.create_notification(
    v_trade.user_id,
    CASE WHEN v_outcome = 'win' THEN 'binary_win' ELSE 'binary_lose' END,
    CASE WHEN v_outcome = 'win' THEN '🎉 Trade Won!' ELSE '📉 Trade Lost' END,
    CASE WHEN v_outcome = 'win'
      THEN 'Your binary trade settled as a WIN. You received $' || round(v_payout::numeric, 2) || ' USDT.'
      ELSE 'Your binary trade settled as a LOSS. Stake of $' || v_trade.stake_amount || ' was deducted.'
    END,
    jsonb_build_object(
      'trade_id', p_trade_id,
      'direction', v_trade.direction,
      'stake', v_trade.stake_amount,
      'payout', v_payout,
      'entry_price', v_trade.entry_price,
      'exit_price', p_exit_price
    )
  );

  RETURN jsonb_build_object('success', true, 'outcome', v_outcome, 'payout', v_payout, 'exit_price', p_exit_price);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
