import { Bell, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { usePrices } from '@/hooks/usePrices'
import { formatCurrency, formatPercent } from '@/utils/format'

export function TopBar() {
  const signOut = useAuthStore(s => s.signOut)
  const { prices } = usePrices()

  const ticker = ['BTC','ETH','SOL','BNB','XRP']
  const tickerFeeds = Object.values(prices).filter(p => ticker.includes(p.assets?.symbol ?? ''))

  return (
    <header className="h-12 flex items-center px-6 gap-4 border-b border-white/[0.05] flex-shrink-0"
      style={{ background: 'rgba(8,12,23,0.9)', backdropFilter: 'blur(20px)' }}>

      {/* Ticker */}
      <div className="flex-1 flex items-center gap-5 overflow-hidden">
        {tickerFeeds.map(feed => (
          <div key={feed.asset_id} className="flex items-center gap-2 flex-shrink-0 text-xs">
            <span className="text-slate-500 font-medium">{feed.assets?.symbol}</span>
            <span className="text-slate-200 font-mono">{formatCurrency(feed.price)}</span>
            <span className={`font-mono font-semibold ${feed.change_24h >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
              {formatPercent(feed.change_24h)}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] rounded-lg transition-colors">
          <Bell size={15} />
        </button>
        <button onClick={signOut}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] rounded-lg transition-colors">
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </header>
  )
}
