import { NavLink } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, Zap, Wallet, User } from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'Home',    icon: LayoutDashboard },
  { to: '/trade',     label: 'Trade',   icon: TrendingUp },
  { to: '/binary',    label: 'Binary',  icon: Zap },
  { to: '/wallet',    label: 'Wallet',  icon: Wallet },
  { to: '/account',   label: 'Account', icon: User },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06]"
      style={{ background: 'rgba(8,12,23,0.98)', backdropFilter: 'blur(20px)' }}>
      <div className="flex items-center justify-around px-2 py-2 pb-safe">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-[56px] ${
                isActive ? 'text-neon-green' : 'text-slate-500 hover:text-slate-300'
              }`
            }>
            {({ isActive }) => (
              <>
                <div className={`relative p-1.5 rounded-xl transition-all ${isActive ? 'bg-neon-green/10' : ''}`}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                  {isActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-neon-green" />
                  )}
                </div>
                <span className={`text-[10px] font-semibold leading-none ${isActive ? 'text-neon-green' : 'text-slate-600'}`}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
