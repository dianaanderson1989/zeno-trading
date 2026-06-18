import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, ArrowUpRight, Wallet, RefreshCw } from 'lucide-react'
import { useWallets } from '@/hooks/useWallets'
import { usePrices } from '@/hooks/usePrices'
import { useTransactions } from '@/hooks/useTransactions'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatNumber, formatPercent, formatDate, getChangeBg, getChangeColor } from '@/utils/format'

export function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const { data: wallets = [], isLoading: walletsLoading } = useWallets()
  const { prices } = usePrices()
  const { data: transactions = [], isLoading: txLoading } = useTransactions(5)

  const totalValue = wallets.reduce((sum, w) => {
    const feed = prices[w.asset_id]
    return sum + w.balance * (feed?.price ?? 0)
  }, 0)

  const activeWallets = wallets
    .filter(w => w.balance > 0)
    .map(w => ({
      ...w,
      usdValue: w.balance * (prices[w.asset_id]?.price ?? 0),
      change24h: prices[w.asset_id]?.change_24h ?? 0,
    }))
    .sort((a, b) => b.usdValue - a.usdValue)

  const marketData = Object.values(prices)
    .filter(p => p.assets?.symbol !== 'USDT')

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {greeting()}, {user?.first_name || 'Trader'} 👋
          </h1>
          <p className="text-gray-400 text-sm mt-1">Here's your portfolio overview</p>
        </div>
        <button onClick={() => navigate('/trade')} className="btn-primary flex items-center gap-2">
          <TrendingUp size={16} />
          Start Trading
        </button>
      </div>

      <div className="bg-gradient-to-br from-brand-500/20 to-dark-700 border border-brand-500/30 rounded-2xl p-6">
        <p className="text-gray-400 text-sm mb-1">Total Portfolio Value</p>
        {walletsLoading ? (
          <div className="h-10 w-48 bg-dark-600 rounded-lg animate-pulse" />
        ) : (
          <p className="text-4xl font-bold text-white font-mono">{formatCurrency(totalValue, 2)}</p>
        )}
        <div className="flex items-center gap-6 mt-4">
          <button onClick={() => navigate('/wallet')} className="flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition-colors">
            <Wallet size={14} /> View Wallets
          </button>
          <button onClick={() => navigate('/history')} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
            <RefreshCw size={14} /> Transaction History
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">My Balances</h2>
              <button onClick={() => navigate('/wallet')} className="text-xs text-brand-400 hover:text-brand-300">View all →</button>
            </div>
            {walletsLoading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-dark-700 rounded-lg animate-pulse" />)}</div>
            ) : activeWallets.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No balances yet</p>
            ) : (
              <div className="space-y-2">
                {activeWallets.map(w => (
                  <div key={w.id} className="flex items-center justify-between py-2 border-b border-dark-600 last:border-0">
                    <div className="flex items-center gap-3">
                      {w.assets?.icon_url
                        ? <img src={w.assets.icon_url} alt={w.assets.symbol} className="w-7 h-7 rounded-full" />
                        : <div className="w-7 h-7 rounded-full bg-dark-500 flex items-center justify-center text-xs text-gray-300">{w.assets?.symbol?.[0]}</div>
                      }
                      <div>
                        <p className="text-sm font-medium text-gray-200">{w.assets?.symbol}</p>
                        <p className="text-xs text-gray-500">{formatNumber(w.balance, 4)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-200">{formatCurrency(w.usdValue)}</p>
                      <p className={`text-xs ${getChangeColor(w.change24h)}`}>{formatPercent(w.change24h)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Recent Activity</h2>
              <button onClick={() => navigate('/history')} className="text-xs text-brand-400 hover:text-brand-300">View all →</button>
            </div>
            {txLoading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-dark-700 rounded-lg animate-pulse" />)}</div>
            ) : transactions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No transactions yet. Make your first trade!</p>
            ) : (
              <div className="space-y-2">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-dark-600 last:border-0">
                    <div className="flex items-center gap-2">
                      <TxIcon type={tx.transaction_type} />
                      <div>
                        <p className="text-sm text-gray-200 capitalize">{tx.transaction_type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-gray-500">{formatDate(tx.created_at)}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-200 font-mono">{formatNumber(tx.amount, 4)} {tx.assets?.symbol}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Market Overview</h2>
            <button onClick={() => navigate('/trade')} className="text-xs text-brand-400 hover:text-brand-300">Trade →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600 text-gray-500 text-xs uppercase">
                  <th className="text-left pb-3 font-medium">Asset</th>
                  <th className="text-right pb-3 font-medium">Price</th>
                  <th className="text-right pb-3 font-medium">24h</th>
                  <th className="text-right pb-3 font-medium hidden md:table-cell">High</th>
                  <th className="text-right pb-3 font-medium hidden md:table-cell">Low</th>
                  <th className="text-right pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-600">
                {marketData.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-500">Loading market data...</td></tr>
                ) : marketData.map(feed => (
                  <tr key={feed.id} className="hover:bg-dark-700/50 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        {feed.assets?.icon_url
                          ? <img src={feed.assets.icon_url} alt={feed.assets?.symbol} className="w-7 h-7 rounded-full" />
                          : <div className="w-7 h-7 rounded-full bg-dark-500 flex items-center justify-center text-xs">{feed.assets?.symbol?.[0]}</div>
                        }
                        <div>
                          <p className="font-medium text-gray-200">{feed.assets?.symbol}</p>
                          <p className="text-xs text-gray-500">{feed.assets?.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-right font-mono text-gray-200">{formatCurrency(feed.price)}</td>
                    <td className="py-3 text-right">
                      <span className={`badge ${getChangeBg(feed.change_24h)}`}>
                        {feed.change_24h >= 0
                          ? <TrendingUp size={10} className="mr-1 inline" />
                          : <TrendingDown size={10} className="mr-1 inline" />}
                        {formatPercent(feed.change_24h)}
                      </span>
                    </td>
                    <td className="py-3 text-right text-gray-400 font-mono hidden md:table-cell">{feed.high_24h > 0 ? formatCurrency(feed.high_24h) : '—'}</td>
                    <td className="py-3 text-right text-gray-400 font-mono hidden md:table-cell">{feed.low_24h > 0 ? formatCurrency(feed.low_24h) : '—'}</td>
                    <td className="py-3 text-right">
                      <button onClick={() => navigate(`/trade/${feed.assets?.symbol}`)} className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 ml-auto">
                        Trade <ArrowUpRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function TxIcon({ type }: { type: string }) {
  const cls = 'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0'
  if (type.includes('buy')) return <div className={`${cls} bg-brand-500/15 text-brand-400`}><TrendingUp size={13} /></div>
  if (type.includes('sell')) return <div className={`${cls} bg-red-500/15 text-red-400`}><TrendingDown size={13} /></div>
  if (type === 'deposit') return <div className={`${cls} bg-blue-500/15 text-blue-400`}><ArrowUpRight size={13} /></div>
  return <div className={`${cls} bg-gray-500/15 text-gray-400`}><RefreshCw size={13} /></div>
}
