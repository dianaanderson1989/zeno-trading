import { useState } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, ArrowDownToLine, ArrowUpFromLine,
  TrendingUp, Layers, ChevronRight, ShieldCheck
} from 'lucide-react'
import { cn } from '@/utils/format'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { AdminUsers } from '@/components/admin/AdminUsers'
import { AdminDeposits } from '@/components/admin/AdminDeposits'
import { AdminWithdrawals } from '@/components/admin/AdminWithdrawals'
import { AdminOrders } from '@/components/admin/AdminOrders'
import { AdminStaking } from '@/components/admin/AdminStaking'

const navItems = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/deposits', label: 'Deposits', icon: ArrowDownToLine },
  { to: '/admin/withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine },
  { to: '/admin/orders', label: 'Orders', icon: TrendingUp },
  { to: '/admin/staking', label: 'Staking Pools', icon: Layers },
]

export function AdminPage() {
  return (
    <div className="min-h-screen bg-dark-900 flex">
      {/* Admin sidebar */}
      <aside className="w-56 bg-dark-800 border-r border-dark-600 flex flex-col">
        <div className="p-4 border-b border-dark-600">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-brand-400" />
            <span className="font-bold text-white">Admin Panel</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-500/15 text-brand-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700'
              )}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-dark-600">
          <NavLink to="/dashboard" className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 px-3 py-2">
            ← Back to App
          </NavLink>
        </div>
      </aside>

      {/* Admin content */}
      <main className="flex-1 p-6 overflow-auto">
        <Routes>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="deposits" element={<AdminDeposits />} />
          <Route path="withdrawals" element={<AdminWithdrawals />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="staking" element={<AdminStaking />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  )
}
