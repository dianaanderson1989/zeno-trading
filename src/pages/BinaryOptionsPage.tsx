import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Clock, Trophy, XCircle, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useWallets } from '@/hooks/useWallets'
import { usePrices } from '@/hooks/usePrices'
import { formatCurrency, formatNumber, formatDate } from '@/utils/format'
import type { Asset } from '@/types'

const DURATIONS = [
  { label: '30s', seconds: 30, base: 15, minStake: 1, maxStake: 100, bonus: 0 },
  { label: '60s', seconds: 60, base: 25, minStake: 1, maxStake: 500, bonus: 2 },
  { label: '90s', seconds: 90, base: 35, minStake: 1, maxStake: 1000, bonus: 3 },
  { label: '120s', seconds: 120, base: 45, minStake: 1, maxStake: 2000, bonus: 5 },
  { label: '1 Day', seconds: 86400, base: 60, minStake: 1, maxStake: 5000, bonus: 8 },
]

function getPayout(durationSeconds: number, stake: number) {
  const d = DURATIONS.find(d => d.seconds === durationSeconds) ?? DURATIONS[0]
  const bonus = stake > d.maxStake ? d.bonus : 0
  return { base: d.base, bonus, total: d.base + bonus }
}

function Countdown({ exitTime, onExpire }: { exitTime: string; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(0)
  const called = useRef(false)

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, new Date(exitTime).getTime() - Date.now())
      setRemaining(diff)
      if (diff === 0 && !called.current) {
        called.current = true
        onExpire()
      }
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [exitTime])

  const secs = Math.ceil(remaining / 1000)
  const isDay = secs > 3600
  const display = isDay
    ? `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
    : `${secs}s`

  return (
    <span className={`font-mono font-bold ${secs <= 10 && !isDay ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>
      {display}
    </span>
  )
}

export function BinaryOptionsPage() {
  const user = useAuthStore(s => s.user)
  const { data: wallets = [] } = useWallets()
  const { prices } = usePrices()
  const queryClient = useQueryClient()

  const [selectedSymbol, setSelectedSymbol] = useState('BTC')
  const [duration, setDuration] = useState(60)
  const [stake, setStake] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data } = await supabase.from('assets').select('*').eq('is_active', true)
      return (data ?? []) as Asset[]
    },
    staleTime: Infinity,
  })

  const { data: activeTrades = [], refetch: refetchActive } = useQuery({
    queryKey: ['binary_active', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('binary_options')
        .select('*, assets(*)')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .order('entry_time', { ascending: false })
      return data ?? []
    },
    refetchInterval: 5000,
  })

  const { data: history = [] } = useQuery({
    queryKey: ['binary_history', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('binary_options')
        .select('*, assets(*)')
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .order('exit_time', { ascending: false })
        .limit(20)
      return data ?? []
    },
    staleTime: 10_000,
  })

  const [selectedTrade, setSelectedTrade] = useState<any>(null)

  const selectedAsset = assets.find(a => a.symbol === selectedSymbol)
  const priceFeed = selectedAsset ? Object.values(prices).find(p => p.asset_id === selectedAsset.id) : null
  const currentPrice = priceFeed?.price ?? 0
  const usdtWallet = wallets.find(w => w.assets?.symbol === 'USDT')
  const usdtBalance = usdtWallet?.balance ?? 0

  const stakeNum = parseFloat(stake) || 0
  const payout = getPayout(duration, stakeNum)
  const potentialWin = stakeNum * payout.total / 100
  const potentialReturn = stakeNum + potentialWin

  const tradableAssets = assets.filter(a => a.symbol !== 'USDT')

  const placeTrade = async (direction: 'up' | 'down') => {
    if (!user || !selectedAsset || stakeNum <= 0) return
    if (stakeNum < 1) { setError('Minimum stake is $1'); return }
    if (stakeNum > usdtBalance) { setError('Insufficient USDT balance'); return }
    setSubmitting(true)
    setError('')
    const { data, error } = await supabase.rpc('place_binary_option', {
      p_user_id: user.id,
      p_asset_id: selectedAsset.id,
      p_direction: direction,
      p_duration_seconds: duration,
      p_stake_amount: stakeNum,
      p_entry_price: currentPrice,
    })
    setSubmitting(false)
    if (error || !data.success) { setError(error?.message || data?.error || 'Trade failed'); return }
    setStake('')
    queryClient.invalidateQueries({ queryKey: ['wallets'] })
    refetchActive()
  }

  const resolveExpired = async (trade: any) => {
    const exitPrice = Object.values(prices).find((p: any) => p.asset_id === trade.asset_id)?.price ?? trade.entry_price
    await supabase.rpc('resolve_binary_option', {
      p_trade_id: trade.id,
      p_exit_price: exitPrice,
    })
    queryClient.invalidateQueries({ queryKey: ['binary_active'] })
    queryClient.invalidateQueries({ queryKey: ['binary_history'] })
    queryClient.invalidateQueries({ queryKey: ['wallets'] })
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
  }

  const winRate = history.length > 0
    ? Math.round(history.filter((h: any) => h.result === 'win').length / history.length * 100)
    : 0
  const totalPnl = history.reduce((s: number, h: any) => s + (h.profit_loss ?? 0), 0)

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Binary Options</h1>
          <p className="text-gray-400 text-sm mt-1">Predict price direction and earn fixed returns</p>
        </div>
        <div className="text-sm text-gray-400">
          Balance: <span className="text-white font-mono font-semibold">{formatCurrency(usdtBalance)}</span>
        </div>
      </div>

      {/* Stats row */}
      {history.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <p className="text-xs text-gray-400 mb-1">Total Trades</p>
            <p className="text-2xl font-bold text-white">{history.length}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-400 mb-1">Win Rate</p>
            <p className="text-2xl font-bold text-brand-400">{winRate}%</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-400 mb-1">Total P&L</p>
            <p className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trade form */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card">
            <h2 className="font-semibold text-white mb-4">Place Trade</h2>

            {/* Asset selector */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1.5">Asset</label>
              <div className="flex flex-wrap gap-2">
                {tradableAssets.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedSymbol(a.symbol)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      selectedSymbol === a.symbol
                        ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                        : 'border-dark-500 text-gray-400 hover:border-dark-400'
                    }`}
                  >
                    {a.icon_url && <img src={a.icon_url} className="w-4 h-4 rounded-full" alt="" />}
                    {a.symbol}
                  </button>
                ))}
              </div>
            </div>

            {/* Current price */}
            {priceFeed && (
              <div className="bg-dark-700 rounded-lg p-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">{selectedSymbol}/USDT</span>
                  <span className="font-mono font-bold text-white">{formatCurrency(currentPrice)}</span>
                </div>
              </div>
            )}

            {/* Duration */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1.5">Duration</label>
              <div className="grid grid-cols-5 gap-1">
                {DURATIONS.map(d => (
                  <button
                    key={d.seconds}
                    onClick={() => setDuration(d.seconds)}
                    className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                      duration === d.seconds
                        ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                        : 'border-dark-500 text-gray-400 hover:border-dark-400'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stake */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1.5">Stake Amount (USDT)</label>
              <input
                type="number"
                value={stake}
                onChange={e => setStake(e.target.value)}
                placeholder="Min $1"
                className="input text-sm"
              />
              <div className="flex gap-1.5 mt-1.5">
                {[10, 50, 100, 500].map(amt => (
                  <button key={amt} onClick={() => setStake(String(Math.min(amt, usdtBalance)))}
                    className="flex-1 py-1 text-xs text-gray-400 hover:text-gray-200 bg-dark-700 hover:bg-dark-600 rounded transition-colors">
                    ${amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Payout preview */}
            {stakeNum > 0 && (
              <div className="bg-dark-700 rounded-lg p-3 mb-4 space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-400">
                  <span>Base Payout</span>
                  <span className="text-gray-200">{payout.base}%</span>
                </div>
                {payout.bonus > 0 && (
                  <div className="flex justify-between text-gray-400">
                    <span>High-Roller Bonus</span>
                    <span className="text-yellow-400">+{payout.bonus}%</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-400 border-t border-dark-500 pt-1.5">
                  <span>Total Payout</span>
                  <span className="text-brand-400 font-semibold">{payout.total}%</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Profit if Win</span>
                  <span className="text-brand-400 font-mono">+{formatCurrency(potentialWin)}</span>
                </div>
                <div className="flex justify-between text-gray-200 font-medium">
                  <span>Return if Win</span>
                  <span className="font-mono">{formatCurrency(potentialReturn)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Loss if Lose</span>
                  <span className="text-red-400 font-mono">-{formatCurrency(stakeNum)}</span>
                </div>
              </div>
            )}

            {error && <p className="text-red-400 text-xs mb-3 bg-red-500/10 rounded-lg p-2">{error}</p>}

            {/* Up / Down buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => placeTrade('up')}
                disabled={submitting || stakeNum <= 0 || currentPrice === 0}
                className="py-3 rounded-lg font-bold text-sm bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <TrendingUp size={16} /> UP
              </button>
              <button
                onClick={() => placeTrade('down')}
                disabled={submitting || stakeNum <= 0 || currentPrice === 0}
                className="py-3 rounded-lg font-bold text-sm bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <TrendingDown size={16} /> DOWN
              </button>
            </div>
          </div>
        </div>

        {/* Right: active trades + history */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active trades */}
          {activeTrades.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Clock size={15} className="text-yellow-400" />
                Active Trades ({activeTrades.length})
              </h2>
              <div className="space-y-3">
                {activeTrades.map((trade: any) => {
                  const livePrice = Object.values(prices).find((p: any) => p.asset_id === trade.asset_id)?.price ?? 0
                  const priceUp = livePrice >= trade.entry_price
                  const winning = (trade.direction === 'up' && priceUp) || (trade.direction === 'down' && !priceUp)
                  return (
                    <div key={trade.id} className={`bg-dark-700 rounded-xl p-4 border ${winning ? 'border-brand-500/30' : 'border-red-500/30'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {trade.assets?.icon_url && <img src={trade.assets.icon_url} className="w-5 h-5 rounded-full" alt="" />}
                          <span className="font-medium text-gray-200">{trade.assets?.symbol}/USDT</span>
                          <span className={`badge text-xs ${trade.direction === 'up' ? 'bg-brand-500/15 text-brand-400' : 'bg-red-500/15 text-red-400'}`}>
                            {trade.direction === 'up' ? '▲ UP' : '▼ DOWN'}
                          </span>
                        </div>
                        <Countdown exitTime={trade.exit_time} onExpire={() => resolveExpired(trade)} />
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div><p className="text-gray-500">Entry</p><p className="text-gray-200 font-mono">{formatCurrency(trade.entry_price)}</p></div>
                        <div><p className="text-gray-500">Current</p><p className={`font-mono ${winning ? 'text-brand-400' : 'text-red-400'}`}>{formatCurrency(livePrice)}</p></div>
                        <div><p className="text-gray-500">Stake</p><p className="text-gray-200 font-mono">{formatCurrency(trade.stake_amount)}</p></div>
                        <div><p className="text-gray-500">Payout</p><p className="text-brand-400 font-mono">{trade.total_payout_percent}%</p></div>
                      </div>
                      <div className={`mt-2 text-xs text-center py-1 rounded-lg ${winning ? 'bg-brand-500/10 text-brand-400' : 'bg-red-500/10 text-red-400'}`}>
                        {winning ? '✓ Currently Winning' : '✗ Currently Losing'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* History */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4">Trade History</h2>
            {history.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No completed trades yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-600 text-gray-500 text-xs uppercase">
                      <th className="text-left pb-3 font-medium">Asset</th>
                      <th className="text-left pb-3 font-medium">Direction</th>
                      <th className="text-right pb-3 font-medium">Stake</th>
                      <th className="text-right pb-3 font-medium">Payout</th>
                      <th className="text-left pb-3 font-medium">Result</th>
                      <th className="text-right pb-3 font-medium">P&L</th>
                      <th className="text-right pb-3 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-600">
                    {history.map((h: any) => (
                      <tr
                        key={h.id}
                        className="hover:bg-dark-700/40 cursor-pointer"
                        onClick={() => setSelectedTrade(h)}
                      >
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {h.assets?.icon_url && <img src={h.assets.icon_url} className="w-5 h-5 rounded-full" alt="" />}
                            <span className="text-gray-200">{h.assets?.symbol}</span>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className={`badge ${h.direction === 'up' ? 'bg-brand-500/15 text-brand-400' : 'bg-red-500/15 text-red-400'}`}>
                            {h.direction === 'up' ? '▲ UP' : '▼ DOWN'}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono text-gray-200">{formatCurrency(h.stake_amount)}</td>
                        <td className="py-3 text-right text-brand-400">{h.total_payout_percent}%</td>
                        <td className="py-3">
                          {h.result === 'win'
                            ? <span className="flex items-center gap-1 text-brand-400"><Trophy size={13} /> Win</span>
                            : <span className="flex items-center gap-1 text-red-400"><XCircle size={13} /> Lose</span>
                          }
                        </td>
                        <td className={`py-3 text-right font-mono font-semibold ${h.profit_loss >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                          {h.profit_loss >= 0 ? '+' : ''}{formatCurrency(h.profit_loss)}
                        </td>
                        <td className="py-3 text-right text-xs text-gray-500">{formatDate(h.exit_time)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trade detail modal */}
      {selectedTrade && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTrade(null)}>
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Trade Detail</h2>
              <button onClick={() => setSelectedTrade(null)} className="text-gray-500 hover:text-gray-300">✕</button>
            </div>

            <div className="flex items-center justify-center mb-5">
              {selectedTrade.result === 'win'
                ? <div className="w-16 h-16 rounded-full bg-brand-500/20 flex items-center justify-center"><Trophy size={32} className="text-brand-400" /></div>
                : <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center"><XCircle size={32} className="text-red-400" /></div>
              }
            </div>
            <p className={`text-center text-2xl font-bold mb-5 ${selectedTrade.result === 'win' ? 'text-brand-400' : 'text-red-400'}`}>
              {selectedTrade.result === 'win' ? `+${formatCurrency(selectedTrade.profit_loss)}` : formatCurrency(selectedTrade.profit_loss)}
            </p>

            <div className="space-y-3 text-sm">
              {[
                { label: 'Asset', value: `${selectedTrade.assets?.symbol}/USDT` },
                { label: 'Direction', value: selectedTrade.direction === 'up' ? '▲ UP' : '▼ DOWN' },
                { label: 'Duration', value: selectedTrade.duration_seconds === 86400 ? '1 Day' : `${selectedTrade.duration_seconds}s` },
                { label: 'Stake Amount', value: formatCurrency(selectedTrade.stake_amount) },
                { label: 'Payout %', value: `${selectedTrade.total_payout_percent}%${selectedTrade.high_roller_bonus > 0 ? ` (incl. +${selectedTrade.high_roller_bonus}% bonus)` : ''}` },
                { label: 'Entry Price', value: formatCurrency(selectedTrade.entry_price) },
                { label: 'Exit Price', value: formatCurrency(selectedTrade.exit_price) },
                { label: 'Entry Time', value: formatDate(selectedTrade.entry_time) },
                { label: 'Exit Time', value: formatDate(selectedTrade.exit_time) },
                { label: 'Outcome', value: selectedTrade.result === 'win' ? '✓ Win' : '✗ Lose' },
                { label: 'Payout Received', value: selectedTrade.result === 'win' ? formatCurrency(selectedTrade.payout_amount) : '$0.00' },
                { label: 'Net P&L', value: `${selectedTrade.profit_loss >= 0 ? '+' : ''}${formatCurrency(selectedTrade.profit_loss)}` },
              ].map(row => (
                <div key={row.label} className="flex justify-between border-b border-dark-600 pb-2 last:border-0">
                  <span className="text-gray-400">{row.label}</span>
                  <span className="text-gray-200 font-medium">{row.value}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedTrade(null)} className="btn-secondary w-full mt-5">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
