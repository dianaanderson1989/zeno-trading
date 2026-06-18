import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Layers, Lock, TrendingUp, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useWallets } from '@/hooks/useWallets'
import { formatNumber, formatDate } from '@/utils/format'
import type { StakingPool, UserStake } from '@/types'

export function StakingPage() {
  const user = useAuthStore(s => s.user)
  const { data: wallets = [] } = useWallets()
  const queryClient = useQueryClient()

  const [selectedPool, setSelectedPool] = useState<StakingPool | null>(null)
  const [stakeAmount, setStakeAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  const { data: pools = [], isLoading: poolsLoading } = useQuery({
    queryKey: ['staking_pools'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staking_pools')
        .select('*, assets(*)')
        .eq('is_active', true)
        .order('apy_rate', { ascending: false })
      if (error) throw error
      return data as StakingPool[]
    },
    staleTime: 60_000,
  })

  const { data: myStakes = [], isLoading: stakesLoading } = useQuery({
    queryKey: ['user_stakes', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_stakes')
        .select('*, staking_pools(*, assets(*))')
        .eq('user_id', user!.id)
        .order('staked_at', { ascending: false })
      if (error) throw error
      return data as UserStake[]
    },
    staleTime: 15_000,
  })

  const getWalletBalance = (assetId: string) => {
    return wallets.find(w => w.asset_id === assetId)?.balance ?? 0
  }

  const handleStake = async () => {
    if (!user || !selectedPool || !stakeAmount) return
    const amount = parseFloat(stakeAmount)
    if (amount <= 0) return
    if (amount < selectedPool.min_stake_amount) {
      setMsg(`Minimum stake is ${selectedPool.min_stake_amount} ${selectedPool.assets?.symbol}`)
      return
    }
    const balance = getWalletBalance(selectedPool.asset_id)
    if (amount > balance) {
      setMsg('Insufficient balance')
      return
    }

    setSubmitting(true)
    setMsg('')

    try {
      const unlockAt = new Date()
      unlockAt.setDate(unlockAt.getDate() + selectedPool.lock_period_days)

      // Deduct from wallet
      const wallet = wallets.find(w => w.asset_id === selectedPool.asset_id)
      if (!wallet) throw new Error('Wallet not found')

      const { error: walletErr } = await supabase
        .from('wallets')
        .update({ balance: wallet.balance - amount })
        .eq('id', wallet.id)
      if (walletErr) throw walletErr

      // Create stake
      const { error: stakeErr } = await supabase.from('user_stakes').insert({
        user_id: user.id,
        staking_pool_id: selectedPool.id,
        amount,
        apy_rate: selectedPool.apy_rate,
        unlock_at: unlockAt.toISOString(),
        status: 'active',
      })
      if (stakeErr) throw stakeErr

      // Update pool total
      await supabase
        .from('staking_pools')
        .update({ total_staked: (selectedPool.total_staked ?? 0) + amount })
        .eq('id', selectedPool.id)

      // Record transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        transaction_type: 'stake',
        asset_id: selectedPool.asset_id,
        amount,
        description: `Staked in ${selectedPool.name}`,
        status: 'completed',
      })

      setMsg(`Successfully staked ${amount} ${selectedPool.assets?.symbol}!`)
      setStakeAmount('')
      setSelectedPool(null)
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
      queryClient.invalidateQueries({ queryKey: ['user_stakes'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    } catch (e: any) {
      setMsg('Error: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnstake = async (stake: UserStake) => {
    if (!user) return
    const now = new Date()
    const unlockAt = new Date(stake.unlock_at)
    const isEarly = now < unlockAt

    if (!confirm(isEarly
      ? `Unstaking early forfeits all rewards. Continue?`
      : `Unstake ${stake.amount} tokens and claim rewards?`
    )) return

    try {
      const pool = (stake as any).staking_pools as StakingPool
      const wallet = wallets.find(w => w.asset_id === pool.asset_id)
      if (!wallet) throw new Error('Wallet not found')

      const returnAmount = isEarly ? stake.amount : stake.amount + stake.total_rewards

      await supabase.from('wallets').update({ balance: wallet.balance + returnAmount }).eq('id', wallet.id)
      await supabase.from('user_stakes').update({
        status: isEarly ? 'early_withdrawn' : 'withdrawn',
        withdrawn_at: new Date().toISOString(),
      }).eq('id', stake.id)
      await supabase.from('transactions').insert({
        user_id: user.id,
        transaction_type: 'unstake',
        asset_id: pool.asset_id,
        amount: returnAmount,
        description: `Unstaked from ${pool.name}`,
        status: 'completed',
      })

      queryClient.invalidateQueries({ queryKey: ['wallets'] })
      queryClient.invalidateQueries({ queryKey: ['user_stakes'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
  }

  const activeStakes = myStakes.filter(s => s.status === 'active')
  const pastStakes = myStakes.filter(s => s.status !== 'active')

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Staking</h1>
        <p className="text-gray-400 text-sm mt-1">Earn passive rewards by staking your crypto</p>
      </div>

      {/* Active stakes summary */}
      {activeStakes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card">
            <p className="text-xs text-gray-400 mb-1">Active Stakes</p>
            <p className="text-2xl font-bold text-white">{activeStakes.length}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-400 mb-1">Total Rewards Earned</p>
            <p className="text-2xl font-bold text-brand-400">
              {formatNumber(activeStakes.reduce((s, st) => s + st.total_rewards, 0), 4)}
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-400 mb-1">Avg APY</p>
            <p className="text-2xl font-bold text-white">
              {(activeStakes.reduce((s, st) => s + st.apy_rate, 0) / activeStakes.length).toFixed(2)}%
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pools */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-semibold text-white">Available Pools</h2>
          {poolsLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-dark-800 rounded-xl animate-pulse" />)}</div>
          ) : pools.map(pool => {
            const balance = getWalletBalance(pool.asset_id)
            const isSelected = selectedPool?.id === pool.id
            return (
              <div
                key={pool.id}
                onClick={() => { setSelectedPool(isSelected ? null : pool); setStakeAmount(''); setMsg('') }}
                className={`card cursor-pointer transition-all border ${isSelected ? 'border-brand-500 bg-brand-500/5' : 'border-dark-600 hover:border-dark-400'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {pool.assets?.icon_url
                      ? <img src={pool.assets.icon_url} alt={pool.assets.symbol} className="w-9 h-9 rounded-full" />
                      : <div className="w-9 h-9 rounded-full bg-dark-500 flex items-center justify-center text-sm">{pool.assets?.symbol?.[0]}</div>
                    }
                    <div>
                      <p className="font-semibold text-white">{pool.name}</p>
                      <p className="text-xs text-gray-400">{pool.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-brand-400">{pool.apy_rate}%</p>
                    <p className="text-xs text-gray-400">APY</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 mt-3 pt-3 border-t border-dark-600 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Lock size={11} /> {pool.lock_period_days}d lock</span>
                  <span className="flex items-center gap-1"><Layers size={11} /> Min: {pool.min_stake_amount} {pool.assets?.symbol}</span>
                  <span className="flex items-center gap-1"><TrendingUp size={11} /> Total staked: {formatNumber(pool.total_staked, 2)}</span>
                  <span className="ml-auto text-gray-300">Your balance: {formatNumber(balance, 4)} {pool.assets?.symbol}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Stake form */}
        <div className="lg:col-span-1">
          {selectedPool ? (
            <div className="card sticky top-6">
              <h3 className="font-semibold text-white mb-4">Stake {selectedPool.assets?.symbol}</h3>
              <div className="bg-dark-700 rounded-lg p-3 mb-4 space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-400">
                  <span>APY</span><span className="text-brand-400 font-semibold">{selectedPool.apy_rate}%</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Lock period</span><span className="text-gray-200">{selectedPool.lock_period_days} days</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Min stake</span><span className="text-gray-200">{selectedPool.min_stake_amount} {selectedPool.assets?.symbol}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Your balance</span>
                  <span className="text-gray-200">{formatNumber(getWalletBalance(selectedPool.asset_id), 4)} {selectedPool.assets?.symbol}</span>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1.5">Amount to Stake</label>
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={e => setStakeAmount(e.target.value)}
                  placeholder="0.00"
                  className="input text-sm"
                />
                <button
                  onClick={() => setStakeAmount(String(getWalletBalance(selectedPool.asset_id)))}
                  className="text-xs text-brand-400 hover:text-brand-300 mt-1"
                >
                  Max
                </button>
              </div>
              {stakeAmount && parseFloat(stakeAmount) > 0 && (
                <div className="bg-dark-700 rounded-lg p-3 mb-4 text-xs space-y-1">
                  <div className="flex justify-between text-gray-400">
                    <span>Est. daily reward</span>
                    <span className="text-gray-200">{formatNumber(parseFloat(stakeAmount) * selectedPool.apy_rate / 100 / 365, 6)} {selectedPool.assets?.symbol}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Est. yearly reward</span>
                    <span className="text-brand-400">{formatNumber(parseFloat(stakeAmount) * selectedPool.apy_rate / 100, 4)} {selectedPool.assets?.symbol}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Unlocks</span>
                    <span className="text-gray-200">{new Date(Date.now() + selectedPool.lock_period_days * 86400000).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
              {msg && <p className={`text-xs mb-3 p-2 rounded-lg ${msg.startsWith('Error') || msg.startsWith('Min') || msg.startsWith('Ins') ? 'bg-red-500/10 text-red-400' : 'bg-brand-500/10 text-brand-400'}`}>{msg}</p>}
              <button onClick={handleStake} disabled={submitting || !stakeAmount} className="btn-primary w-full">
                {submitting ? 'Staking...' : 'Stake Now'}
              </button>
            </div>
          ) : (
            <div className="card text-center py-10">
              <Layers size={32} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Select a pool to stake</p>
            </div>
          )}
        </div>
      </div>

      {/* My Stakes */}
      {myStakes.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-white">My Stakes</h2>
          {stakesLoading ? (
            <div className="h-20 bg-dark-800 rounded-xl animate-pulse" />
          ) : (
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-600 text-gray-500 text-xs uppercase">
                    <th className="text-left p-4 font-medium">Pool</th>
                    <th className="text-right p-4 font-medium">Staked</th>
                    <th className="text-right p-4 font-medium">APY</th>
                    <th className="text-right p-4 font-medium">Rewards</th>
                    <th className="text-right p-4 font-medium">Unlocks</th>
                    <th className="text-right p-4 font-medium">Status</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-600">
                  {myStakes.map(stake => {
                    const pool = (stake as any).staking_pools as StakingPool
                    const now = new Date()
                    const unlockAt = new Date(stake.unlock_at)
                    const isLocked = now < unlockAt
                    const daysLeft = Math.max(0, Math.ceil((unlockAt.getTime() - now.getTime()) / 86400000))
                    return (
                      <tr key={stake.id} className="hover:bg-dark-700/40">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {pool?.assets?.icon_url && <img src={pool.assets.icon_url} alt="" className="w-6 h-6 rounded-full" />}
                            <span className="text-gray-200">{pool?.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right font-mono text-gray-200">{formatNumber(stake.amount, 4)}</td>
                        <td className="p-4 text-right text-brand-400">{stake.apy_rate}%</td>
                        <td className="p-4 text-right font-mono text-brand-400">{formatNumber(stake.total_rewards, 6)}</td>
                        <td className="p-4 text-right text-xs text-gray-400">
                          {stake.status === 'active'
                            ? isLocked ? <span className="flex items-center justify-end gap-1"><Clock size={11} /> {daysLeft}d left</span> : 'Ready'
                            : formatDate(stake.withdrawn_at ?? stake.unlock_at)}
                        </td>
                        <td className="p-4 text-right">
                          <span className={`badge ${stake.status === 'active' ? 'bg-brand-500/15 text-brand-400' : 'bg-gray-500/15 text-gray-400'}`}>
                            {stake.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {stake.status === 'active' && (
                            <button onClick={() => handleUnstake(stake)} className="text-xs text-red-400 hover:text-red-300">
                              Unstake
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
