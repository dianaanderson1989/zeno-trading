import { useState, useRef, useEffect } from 'react'
import { Bell, CheckCheck, X, TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine, Shield, Zap } from 'lucide-react'
import { useNotifications, type Notification } from '@/hooks/useNotifications'
import { formatDate } from '@/utils/format'

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  deposit_approved:    { icon: ArrowDownToLine, color: 'text-neon-green',  bg: 'bg-neon-green/10' },
  deposit_rejected:    { icon: ArrowDownToLine, color: 'text-neon-red',    bg: 'bg-neon-red/10' },
  withdrawal_approved: { icon: ArrowUpFromLine, color: 'text-neon-cyan',   bg: 'bg-neon-cyan/10' },
  withdrawal_rejected: { icon: ArrowUpFromLine, color: 'text-neon-red',    bg: 'bg-neon-red/10' },
  kyc_approved:        { icon: Shield,          color: 'text-neon-green',  bg: 'bg-neon-green/10' },
  kyc_rejected:        { icon: Shield,          color: 'text-neon-red',    bg: 'bg-neon-red/10' },
  kyc_in_review:       { icon: Shield,          color: 'text-yellow-400',  bg: 'bg-yellow-500/10' },
  binary_win:          { icon: Zap,             color: 'text-neon-green',  bg: 'bg-neon-green/10' },
  binary_lose:         { icon: Zap,             color: 'text-neon-red',    bg: 'bg-neon-red/10' },
  trade_win:           { icon: TrendingUp,      color: 'text-neon-green',  bg: 'bg-neon-green/10' },
  trade_lose:          { icon: TrendingDown,    color: 'text-neon-red',    bg: 'bg-neon-red/10' },
  general:             { icon: Bell,            color: 'text-neon-cyan',   bg: 'bg-neon-cyan/10' },
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const { data: notifications = [], unreadCount, markRead, markAllRead } = useNotifications(20)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => setOpen(o => !o)

  const handleNotificationClick = async (n: Notification) => {
    if (!n.is_read) await markRead(n.id)
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] rounded-lg transition-colors"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full text-[9px] font-black flex items-center justify-center px-1 text-dark-950"
            style={{ background: 'linear-gradient(135deg, #00ff88, #00cc6a)', boxShadow: '0 0 8px rgba(0,255,136,0.6)' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-10 w-80 z-50 animate-slide-up"
          style={{ background: 'rgba(10,15,30,0.98)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,255,136,0.08)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="badge bg-neon-green/10 text-neon-green border border-neon-green/20 text-xs">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-neon-green transition-colors px-2 py-1 rounded-lg hover:bg-neon-green/5"
                >
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-300 p-1">
                <X size={13} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-10">
                <Bell size={24} className="text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No notifications yet</p>
                <p className="text-slate-600 text-xs mt-1">We'll notify you of important account activity</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {notifications.map(n => {
                  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.general
                  const Icon = cfg.icon
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`flex gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-white/[0.03] ${
                        !n.is_read ? 'bg-neon-green/[0.03]' : ''
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                        <Icon size={14} className={cfg.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-bold leading-tight ${!n.is_read ? 'text-white' : 'text-slate-300'}`}>
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-neon-green flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                        <p className="text-[10px] text-slate-600 mt-1">{formatDate(n.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/[0.06] text-center">
              <p className="text-[10px] text-slate-600">Updates every 30 seconds</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
