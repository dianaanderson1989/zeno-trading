import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownUp, ArrowLeftRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useWallets } from '@/hooks/useWallets'
import { usePrices } from '@/hooks/usePrices'
import { formatNumber, formatCurrency } from '@/utils/format'
import type { Asset } from '@/types'

export function SwapPage() {
  const user = useAuthStore(s => s.user)
  const { data: wallets = [] } = useWallets()
  const { prices } = usePrices()
  const queryClient = useQueryClient()

  const [fromSymbol, setFromSymbol] = useState('USDT')
  const [toSymbol, setToSymbol] = useState('BTC')
  const [fromAmount, setFromAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')
  const [recentSwaps, setRecentSwaps] = useState<any[]>([])

  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data } = await supabase.from('assets').select('*').eq('is_active', true)
      return (data ?? []) as Asset[]
    },
    staleTime: Infinity,
  })

  useEffect(() => {
    if (!user) return
    supabase.from('swaps')
      .select('*, from_asset:assets!swaps_from_asset_id_fkey(*), to_asset:assets!swaps_to_asset_id_fkey(*)')
      .eq('user_id', user.id)
      .order('executed_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setRecentSwaps(data ?? []))
  }, [user])

  const fromAsset = assets.find(a => a.symbol === fromSymbol)
  const toAsset = assets.find(a => a.symbol === toSymbol)

  const fromWallet = wallets.find(w => w.asset_id === fromAsset?.id)
  const toWallet = wallets.find(w => w.asset_id === toAsset?.id)
  const fromBalance = fromWallet?.balance ?? 0
  const toBalance = toWallet?.balance ?? 0

  const fromPrice = fromAsset ? (Object.values(prices).find(p => p.asset_id === fromAsset.id)?.price ?? 0) : 0
  const toPrice = toAsset ? (Object.values(prices).find(p => p.asset_id === toAsset.id)?.price ?? 0) : 0

  const exchangeRate = toPrice > 0 ? fromPrice / toPrice : 0
  const fromAmt = parseFloat(fromAmount) || 0
  const fee = fromAmt * 0.001
  const toAmount = (fromAmt - fee) * exchangeRate

  const flipAssets = () => {
    setFromSymbol(toSymbol)
    setToSymbol(fromSymbol)
    setFromAmount('')
    setMsg('')
  }

  const handleSwap = async () => {
    if (!user || !fromAsset || !toAsset || fromAmt <= 0) return
    if (fromAmt > fromBalance) { setMsg('Insufficient balance'); return }
    if (fromAsset.id === toAsset.id) { setMsg('Cannot swap same asset'); return }
    if (exchangeRate === 0) { setMsg('Price unavailable'); return }

    setSubmitting(true)
    setMsg('')
    try {
      const { data, error } = await supabase.rpc('execute_swap', {
        p_user_id: user.id,
        p_from_asset_id: fromAsset.id,
        p_to_asset_id: toAsset.id,
        p_from_amount: fromAmt,
        p_exchange_rate: exchangeRate,
      })
      if (error) throw error
      if (!data.success) throw new Error(data.error)

      setMsg(`Swapped ${formatNumber(fromAmt, 4)} ${fromSymbol} → ${formatNumber(data.to_amount, 4)} ${toSymbol}`)
      setFromAmount('')
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })

      // Refresh recent swaps
      const { data: swaps } = await supabase
        .from('swaps')
        .select('*, from_asset:assets!swaps_from_asset_id_fkey(*), to_asset:assets!swaps_to_asset_id_fkey(*)')
        .eq('user_id', user.id)
        .order('executed_at', { ascending: false })
        .limit(10)
      setRecentSwaps(swaps ?? [])
    } catch (e: any) {
      setMsg('Error: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Swap</h1>
        <p className="text-gray-400 text-sm mt-1">Instantly swap between assets at market rate</p>
      </div>

      <div className="card space-y-3">
        {/* From */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-gray-400">From</label>
            <span className="text-xs text-gray-400">Balance: <button onClick={() => setFromAmount(String(fromBalance))} className="text-brand-400 hover:text-brand-300">{formatNumber(fromBalance, 4)} {fromSymbol}</button></span>
          </div>
          <div className="flex gap-2">
            <select
              value={fromSymbol}
              onChange={e => { setFromSymbol(e.target.value); setFromAmount(''); setMsg('') }}
              className="input text-sm w-32 flex-shrink-0"
            >
              {assets.map(a => (
                <option key={a.id} value={a.symbol} disabled={a.symbol === toSymbol}>{a.symbol}</option>
              ))}
            </select>
            <input
              type="number"
              value={fromAmount}
              onChange={e => setFromAmount(e.target.value)}
              placeholder="0.00"
              className="input text-sm flex-1"
            />
          </div>
          {fromPrice > 0 && fromAmt > 0 && (
            <p className="text-xs text-gray-500 mt-1">≈ {formatCurrency(fromAmt * fromPrice)}</p>
          )}
        </div>

        {/* Flip button */}
        <div className="flex justify-center">
          <button
            onClick={flipAssets}
            className="w-9 h-9 rounded-full bg-dark-600 hover:bg-dark-500 border border-dark-400 flex items-center justify-center text-gray-400 hover:text-gray-200 transition-colors"
          >
            <ArrowDownUp size={16} />
          </button>
        </div>

        {/* To */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-gray-400">To</label>
            <span className="text-xs text-gray-400">Balance: {formatNumber(toBalance, 4)} {toSymbol}</span>
          </div>
          <div className="flex gap-2">
            <select
              value={toSymbol}
              onChange={e => { setToSymbol(e.target.value); setMsg('') }}
              className="input text-sm w-32 flex-shrink-0"
            >
              {assets.map(a => (
                <option key={a.id} value={a.symbol} disabled={a.symbol === fromSymbol}>{a.symbol}</option>
              ))}
            </select>
            <div className="input text-sm flex-1 flex items-center font-mono text-gray-300 bg-dark-600 cursor-not-allowed">
              {toAmount > 0 ? formatNumber(toAmount, 6) : '0.00'}
            </div>
          </div>
          {toPrice > 0 && toAmount > 0 && (
            <p className="text-xs text-gray-500 mt-1">≈ {formatCurrency(toAmount * toPrice)}</p>
          )}
        </div>

        {/* Rate + fee summary */}
        {fromAmt > 0 && exchangeRate > 0 && (
          <div className="bg-dark-700 rounded-lg p-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-400">
              <span>Exchange Rate</span>
              <span className="text-gray-200 font-mono">1 {fromSymbol} = {formatNumber(exchangeRate, 6)} {toSymbol}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Fee (0.1%)</span>
              <span className="text-gray-200 font-mono">{formatNumber(fee, 6)} {fromSymbol}</span>
            </div>
            <div className="flex justify-between text-gray-200 font-medium border-t border-dark-500 pt-1.5">
              <span>You receive</span>
              <span className="font-mono text-brand-400">{formatNumber(toAmount, 6)} {toSymbol}</span>
            </div>
          </div>
        )}

        {msg && (
          <p className={`text-xs p-2 rounded-lg ${msg.startsWith('Error') || msg === 'Insufficient balance' || msg.startsWith('Cannot') || msg.startsWith('Price')
            ? 'bg-red-500/10 text-red-400'
            : 'bg-brand-500/10 text-brand-400'}`}>
            {msg}
          </p>
        )}

        <button
          onClick={handleSwap}
          disabled={submitting || fromAmt <= 0 || exchangeRate === 0}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2"
        >
          <ArrowLeftRight size={16} />
          {submitting ? 'Swapping...' : `Swap ${fromSymbol} → ${toSymbol}`}
        </button>
      </div>

      {/* Recent swaps */}
      {recentSwaps.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Recent Swaps</h2>
          <div className="space-y-2">
            {recentSwaps.map((swap: any) => (
              <div key={swap.id} className="flex items-center justify-between py-2 border-b border-dark-600 last:border-0 text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <span className="font-mono">{formatNumber(swap.from_amount, 4)}</span>
                  <span className="text-gray-500">{swap.from_asset?.symbol}</span>
                  <ArrowLeftRight size={12} className="text-gray-500" />
                  <span className="font-mono">{formatNumber(swap.to_amount, 4)}</span>
                  <span className="text-gray-500">{swap.to_asset?.symbol}</span>
                </div>
                <span className="text-xs text-gray-500">{new Date(swap.executed_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
