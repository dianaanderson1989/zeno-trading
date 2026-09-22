import { LogOut, Menu } from 'lucide-react'
import { SignOutConfirm } from '@/components/SignOutConfirm'
import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { usePrices } from '@/hooks/usePrices'
import { formatCurrency, formatPercent } from '@/utils/format'
import { NotificationBell } from './NotificationBell'
import { Sidebar } from './Sidebar'

export function TopBar() {
  const { signOut } = useAuthStore()
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const { prices } = usePrices()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const ticker = ['BTC', 'ETH', 'SOL']
  const tickerFeeds = Object.values(prices).filter(p => ticker.includes(p.assets?.symbol ?? ''))

  return (
    <>
      <header className="h-12 flex items-center px-4 gap-3 border-b border-white/[0.05] flex-shrink-0"
        style={{ background: 'rgba(8,12,23,0.95)', backdropFilter: 'blur(20px)' }}>

        <button onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors flex-shrink-0">
          <Menu size={18} />
        </button>

        <div className="lg:hidden flex items-center gap-2 flex-shrink-0">
          <div className="w-6 h-6 rounded-md flex items-center justify-center font-black text-dark-950 text-xs"
            style={{ background: 'linear-gradient(135deg, #00ff88, #00d4ff)' }}>Z</div>
          <span className="text-sm font-black text-white">Zeno</span>
        </div>

        <div className="hidden lg:flex flex-1 items-center gap-5 overflow-hidden">
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

        <div className="flex-1 lg:hidden" />

        <div className="flex items-center gap-1 flex-shrink-0">
          <NotificationBell />
          {/* Mobile: always-visible logout */}
          <button onClick={() => setConfirmSignOut(true)}
            className="lg:hidden w-8 h-8 flex items-center justify-center text-slate-400 hover:text-neon-red hover:bg-neon-red/10 rounded-lg transition-colors"
            title="Sign out">
            <LogOut size={16} />
          </button>
          {/* Desktop logout */}
          <button onClick={() => setConfirmSignOut(true)}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] rounded-lg transition-colors">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 animate-fade-in"
            style={{ background: 'rgba(8,12,23,0.99)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            <Sidebar onClose={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}
      {confirmSignOut && (
        <SignOutConfirm
          onConfirm={() => { setConfirmSignOut(false); signOut() }}
          onCancel={() => setConfirmSignOut(false)}
        />
      )}
    </>
  )
}
