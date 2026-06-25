import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, Zap, Layers, ArrowLeftRight,
  Wallet, History, Gift, ShieldCheck
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/format'

const navItems = [
  { to: '/dashboard', label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/trade',     label: 'Spot Trade',       icon: TrendingUp },
  { to: '/binary',    label: 'Binary Options',   icon: Zap },
  { to: '/staking',   label: 'Staking',          icon: Layers },
  { to: '/swap',      label: 'Swap',             icon: ArrowLeftRight },
  { to: '/wallet',    label: 'Wallet',           icon: Wallet },
  { to: '/history',   label: 'History',          icon: History },
  { to: '/referral',  label: 'Referral',         icon: Gift },
]

export function Sidebar() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  return (
    <aside className="w-60 bg-dark-800 border-r border-dark-600 flex flex-col min-h-screen">
      <div className="p-5 border-b border-dark-600">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-white text-sm">Z</div>
          <span className="text-lg font-bold text-white">Zeno</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-brand-500/15 text-brand-400'
                : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700'
            )}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</p>
            </div>
            <NavLink
              to="/admin"
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-brand-500/15 text-brand-400' : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700'
              )}
            >
              <ShieldCheck size={18} />
              Admin Panel
            </NavLink>
          </>
        )}
      </nav>

      <div className="p-3 border-t border-dark-600">
        <NavLink
          to="/profile"
          className={({ isActive }) => cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            isActive ? 'bg-brand-500/15 text-brand-400' : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700'
          )}
        >
          <div className="w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 text-xs font-bold flex-shrink-0">
            {user?.first_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-gray-200 text-sm truncate">
              {user?.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : user?.email}
            </p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
        </NavLink>
      </div>
    </aside>
  )
}
