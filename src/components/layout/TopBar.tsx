import { LogOut, Bell } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { usePrices } from '@/hooks/usePrices'
import { formatCurrency, formatPercent, getChangeColor } from '@/utils/format'

export function TopBar() {
  const signOut = useAuthStore(s => s.signOut)
  const { prices } = usePrices()

  const tickerAssets = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA']
  const tickerPrices = Object.values(prices).filter(p =>
    tickerAssets.includes(p.assets?.symbol ?? '')
  )

  return (
    <header className="h-14 bg-dark-800 border-b border-dark-600 flex items-center px-6 gap-4">
      {/* Price ticker */}
      <div className="flex-1 flex items-center gap-6 overflow-hidden">
        {tickerPrices.map(feed => (
          <div key={feed.asset_id} className="flex items-center gap-2 flex-shrink-0 text-sm">
            <span className="text-gray-400 font-medium">{feed.assets?.symbol}</span>
            <span className="text-gray-200 font-mono">{formatCurrency(feed.price)}</span>
            <span className={`text-xs font-mono ${getChangeColor(feed.change_24h)}`}>
              {formatPercent(feed.change_24h)}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button className="p-2 text-gray-400 hover:text-gray-200 hover:bg-dark-700 rounded-lg transition-colors">
          <Bell size={18} />
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-dark-700 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </header>
  )
}
