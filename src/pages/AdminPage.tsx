import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { LayoutDashboard, Users, ArrowDownToLine, ArrowUpFromLine, TrendingUp, Layers, Wallet, Zap, ShieldCheck, FileText, Settings } from 'lucide-react'
import { cn } from '@/utils/format'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { AdminUsers } from '@/components/admin/AdminUsers'
import { AdminDeposits } from '@/components/admin/AdminDeposits'
import { AdminWithdrawals } from '@/components/admin/AdminWithdrawals'
import { AdminOrders } from '@/components/admin/AdminOrders'
import { AdminStaking } from '@/components/admin/AdminStaking'
import { AdminDepositAddresses } from '@/components/admin/AdminDepositAddresses'
import { AdminBinaryControl } from '@/components/admin/AdminBinaryControl'
import { AdminKyc } from '@/components/admin/AdminKyc'
import { AdminPlatformSettings } from '@/components/admin/AdminPlatformSettings'

const navItems = [
  { to: '/admin',             label: 'Overview',          icon: LayoutDashboard, end: true },
  { to: '/admin/users',       label: 'Users',             icon: Users },
  { to: '/admin/deposits',    label: 'Deposits',          icon: ArrowDownToLine },
  { to: '/admin/withdrawals', label: 'Withdrawals',       icon: ArrowUpFromLine },
  { to: '/admin/orders',      label: 'Orders',            icon: TrendingUp },
  { to: '/admin/binary',      label: 'Binary Control',    icon: Zap },
  { to: '/admin/kyc',         label: 'KYC Requests',      icon: FileText },
  { to: '/admin/staking',     label: 'Staking Pools',     icon: Layers },
  { to: '/admin/addresses',   label: 'Deposit Addresses', icon: Wallet },
  { to: '/admin/settings',    label: 'Platform Settings', icon: Settings },
]

export function AdminPage() {
  return (
    <div className="min-h-screen bg-dark-950 flex">
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-white/[0.05]"
        style={{ background: 'rgba(8,12,23,0.95)' }}>
        <div className="p-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-neon-green" />
            <span className="font-black text-white text-sm">Admin Panel</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all',
                isActive ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
              )}>
              <Icon size={14} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/[0.05]">
          <NavLink to="/dashboard" className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-300 px-3 py-2">← Back to App</NavLink>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Routes>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="deposits" element={<AdminDeposits />} />
          <Route path="withdrawals" element={<AdminWithdrawals />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="binary" element={<AdminBinaryControl />} />
          <Route path="kyc" element={<AdminKyc />} />
          <Route path="staking" element={<AdminStaking />} />
          <Route path="addresses" element={<AdminDepositAddresses />} />
          <Route path="settings" element={<AdminPlatformSettings />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  )
}
