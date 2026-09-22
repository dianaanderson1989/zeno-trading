import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Clock, Trophy, XCircle, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BinaryReceipt } from '@/components/BinaryReceipt'
import { useAuthStore } from '@/stores/authStore'
import { useWallets } from '@/hooks/useWallets'
import { usePrices } from '@/hooks/usePrices'
import { formatCurrency, formatNumber, formatDate } from '@/utils/format'
import type { Asset } from '@/types'

// Fallback durations if DB not loaded yet
const DURATION_FALLBACK = [
  { label: '30s',   seconds: 30,    basePayout: 15, maxStake: 100,   minBalance: 20,     bonus: 0 },
  { label: '60s',   seconds: 60,    basePayout: 25, maxStake: 500,   minBalance: 5000,   bonus: 2 },
  { label: '90s',   seconds: 90,    basePayout: 35, maxStake: 1000,  minBalance: 25000,  bonus: 3 },
  { label: '120s',  seconds: 120,   basePayout: 45, maxStake: 2000,  minBalance: 50000,  bonus: 5 },
  { label: '1 Day', seconds: 86400, basePayout: 60, maxStake: 5000,  minBalance: 100000, bonus: 8 },
]

interface ActiveTrade {
  id: string
  direction: 'up' | 'down'
  stake: number
  entryPrice: number
  exitTime: Date
  duration: number
  payoutPercent: number
  asset: string
  assetId: string
}

export function BinaryPage() {
  const user = useAuthStore(s => s.user)
  const { data: wallets = [] } = useWallets()
  const { prices } = usePrices()
  const queryClient = useQueryClient()

  const [selectedSymbol, setSelectedSymbol] = useState('BTC')
  const [selectedDuration, setSelectedDuration] = useState(DURATION_FALLBACK[1])
  const [stake, setStake] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([])
  const [countdowns, setCountdowns] = useState<Record<string, number>>({})
  const [selectedTrade, setSelectedTrade] = useState<any | null>(null)
  const [resolvedTrade, setResolvedTrade] = useState<any | null>(null)
  const [resolvedTradeTimer, setResolvedTradeTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const timersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data } = await supabase.from('assets').select('*').eq('is_active', true)
      return (data ?? []) as Asset[]
    },
    staleTime: Infinity,
  })

  // Fetch tiers from DB (respects admin config)
  const { data: dbTiers = [] } = useQuery({
    queryKey: ['binary_tier_config'],
    queryFn: async () => {
      const { data } = await supabase.from('binary_tier_config').select('*').eq('is_active', true).order('duration_seconds')
      return data ?? []
    },
    staleTime: 60_000,
  })

  // Use DB tiers if available, else fallback
  const DURATIONS = dbTiers.length > 0
    ? dbTiers.map((t: any) => ({
        label:      t.duration_label,
        seconds:    t.duration_seconds,
        basePayout: Number(t.base_payout_percent),
        maxStake:   Number(t.max_stake),
        minBalance: Number(t.min_balance),
        bonus:      Number(t.high_roller_bonus ?? 0),
      }))
    : DURATION_FALLBACK

  // Sync selectedDuration when DB tiers load
  useEffect(() => {
    if (DURATIONS.length > 0 && selectedDuration.seconds === DURATION_FALLBACK[1].seconds) {
      const match = DURATIONS.find(d => d.seconds === selectedDuration.seconds)
      if (match) setSelectedDuration(match)
    }
  }, [dbTiers.length])

  const { data: history = [] } = useQuery({
    queryKey: ['binary_history', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('binary_options')
        .select('*, assets(*)')
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20)
      return data ?? []
    },
    staleTime: 10_000,
  })

  const tradableAssets = assets.filter(a => a.symbol !== 'USDT')
  const selectedAsset = assets.find(a => a.symbol === selectedSymbol)
  const priceFeed = selectedAsset ? Object.values(prices).find(p => p.asset_id === selectedAsset.id) : null
  const currentPrice = priceFeed?.price ?? 0

  const usdtWallet = wallets.find(w => {
    const usdtAsset = assets.find(a => a.symbol === 'USDT')
    return w.asset_id === usdtAsset?.id
  })
  const usdtBalance = usdtWallet?.balance ?? 0

  const stakeNum = parseFloat(stake) || 0
  const isHighRoller = stakeNum > selectedDuration.maxStake
  const bonusPct = isHighRoller ? selectedDuration.bonus : 0
  const totalPayout = selectedDuration.basePayout + bonusPct
  const potentialWin = stakeNum * (totalPayout / 100)

  // Countdown ticker
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const updated: Record<string, number> = {}
      activeTrades.forEach(t => {
        updated[t.id] = Math.max(0, Math.floor((t.exitTime.getTime() - now) / 1000))
      })
      setCountdowns(updated)
    }, 1000)
    return () => clearInterval(interval)
  }, [activeTrades])

  // Auto-resolve expired trades
  useEffect(() => {
    activeTrades.forEach(trade => {
      const remaining = countdowns[trade.id] ?? 999
      if (remaining === 0 && !timersRef.current[trade.id + '_resolved']) {
        timersRef.current[trade.id + '_resolved'] = setTimeout(async () => {
          const exitPrice = Object.values(prices).find(p => p.asset_id === trade.assetId)?.price ?? trade.entryPrice
          await supabase.rpc('resolve_binary_option', {
            p_trade_id: trade.id,
            p_exit_price: exitPrice,
          })
          setActiveTrades(prev => prev.filter(t => t.id !== trade.id))
          queryClient.invalidateQueries({ queryKey: ['wallets'] })
          queryClient.invalidateQueries({ queryKey: ['binary_history'] })
          queryClient.invalidateQueries({ queryKey: ['transactions'] })
          // Show resolved trade receipt for 30s
          const { data: resolved } = await supabase
            .from('binary_options').select('*, assets(*)')
            .eq('id', trade.id).single()
          if (resolved) {
            setResolvedTrade(resolved)
            const t = setTimeout(() => setResolvedTrade(null), 30000)
            setResolvedTradeTimer(t)
          }
        }, 1500) as any
      }
    })
  }, [countdowns, activeTrades, prices])

  const placeTrade = async (direction: 'up' | 'down') => {
    if (!user || !selectedAsset || stakeNum <= 0 || currentPrice === 0) return
    if (stakeNum > usdtBalance) { setError('Insufficient USDT balance'); return }
    if (stakeNum < 1) { setError('Minimum stake is $1'); return }

    setSubmitting(true)
    setError('')
    try {
      const { data, error: rpcErr } = await supabase.rpc('place_binary_option', {
        p_user_id: user.id,
        p_asset_id: selectedAsset.id,
        p_direction: direction,
        p_duration_seconds: selectedDuration.seconds,
        p_stake_amount: stakeNum,
        p_entry_price: currentPrice,
      })
      if (rpcErr) throw rpcErr
      if (!data.success) throw new Error(data.error)

      setActiveTrades(prev => [...prev, {
        id: data.trade_id,
        direction,
        stake: stakeNum,
        entryPrice: currentPrice,
        exitTime: new Date(data.exit_time),
        duration: selectedDuration.seconds,
        payoutPercent: data.payout_percent,
        asset: selectedSymbol,
        assetId: selectedAsset.id,
      }])
      setStake('')
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatCountdown = (secs: number) => {
    if (secs >= 3600) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
    if (secs >= 60) return `${Math.floor(secs / 60)}m ${secs % 60}s`
    return `${secs}s`
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap size={22} className="text-brand-400" /> Binary Options
          </h1>
          <p className="text-gray-400 text-sm mt-1">Predict price direction and earn fixed payouts</p>
        </div>
        <div className="text-sm text-gray-400">
          Balance: <span className="text-white font-mono font-semibold">{formatCurrency(usdtBalance)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Left: asset + duration + trade form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Asset selector */}
          <div className="card">
            <p className="text-xs text-gray-400 mb-2">Select Asset</p>
            <div className="flex flex-wrap gap-2">
              {tradableAssets.map(a => {
                const feed = Object.values(prices).find(p => p.asset_id === a.id)
                return (
                  <button key={a.id} onClick={() => setSelectedSymbol(a.symbol)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      selectedSymbol === a.symbol
                        ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                        : 'border-dark-500 bg-dark-700 text-gray-400 hover:text-gray-200'
                    }`}>
                    {a.icon_url && <img src={a.icon_url} alt={a.symbol} className="w-4 h-4 rounded-full" />}
                    {a.symbol}
                    {feed && <span className={`text-xs ${feed.change_24h >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                      {feed.change_24h >= 0 ? '↑' : '↓'}
                    </span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Current price */}
          {priceFeed && (
            <div className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedAsset?.icon_url && <img src={selectedAsset.icon_url} alt="" className="w-9 h-9 rounded-full" />}
                <div>
                  <p className="text-xs text-gray-400">{selectedSymbol} / USDT</p>
                  <p className="text-2xl font-bold text-white font-mono">{formatCurrency(currentPrice)}</p>
                </div>
              </div>
              <div className={`text-sm font-medium ${priceFeed.change_24h >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                {priceFeed.change_24h >= 0 ? '▲' : '▼'} {Math.abs(priceFeed.change_24h).toFixed(2)}% 24h
              </div>
            </div>
          )}

          {/* Duration selector */}
          <div className="card">
            <p className="text-xs text-gray-400 mb-3">Expiry Duration</p>
            {/* Duration picker — horizontal scroll on mobile, grid on desktop */}
            <div className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible scrollbar-none">
              {DURATIONS.map(d => {
                const minBal = d.minBalance ?? 0
                const isLocked = usdtBalance < minBal
                const isSelected = selectedDuration.seconds === d.seconds
                return (
                  <button key={d.seconds}
                    onClick={() => !isLocked && setSelectedDuration(d)}
                    disabled={isLocked}
                    title={isLocked ? `Requires $${minBal.toLocaleString()} balance` : ''}
                    className={`relative flex flex-col items-center py-3 px-3 rounded-xl border transition-all flex-shrink-0 min-w-[72px] lg:min-w-0 ${
                      isLocked
                        ? 'border-white/[0.04] bg-dark-800 opacity-50 cursor-not-allowed'
                        : isSelected
                        ? 'border-neon-green/40 bg-neon-green/10'
                        : 'border-white/[0.06] bg-dark-800 hover:border-white/10'
                    }`}>
                    {isLocked && (
                      <span className="absolute top-1 right-1 text-[8px] text-slate-500">🔒</span>
                    )}
                    <span className={`text-sm font-bold ${isSelected ? 'text-neon-green' : isLocked ? 'text-slate-600' : 'text-slate-200'}`}>
                      {d.label}
                    </span>
                    <span className={`text-xs mt-1 font-semibold ${isLocked ? 'text-slate-600' : 'text-neon-green'}`}>{d.basePayout}%</span>
                    {d.bonus > 0 && !isLocked && <span className="text-[10px] text-yellow-400">+{d.bonus}%</span>}
                    {isLocked && minBal > 0 && (
                      <span className="text-[9px] text-slate-600 mt-0.5">${(minBal/1000).toFixed(0)}k min</span>
                    )}
                  </button>
                )
              })}
            </div>
            {selectedDuration.bonus > 0 && (
              <p className="text-xs text-yellow-400 mt-2">
                * High-roller bonus: +{selectedDuration.bonus}% if stake {'>'} {formatCurrency(selectedDuration.maxStake)}
              </p>
            )}
          </div>

          {/* Active trades */}
          {activeTrades.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-white">Active Trades</p>
              {activeTrades.map(trade => {
                const secs = countdowns[trade.id] ?? 0
                const pct = Math.max(0, (secs / trade.duration) * 100)
                const currentP = Object.values(prices).find(p => p.asset_id === trade.assetId)?.price ?? trade.entryPrice
                const isWinning = trade.direction === 'up' ? currentP > trade.entryPrice : currentP < trade.entryPrice
                return (
                  <div key={trade.id} className={`card border border-yellow-500/30 bg-yellow-500/[0.03]`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`badge ${trade.direction === 'up' ? 'bg-brand-500/15 text-brand-400' : 'bg-red-500/15 text-red-400'}`}>
                          {trade.direction === 'up' ? '▲ UP' : '▼ DOWN'}
                        </span>
                        <span className="text-gray-300 text-sm font-medium">{trade.asset}/USDT</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-mono">
                        <Clock size={13} className="text-gray-400" />
                        <span className={secs <= 5 ? 'text-neon-red font-bold animate-pulse' : secs <= 15 ? 'text-yellow-400 font-bold' : 'text-slate-200'}>
                          {formatCountdown(secs)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-dark-600 rounded-full h-1.5 mb-2">
                      <div
                        className="h-1.5 rounded-full transition-all bg-yellow-400" 
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Entry: <span className="text-gray-200 font-mono">{formatCurrency(trade.entryPrice)}</span></span>
                      <span>Now: <span className={`font-mono ${isWinning ? 'text-brand-400' : 'text-red-400'}`}>{formatCurrency(currentP)}</span></span>
                      <span>Stake: <span className="text-gray-200 font-mono">{formatCurrency(trade.stake)}</span></span>
                      <span>Payout: <span className="text-brand-400">{trade.payoutPercent}%</span></span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: trade form */}
        <div className="lg:col-span-1">
          <div className="card sticky top-6 space-y-4">
            <h3 className="font-semibold text-white">Place Trade</h3>

            <div className="bg-dark-700 rounded-lg p-3 text-xs space-y-1">
              <div className="flex justify-between text-gray-400">
                <span>Asset</span><span className="text-gray-200">{selectedSymbol}/USDT</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Duration</span><span className="text-gray-200">{selectedDuration.label}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Base Payout</span><span className="text-brand-400">{selectedDuration.basePayout}%</span>
              </div>
              {isHighRoller && (
                <div className="flex justify-between text-gray-400">
                  <span>High-roller Bonus</span><span className="text-yellow-400">+{selectedDuration.bonus}%</span>
                </div>
              )}
              <div className="flex justify-between text-gray-200 font-semibold border-t border-dark-500 pt-1">
                <span>Total Payout</span><span className="text-brand-400">{totalPayout}%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Stake Amount (USDT)</label>
              <input
                type="number"
                value={stake}
                onChange={e => setStake(e.target.value)}
                placeholder="Min $1"
                className="input text-sm"
                min="1"
              />
              <div className="flex gap-1.5 mt-1.5">
                {[10, 50, 100, 500].map(v => (
                  <button key={v} onClick={() => setStake(String(Math.min(v, usdtBalance)))}
                    className="flex-1 py-1 text-xs bg-dark-600 hover:bg-dark-500 text-gray-400 hover:text-gray-200 rounded transition-colors">
                    ${v}
                  </button>
                ))}
              </div>
            </div>

            {stakeNum > 0 && (
              <div className="bg-dark-700 rounded-lg p-3 text-xs space-y-1">
                <div className="flex justify-between text-gray-400">
                  <span>If Win</span>
                  <span className="text-brand-400 font-semibold">+{formatCurrency(potentialWin)} ({totalPayout}%)</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>If Lose</span>
                  <span className="text-red-400">-{formatCurrency(stakeNum)}</span>
                </div>
                <div className="flex justify-between text-gray-200 font-medium border-t border-dark-500 pt-1">
                  <span>Total return if win</span>
                  <span className="text-brand-400">{formatCurrency(stakeNum + potentialWin)}</span>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2">{error}</p>}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => placeTrade('up')}
                disabled={submitting || stakeNum <= 0 || currentPrice === 0}
                className="py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-colors disabled:opacity-50 flex flex-col items-center gap-0.5"
              >
                <TrendingUp size={18} />
                UP
              </button>
              <button
                onClick={() => placeTrade('down')}
                disabled={submitting || stakeNum <= 0 || currentPrice === 0}
                className="py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors disabled:opacity-50 flex flex-col items-center gap-0.5"
              >
                <TrendingDown size={18} />
                DOWN
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Trade history */}
      {history.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Trade History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600 text-gray-500 text-xs uppercase">
                  <th className="text-left pb-3 font-medium">Asset</th>
                  <th className="text-left pb-3 font-medium">Direction</th>
                  <th className="text-right pb-3 font-medium">Stake</th>
                  <th className="text-right pb-3 font-medium">Entry</th>
                  <th className="text-right pb-3 font-medium">Exit</th>
                  <th className="text-right pb-3 font-medium">Payout</th>
                  <th className="text-left pb-3 font-medium">Result</th>
                  <th className="text-right pb-3 font-medium">P&L</th>
                  <th className="text-right pb-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-600">
                {history.map((t: any) => {
                  const pnl = t.outcome === 'win'
                    ? t.payout_amount - t.stake_amount
                    : -t.stake_amount
                  return (
                    <tr key={t.id} onClick={() => setSelectedTrade(t)}
                      className="hover:bg-neon-green/5 cursor-pointer transition-colors border-b border-white/[0.04] last:border-0">
                      <td className="py-2.5 flex items-center gap-2">
                        {t.assets?.icon_url && <img src={t.assets.icon_url} alt="" className="w-5 h-5 rounded-full" />}
                        <span className="text-gray-200">{t.assets?.symbol}</span>
                      </td>
                      <td className="py-2.5">
                        <span className={`badge ${t.direction === 'up' ? 'bg-brand-500/15 text-brand-400' : 'bg-red-500/15 text-red-400'}`}>
                          {t.direction === 'up' ? '▲ UP' : '▼ DOWN'}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono text-gray-200">{formatCurrency(t.stake_amount)}</td>
                      <td className="py-2.5 text-right font-mono text-gray-400">{formatCurrency(t.entry_price)}</td>
                      <td className="py-2.5 text-right font-mono text-gray-400">{t.exit_price ? formatCurrency(t.exit_price) : '—'}</td>
                      <td className="py-2.5 text-right text-brand-400">{t.total_payout_percent}%</td>
                      <td className="py-2.5">
                        {t.outcome === 'win'
                          ? <span className="flex items-center gap-1 text-brand-400"><Trophy size={13} /> WIN</span>
                          : <span className="flex items-center gap-1 text-red-400"><XCircle size={13} /> LOSE</span>}
                      </td>
                      <td className={`py-2.5 text-right font-mono font-semibold ${pnl >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                      </td>
                      <td className="py-2.5 text-right text-xs text-gray-500">{formatDate(t.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
