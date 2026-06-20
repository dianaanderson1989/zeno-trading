import { useQuery } from '@tanstack/react-query'
import { Users, ArrowDownToLine, ArrowUpFromLine, TrendingUp, DollarSign, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatNumber } from '@/utils/format'

export function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin_stats'],
    queryFn: async () => {
      const [users, deposits, withdrawals, orders, transactions] = await Promise.all([
        supabase.from('users').select('id, status, created_at', { count: 'exact' }),
        supabase.from('deposits').select('id, status, amount', { count: 'exact' }),
        supabase.from('withdrawals').select('id, status, amount', { count: 'exact' }),
        supabase.from('orders').select('id, status', { count: 'exact' }),
        supabase.from('transactions').select('amount, transaction_type'),
      ])
      const pendingDeposits = deposits.data?.filter(d => d.status === 'pending') ?? []
      const pendingWithdrawals = withdrawals.data?.filter(w => w.status === 'pending') ?? []
      const totalDeposited = deposits.data?.filter(d => d.status === 'completed').reduce((s, d) => s + Number(d.amount), 0) ?? 0
      const totalUsers = users.count ?? 0
      const activeUsers = users.data?.filter(u => u.status === 'active').length ?? 0
      const totalOrders = orders.count ?? 0
      const recentUsers = users.data?.slice(-5).reverse() ?? []
      return { pendingDeposits, pendingWithdrawals, totalDeposited, totalUsers, activeUsers, totalOrders, recentUsers }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const cards = [
    { label: 'Total Users', value: stats?.totalUsers ?? 0, sub: `${stats?.activeUsers ?? 0} active`, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Pending Deposits', value: stats?.pendingDeposits.length ?? 0, sub: 'Awaiting approval', icon: ArrowDownToLine, color: 'text-brand-400', bg: 'bg-brand-500/10', alert: (stats?.pendingDeposits.length ?? 0) > 0 },
    { label: 'Pending Withdrawals', value: stats?.pendingWithdrawals.length ?? 0, sub: 'Awaiting approval', icon: ArrowUpFromLine, color: 'text-orange-400', bg: 'bg-orange-500/10', alert: (stats?.pendingWithdrawals.length ?? 0) > 0 },
    { label: 'Total Orders', value: stats?.totalOrders ?? 0, sub: 'All time', icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Overview</h1>
        <p className="text-gray-400 text-sm mt-1">Platform summary and pending actions</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => (
          <div key={card.label} className={`card relative ${card.alert ? 'border-orange-500/40' : ''}`}>
            {card.alert && <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-orange-400 animate-pulse" />}
            <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
              <card.icon size={18} className={card.color} />
            </div>
            <p className="text-2xl font-bold text-white">{card.value}</p>
            <p className="text-sm text-gray-200 mt-0.5">{card.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {((stats?.pendingDeposits.length ?? 0) > 0 || (stats?.pendingWithdrawals.length ?? 0) > 0) && (
        <div className="card border-orange-500/30 bg-orange-500/5">
          <div className="flex items-center gap-2 text-orange-400 mb-2">
            <AlertCircle size={16} />
            <span className="font-semibold text-sm">Action Required</span>
          </div>
          <div className="text-sm text-gray-300 space-y-1">
            {(stats?.pendingDeposits.length ?? 0) > 0 && (
              <p>• {stats?.pendingDeposits.length} deposit{stats!.pendingDeposits.length > 1 ? 's' : ''} waiting for approval</p>
            )}
            {(stats?.pendingWithdrawals.length ?? 0) > 0 && (
              <p>• {stats?.pendingWithdrawals.length} withdrawal{stats!.pendingWithdrawals.length > 1 ? 's' : ''} waiting for approval</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
