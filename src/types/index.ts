export interface User {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: 'user' | 'admin' | 'super_admin'
  status: 'active' | 'suspended' | 'banned' | 'pending_verification'
  email_verified: boolean
  kyc_status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired'
  kyc_level: number
  created_at: string
  updated_at: string
}

export interface Asset {
  id: string
  symbol: string
  name: string
  decimals: number
  is_active: boolean
  icon_url: string | null
  coingecko_id: string | null
}

export interface PriceFeed {
  id: string
  asset_id: string
  price: number
  volume_24h: number
  change_24h: number
  high_24h: number
  low_24h: number
  updated_at: string
  assets?: Asset
}

export interface Wallet {
  id: string
  user_id: string
  asset_id: string
  balance: number
  locked_balance: number
  updated_at: string
  assets?: Asset
}

export interface Order {
  id: string
  user_id: string
  base_asset_id: string
  quote_asset_id: string
  order_type: 'market' | 'limit' | 'stop_loss' | 'take_profit'
  side: 'buy' | 'sell'
  quantity: number
  price: number | null
  filled_quantity: number
  average_price: number | null
  status: 'pending' | 'partial' | 'filled' | 'cancelled' | 'expired' | 'rejected'
  created_at: string
  filled_at: string | null
  base_asset?: Asset
  quote_asset?: Asset
}

export interface Transaction {
  id: string
  user_id: string
  transaction_type: 'deposit' | 'withdrawal' | 'trade_buy' | 'trade_sell' | 'swap' | 'stake' | 'unstake' | 'staking_reward' | 'admin_adjustment'
  asset_id: string
  amount: number
  fee: number
  description: string | null
  status: 'completed' | 'pending' | 'failed'
  created_at: string
  assets?: Asset
}

export interface StakingPool {
  id: string
  asset_id: string
  name: string
  description: string | null
  apy_rate: number
  min_stake_amount: number
  max_stake_amount: number | null
  lock_period_days: number
  total_staked: number
  is_active: boolean
  assets?: Asset
}

export interface UserStake {
  id: string
  user_id: string
  staking_pool_id: string
  amount: number
  apy_rate: number
  total_rewards: number
  status: 'active' | 'withdrawn' | 'early_withdrawn'
  staked_at: string
  unlock_at: string
  staking_pools?: StakingPool
}

export interface Deposit {
  id: string
  user_id: string
  asset_id: string
  amount: number
  network: string
  tx_hash: string | null
  status: 'pending' | 'approved' | 'completed' | 'rejected'
  created_at: string
  assets?: Asset
}

export interface Withdrawal {
  id: string
  user_id: string
  asset_id: string
  amount: number
  fee: number
  network: string
  address: string
  status: 'pending' | 'approved' | 'completed' | 'rejected'
  rejection_reason: string | null
  created_at: string
  assets?: Asset
}
