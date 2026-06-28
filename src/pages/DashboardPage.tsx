import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, ArrowUpRight, Zap, RefreshCw, ArrowLeftRight } from 'lucide-react'
import { useWallets } from '@/hooks/useWallets'
import { usePrices } from '@/hooks/usePrices'
import { useTransactions } from '@/hooks/useTransactions'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatNumber, formatPercent, formatDate } from '@/utils/format'

export function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const { data: wallets = [], isLoading: walletsLoading } = useWallets()
  const { prices } = usePrices()
  const { data: transactions = [] } = useTransactions(6)

  const totalValue = wallets.reduce((sum, w) => sum + w.balance * (prices[w.asset_id]?.price ?? 0), 0)
  const activeWallets = wallets
    .filter(w => w.balance > 0)
    .map(w => ({ ...w, usdValue: w.balance * (prices[w.asset_id]?.price ?? 0), change24h: prices[w.asset_id]?.change_24h ?? 0 }))
    .sort((a, b) => b.usdValue - a.usdValue)

  const marketData = Object.values(prices).filter(p => p.assets?.symbol !== 'USDT')

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">
            {greeting()}, {user?.first_name || 'Trader'} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Your portfolio at a glance</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/binary')} className="btn-primary flex items-center gap-2 text-sm py-2">
            <Zap size={14} /> Binary
          </button>
          <button onClick={() => navigate('/trade')} className="btn-secondary flex items-center gap-2 text-sm py-2">
            <TrendingUp size={14} /> Trade
          </button>
        </div>
      </div>

      {/* Portfolio card */}
      <div className="relative overflow-hidden rounded-2xl p-6 border border-neon-green/20"
        style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.06) 0%, rgba(0,212,255,0.04) 50%, rgba(10,15,30,0.8) 100%)' }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #00ff88, transparent)' }} />
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-2">Total Portfolio Value</p>
        {walletsLoading
          ? <div className="h-12 w-52 rounded-xl shimmer" />
          : <p className="text-5xl font-black text-white font-mono tracking-tight" style={{ textShadow: '0 0 40px rgba(0,255,136,0.2)' }}>
              {formatCurrency(totalValue)}
            </p>}
        <div className="flex gap-4 mt-4">
          <button onClick={() => navigate('/wallet')} className="text-xs text-neon-green/70 hover:text-neon-green transition-colors font-medium">
            Wallet →
          </button>
          <button onClick={() => navigate('/history')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            History →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="space-y-5">
          {/* Balances */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Balances</h2>
              <button onClick={() => navigate('/wallet')} className="text-xs text-neon-green/60 hover:text-neon-green">All →</button>
            </div>
            {walletsLoading
              ? <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg shimmer" />)}</div>
              : activeWallets.length === 0
                ? <p className="text-slate-600 text-sm text-center py-4">No balances — deposit to start</p>
                : <div className="space-y-1">
                    {activeWallets.slice(0, 6).map(w => (
                      <div key={w.id} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                        <div className="flex items-center gap-2.5">
                          {w.assets?.icon_url
                            ? <img src={w.assets.icon_url} alt="" className="w-7 h-7 rounded-full" />
                            : <div className="w-7 h-7 rounded-full bg-dark-600 flex items-center justify-center text-xs text-slate-400">{w.assets?.symbol?.[0]}</div>}
                          <div>
                            <p className="text-sm font-semibold text-slate-200">{w.assets?.symbol}</p>
                            <p className="text-xs text-slate-600 font-mono">{formatNumber(w.balance, 4)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono text-slate-200">{formatCurrency(w.usdValue)}</p>
                          <p className={`text-xs font-mono ${w.change24h >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
                            {formatPercent(w.change24h)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>}
          </div>

          {/* Recent activity */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Recent Activity</h2>
              <button onClick={() => navigate('/history')} className="text-xs text-neon-green/60 hover:text-neon-green">All →</button>
            </div>
            {transactions.length === 0
              ? <p className="text-slate-600 text-sm text-center py-4">No transactions yet</p>
              : <div className="space-y-1">
                  {transactions.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                      <div className="flex items-center gap-2.5">
                        <TxIcon type={tx.transaction_type} />
                        <div>
                          <p className="text-xs font-medium text-slate-300 capitalize">{tx.transaction_type.replace(/_/g, ' ')}</p>
                          <p className="text-[10px] text-slate-600">{formatDate(tx.created_at)}</p>
                        </div>
                      </div>
                      <p className="text-xs font-mono text-slate-300">{formatNumber(tx.amount, 4)} {tx.assets?.symbol}</p>
                    </div>
                  ))}
                </div>}
          </div>
        </div>

        {/* Market table */}
        <div className="lg:col-span-2 card overflow-hidden p-0">
          <div className="flex items-center justify-between p-5 border-b border-white/[0.04]">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Market</h2>
            <button onClick={() => navigate('/trade')} className="text-xs text-neon-green/60 hover:text-neon-green">Trade →</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {['Asset', 'Price', '24h', 'High', 'Low', ''].map(h => (
                  <th key={h} className={`py-3 px-5 text-[10px] font-bold text-slate-600 uppercase tracking-wider ${h === 'Asset' ? 'text-left' : h === '' ? '' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {marketData.length === 0
                ? <tr><td colSpan={6} className="py-10 text-center text-slate-600 text-sm">Loading market data...</td></tr>
                : marketData.map(feed => (
                    <tr key={feed.id} className="table-row-hover border-b border-white/[0.03] last:border-0">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          {feed.assets?.icon_url
                            ? <img src={feed.assets.icon_url} alt="" className="w-7 h-7 rounded-full" />
                            : <div className="w-7 h-7 rounded-full bg-dark-600 flex items-center justify-center text-xs">{feed.assets?.symbol?.[0]}</div>}
                          <div>
                            <p className="font-bold text-slate-200 text-sm">{feed.assets?.symbol}</p>
                            <p className="text-[10px] text-slate-600">{feed.assets?.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-slate-200 font-semibold">{formatCurrency(feed.price)}</td>
                      <td className="py-3.5 px-5 text-right">
                        <span className={`inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-1 rounded-lg ${
                          feed.change_24h >= 0 ? 'bg-neon-green/10 text-neon-green' : 'bg-neon-red/10 text-neon-red'
                        }`}>
                          {feed.change_24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {formatPercent(feed.change_24h)}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right text-xs font-mono text-slate-500">{feed.high_24h > 0 ? formatCurrency(feed.high_24h) : '—'}</td>
                      <td className="py-3.5 px-5 text-right text-xs font-mono text-slate-500">{feed.low_24h > 0 ? formatCurrency(feed.low_24h) : '—'}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button onClick={() => navigate(`/trade/${feed.assets?.symbol}`)}
                          className="text-[10px] text-neon-green/60 hover:text-neon-green font-semibold transition-colors flex items-center gap-0.5 ml-auto">
                          Trade <ArrowUpRight size={10} />
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function TxIcon({ type }: { type: string }) {
  const cls = 'w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0'
  if (type === 'trade_buy')  return <div className={`${cls} bg-neon-green/10`}><TrendingUp size={11} className="text-neon-green" /></div>
  if (type === 'trade_sell') return <div className={`${cls} bg-neon-red/10`}><TrendingDown size={11} className="text-neon-red" /></div>
  if (type === 'deposit')    return <div className={`${cls} bg-neon-cyan/10`}><ArrowUpRight size={11} className="text-neon-cyan" /></div>
  if (type === 'swap')       return <div className={`${cls} bg-purple-500/10`}><ArrowLeftRight size={11} className="text-purple-400" /></div>
  if (type.includes('stak')) return <div className={`${cls} bg-yellow-500/10`}><Zap size={11} className="text-yellow-400" /></div>
  return <div className={`${cls} bg-white/5`}><RefreshCw size={11} className="text-slate-500" /></div>
}
