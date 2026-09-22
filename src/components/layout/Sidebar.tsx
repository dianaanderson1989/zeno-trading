import { NavLink } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, Zap, Layers, ArrowLeftRight, Wallet, History, ShieldCheck, LogOut, X } from 'lucide-react'
import { useState } from 'react'
import { SignOutConfirm } from '@/components/SignOutConfirm'
import { useAuthStore } from '@/stores/authStore'

const navItems = [
  { to: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/trade',     label: 'Spot Trade',   icon: TrendingUp },
  { to: '/binary',    label: 'Binary',       icon: Zap },
  { to: '/staking',   label: 'Staking',      icon: Layers },
  { to: '/swap',      label: 'Swap',         icon: ArrowLeftRight },
  { to: '/wallet',    label: 'Wallet',       icon: Wallet },
  { to: '/history',   label: 'History',      icon: History },
]

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const { user, signOut } = useAuthStore()
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 border ${
      isActive
        ? 'text-neon-green bg-neon-green/10 border-neon-green/20'
        : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border-transparent'
    }`

  return (
    <>
      <aside className="w-full lg:w-[220px] flex-shrink-0 flex flex-col min-h-screen border-r border-white/[0.05]"
        style={{ background: 'rgba(8,12,23,0.95)', backdropFilter: 'blur(20px)' }}>

        <div className="px-5 py-5 border-b border-white/[0.05] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-dark-950 text-sm"
              style={{ background: 'linear-gradient(135deg, #00ff88, #00d4ff)', boxShadow: '0 0 16px rgba(0,255,136,0.4)' }}>Z</div>
            <div>
              <span className="text-base font-bold text-white tracking-tight">Zeno</span>
              <p className="text-[10px] text-neon-green/60 font-mono leading-none mt-0.5">TRADING</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-slate-500 hover:text-slate-200 p-1">
              <X size={18} />
            </button>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={linkClass} onClick={onClose}>
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? 'text-neon-green' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span>{label}</span>
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-neon-green" />}
                </>
              )}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="pt-4 pb-1.5 px-3">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Admin</p>
              </div>
              <NavLink to="/admin" className={linkClass} onClick={onClose}>
                <ShieldCheck size={16} /> Admin Panel
              </NavLink>
            </>
          )}
        </nav>

        <div className="p-3 border-t border-white/[0.05] space-y-1">
          <NavLink to="/account" className={linkClass} onClick={onClose}>
            {({ isActive }) => (
              <>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-dark-950"
                  style={{ background: 'linear-gradient(135deg, #00ff88, #00d4ff)' }}>
                  {user?.first_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-slate-200 text-xs font-medium truncate">
                    {user?.first_name ? `${user.first_name} ${(user as any).last_name ?? ''}`.trim() : user?.email}
                  </p>
                  <p className="text-[10px] text-neon-green/60 font-mono capitalize">{user?.role}</p>
                </div>
              </>
            )}
          </NavLink>
          <button
            onClick={() => setConfirmSignOut(true)}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-neon-red hover:bg-neon-red/5 transition-all w-full border border-transparent"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      {confirmSignOut && (
        <SignOutConfirm
          onConfirm={() => { setConfirmSignOut(false); signOut(); }}
          onCancel={() => setConfirmSignOut(false)}
        />
      )}
    </>
  )
}