import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePrices } from '@/hooks/usePrices'
import { useWallets } from '@/hooks/useWallets'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatNumber, formatPercent, formatDate, getChangeColor, getChangeBg } from '@/utils/format'
import type { Order, Asset } from '@/types'

export function TradingPage() {
  const { symbol } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const { prices } = usePrices()
  const { data: wallets = [] } = useWallets()
  const queryClient = useQueryClient()

  const [selectedSymbol, setSelectedSymbol] = useState(symbol || 'BTC')
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [quantity, setQuantity] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { if (symbol) setSelectedSymbol(symbol) }, [symbol])

  // All tradable assets (not USDT)
  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data } = await supabase.from('assets').select('*').eq('is_active', true)
      return (data ?? []) as Asset[]
    },
    staleTime: Infinity,
  })

  const tradableAssets = assets.filter(a => a.symbol !== 'USDT')
  const selectedAsset = assets.find(a => a.symbol === selectedSymbol)
  const usdtAsset = assets.find(a => a.symbol === 'USDT')

  const priceFeed = selectedAsset
    ? Object.values(prices).find(p => p.asset_id === selectedAsset.id)
    : null

  const currentPrice = priceFeed?.price ?? 0

  // Wallet balances
  const baseWallet = wallets.find(w => w.asset_id === selectedAsset?.id)
  const quoteWallet = wallets.find(w => w.asset_id === usdtAsset?.id)
  const baseBalance = baseWallet?.balance ?? 0
  const quoteBalance = quoteWallet?.balance ?? 0

  const execPrice = orderType === 'limit' && limitPrice ? parseFloat(limitPrice) : currentPrice
  const qty = parseFloat(quantity) || 0
  const total = qty * execPrice
  const fee = total * 0.001

  const setPercentage = (pct: number) => {
    if (side === 'buy') {
      const maxQty = (quoteBalance * pct) / execPrice
      setQuantity(maxQty.toFixed(6))
    } else {
      setQuantity((baseBalance * pct).toFixed(6))
    }
  }

  const handleTrade = async () => {
    if (!user || !selectedAsset || !usdtAsset || qty <= 0) return
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      if (orderType === 'market') {
        const { data, error } = await supabase.rpc('execute_market_order', {
          p_user_id: user.id,
          p_base_asset_id: selectedAsset.id,
          p_quote_asset_id: usdtAsset.id,
          p_side: side,
          p_quantity: qty,
          p_price: currentPrice,
        })
        if (error) throw error
        if (!data.success) throw new Error(data.error)
        setSuccess(`${side === 'buy' ? 'Bought' : 'Sold'} ${formatNumber(qty, 4)} ${selectedSymbol} at ${formatCurrency(currentPrice)}`)
        setQuantity('')
        queryClient.invalidateQueries({ queryKey: ['wallets'] })
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        // Notify user of trade settlement
        supabase.from('notifications').insert({
          user_id: user.id,
          type: side === 'buy' ? 'trade_win' : 'trade_win',
          title: `${side === 'buy' ? '🟢 Buy' : '🔴 Sell'} Order Filled`,
          message: `${side === 'buy' ? 'Bought' : 'Sold'} ${formatNumber(qty, 4)} ${selectedSymbol} at ${formatCurrency(currentPrice)}. Total: ${formatCurrency(total)}.`,
          metadata: { side, symbol: selectedSymbol, quantity: qty, price: currentPrice, total },
        })
        // Trigger referral reward on first trade
        supabase.rpc('process_referral_reward', { p_user_id: user.id }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['my_referrals'] })
        })
      } else {
        // Limit order — just store it as pending
        const { error } = await supabase.from('orders').insert({
          user_id: user.id,
          base_asset_id: selectedAsset.id,
          quote_asset_id: usdtAsset.id,
          order_type: 'limit',
          side,
          quantity: qty,
          price: execPrice,
          status: 'pending',
        })
        if (error) throw error
        setSuccess(`Limit ${side} order placed for ${formatNumber(qty, 4)} ${selectedSymbol} at ${formatCurrency(execPrice)}`)
        setQuantity('')
        setLimitPrice('')
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        // Trigger referral reward on first trade
        supabase.rpc('process_referral_reward', { p_user_id: user.id }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['my_referrals'] })
        })
      }
    } catch (e: any) {
      setError(e.message || 'Trade failed')
    } finally {
      setSubmitting(false)
    }
  }

  // Recent orders
  const { data: orders = [] } = useQuery({
    queryKey: ['orders', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, base_asset:assets!orders_base_asset_id_fkey(*), quote_asset:assets!orders_quote_asset_id_fkey(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20)
      return (data ?? []) as Order[]
    },
    staleTime: 10_000,
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Trade</h1>
        <div className="text-sm text-gray-400">
          USDT Balance: <span className="text-white font-mono font-medium">{formatCurrency(quoteBalance)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Asset selector + price info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Asset picker */}
          <div className="card">
            <div className="flex flex-wrap gap-2">
              {tradableAssets.map(asset => {
                const feed = Object.values(prices).find(p => p.asset_id === asset.id)
                const isSelected = asset.symbol === selectedSymbol
                return (
                  <button
                    key={asset.id}
                    onClick={() => { setSelectedSymbol(asset.symbol); navigate(`/trade/${asset.symbol}`) }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                        : 'border-dark-500 bg-dark-700 text-gray-400 hover:border-dark-400 hover:text-gray-200'
                    }`}
                  >
                    {asset.icon_url && <img src={asset.icon_url} alt={asset.symbol} className="w-5 h-5 rounded-full" />}
                    <span className="font-medium text-sm">{asset.symbol}</span>
                    {feed && (
                      <span className={`text-xs ${getChangeColor(feed.change_24h)}`}>
                        {formatPercent(feed.change_24h)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Price display */}
          {priceFeed && selectedAsset && (
            <div className="card">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {selectedAsset.icon_url && (
                    <img src={selectedAsset.icon_url} alt={selectedAsset.symbol} className="w-10 h-10 rounded-full" />
                  )}
                  <div>
                    <p className="text-sm text-gray-400">{selectedAsset.name} / USDT</p>
                    <p className="text-3xl font-bold text-white font-mono">{formatCurrency(priceFeed.price)}</p>
                  </div>
                </div>
                <span className={`badge text-sm px-3 py-1 ${getChangeBg(priceFeed.change_24h)}`}>
                  {priceFeed.change_24h >= 0
                    ? <TrendingUp size={14} className="mr-1 inline" />
                    : <TrendingDown size={14} className="mr-1 inline" />}
                  {formatPercent(priceFeed.change_24h)} 24h
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-dark-600">
                <div>
                  <p className="text-xs text-gray-500">24h High</p>
                  <p className="text-sm text-gray-200 font-mono">{priceFeed.high_24h > 0 ? formatCurrency(priceFeed.high_24h) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">24h Low</p>
                  <p className="text-sm text-gray-200 font-mono">{priceFeed.low_24h > 0 ? formatCurrency(priceFeed.low_24h) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Your {selectedSymbol}</p>
                  <p className="text-sm text-gray-200 font-mono">{formatNumber(baseBalance, 6)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Order history */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4">Order History</h2>
            {orders.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">No orders yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-600 text-gray-500 text-xs uppercase">
                      <th className="text-left pb-2 font-medium">Pair</th>
                      <th className="text-left pb-2 font-medium">Type</th>
                      <th className="text-right pb-2 font-medium">Qty</th>
                      <th className="text-right pb-2 font-medium">Price</th>
                      <th className="text-right pb-2 font-medium">Status</th>
                      <th className="text-right pb-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-600">
                    {orders.map(o => (
                      <tr key={o.id} className="hover:bg-dark-700/40">
                        <td className="py-2.5">
                          <span className={`font-medium ${o.side === 'buy' ? 'text-brand-400' : 'text-red-400'}`}>
                            {o.side.toUpperCase()}
                          </span>
                          <span className="text-gray-400 ml-1 text-xs">{(o as any).base_asset?.symbol}/USDT</span>
                        </td>
                        <td className="py-2.5 text-gray-400 capitalize">{o.order_type}</td>
                        <td className="py-2.5 text-right font-mono text-gray-200">{formatNumber(o.quantity, 4)}</td>
                        <td className="py-2.5 text-right font-mono text-gray-200">
                          {o.average_price ? formatCurrency(o.average_price) : o.price ? formatCurrency(o.price) : '—'}
                        </td>
                        <td className="py-2.5 text-right">
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="py-2.5 text-right text-gray-500 text-xs">{formatDate(o.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Order form */}
        <div className="lg:col-span-1">
          <div className="card sticky top-6">
            {/* Buy / Sell tabs */}
            <div className="flex rounded-lg overflow-hidden border border-dark-500 mb-4">
              <button
                onClick={() => setSide('buy')}
                className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                  side === 'buy' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setSide('sell')}
                className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                  side === 'sell' ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Sell
              </button>
            </div>

            {/* Order type */}
            <div className="flex gap-2 mb-4">
              {(['market', 'limit'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setOrderType(t)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors capitalize ${
                    orderType === t
                      ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                      : 'border-dark-500 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Balance */}
            <div className="bg-dark-700 rounded-lg p-3 mb-4 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Available</span>
                <span className="text-gray-200 font-mono">
                  {side === 'buy'
                    ? `${formatCurrency(quoteBalance)} USDT`
                    : `${formatNumber(baseBalance, 6)} ${selectedSymbol}`}
                </span>
              </div>
            </div>

            {/* Limit price */}
            {orderType === 'limit' && (
              <div className="mb-3">
                <label className="block text-xs text-gray-400 mb-1.5">Limit Price (USDT)</label>
                <input
                  type="number"
                  value={limitPrice}
                  onChange={e => setLimitPrice(e.target.value)}
                  placeholder={formatNumber(currentPrice, 2)}
                  className="input text-sm"
                />
              </div>
            )}

            {/* Quantity */}
            <div className="mb-3">
              <label className="block text-xs text-gray-400 mb-1.5">
                Quantity ({selectedSymbol})
              </label>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="0.00"
                className="input text-sm"
              />
            </div>

            {/* % shortcuts */}
            <div className="flex gap-2 mb-4">
              {[0.25, 0.5, 0.75, 1].map(pct => (
                <button
                  key={pct}
                  onClick={() => setPercentage(pct)}
                  className="flex-1 py-1 text-xs text-gray-400 hover:text-gray-200 bg-dark-700 hover:bg-dark-600 rounded transition-colors"
                >
                  {pct * 100}%
                </button>
              ))}
            </div>

            {/* Order summary */}
            {qty > 0 && (
              <div className="bg-dark-700 rounded-lg p-3 mb-4 space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-400">
                  <span>Price</span>
                  <span className="text-gray-200 font-mono">{formatCurrency(execPrice)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Total</span>
                  <span className="text-gray-200 font-mono">{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Fee (0.1%)</span>
                  <span className="text-gray-200 font-mono">{formatCurrency(fee)}</span>
                </div>
                <div className="flex justify-between border-t border-dark-500 pt-1.5 text-gray-200 font-medium">
                  <span>You {side === 'buy' ? 'pay' : 'receive'}</span>
                  <span className="font-mono">{formatCurrency(side === 'buy' ? total + fee : total - fee)}</span>
                </div>
              </div>
            )}

            {error && <p className="text-red-400 text-xs mb-3 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-brand-400 text-xs mb-3 bg-brand-500/10 rounded-lg px-3 py-2">{success}</p>}

            <button
              onClick={handleTrade}
              disabled={submitting || qty <= 0 || !selectedAsset || currentPrice === 0}
              className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                side === 'buy'
                  ? 'bg-brand-500 hover:bg-brand-600 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              {submitting
                ? 'Processing...'
                : `${side === 'buy' ? 'Buy' : 'Sell'} ${selectedSymbol}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    filled: 'bg-brand-500/15 text-brand-400',
    pending: 'bg-yellow-500/15 text-yellow-400',
    cancelled: 'bg-gray-500/15 text-gray-400',
    rejected: 'bg-red-500/15 text-red-400',
    partial: 'bg-blue-500/15 text-blue-400',
  }
  return (
    <span className={`badge ${map[status] ?? 'bg-gray-500/15 text-gray-400'}`}>
      {status}
    </span>
  )
}
