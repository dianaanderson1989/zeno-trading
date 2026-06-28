import { useQuery } from '@tanstack/react-query'
import { Users, ArrowDownToLine, ArrowUpFromLine, TrendingUp, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'

export function AdminDashboard() {
  const navigate = useNavigate()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin_stats'],
    queryFn: async () => {
      const [usersRes, depositsRes, withdrawalsRes, ordersRes] = await Promise.all([
        supabase.from('users').select('id, status, role', { count: 'exact' }),
        supabase.from('deposits').select('id, status, amount'),
        supabase.from('withdrawals').select('id, status, amount'),
        supabase.from('orders').select('id, status', { count: 'exact' }),
      ])

      const allDeposits    = depositsRes.data ?? []
      const allWithdrawals = withdrawalsRes.data ?? []
      const allUsers       = usersRes.data ?? []

      // Pending = awaiting admin action
      const pendingDeposits    = allDeposits.filter(d => d.status === 'pending')
      const pendingWithdrawals = allWithdrawals.filter(w => w.status === 'pending')
      const totalUsers         = usersRes.count ?? 0
      const activeUsers        = allUsers.filter(u => u.status === 'active').length
      const totalOrders        = ordersRes.count ?? 0

      return {
        pendingDeposits,
        pendingWithdrawals,
        totalUsers,
        activeUsers,
        totalOrders,
      }
    },
    staleTime: 10_000,
    refetchInterval: 15_000, // auto-refresh every 15s
  })

  const cards = [
    {
      label: 'Total Users', value: stats?.totalUsers ?? 0,
      sub: `${stats?.activeUsers ?? 0} active`,
      icon: Users, color: 'text-neon-cyan', bg: 'bg-neon-cyan/10', border: 'border-neon-cyan/20',
    },
    {
      label: 'Pending Deposits', value: stats?.pendingDeposits.length ?? 0,
      sub: 'Awaiting approval', icon: ArrowDownToLine,
      color: 'text-neon-green', bg: 'bg-neon-green/10', border: 'border-neon-green/20',
      alert: (stats?.pendingDeposits.length ?? 0) > 0,
      action: () => navigate('/admin/deposits'),
    },
    {
      label: 'Pending Withdrawals', value: stats?.pendingWithdrawals.length ?? 0,
      sub: 'Awaiting approval', icon: ArrowUpFromLine,
      color: 'text-neon-yellow', bg: 'bg-neon-yellow/10', border: 'border-neon-yellow/20',
      alert: (stats?.pendingWithdrawals.length ?? 0) > 0,
      action: () => navigate('/admin/withdrawals'),
    },
    {
      label: 'Total Orders', value: stats?.totalOrders ?? 0,
      sub: 'All time', icon: TrendingUp,
      color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Admin Overview</h1>
        <p className="text-slate-500 text-sm mt-1">Platform summary — auto-refreshes every 15s</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => (
          <div
            key={card.label}
            onClick={card.action}
            className={`card relative border ${card.border} ${card.action ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}
          >
            {card.alert && (
              <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-neon-green animate-glow-pulse" />
            )}
            <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center mb-4`}>
              <card.icon size={18} className={card.color} />
            </div>
            {isLoading
              ? <div className="h-8 w-16 rounded-lg shimmer mb-1" />
              : <p className="text-3xl font-black text-white">{card.value}</p>}
            <p className="text-sm font-semibold text-slate-300 mt-0.5">{card.label}</p>
            <p className="text-xs text-slate-600 mt-0.5">{card.sub}</p>
            {card.action && <p className="text-xs text-neon-green/50 mt-2">Click to manage →</p>}
          </div>
        ))}
      </div>

      {/* Action required banner */}
      {((stats?.pendingDeposits.length ?? 0) > 0 || (stats?.pendingWithdrawals.length ?? 0) > 0) && (
        <div className="card border border-neon-green/20 bg-neon-green/5 animate-fade-in">
          <div className="flex items-center gap-2 text-neon-green mb-3">
            <AlertCircle size={16} />
            <span className="font-bold text-sm">Action Required</span>
          </div>
          <div className="space-y-2">
            {(stats?.pendingDeposits.length ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-300">
                  {stats?.pendingDeposits.length} pending deposit{stats!.pendingDeposits.length > 1 ? 's' : ''} waiting for approval
                </p>
                <button onClick={() => navigate('/admin/deposits')} className="text-xs text-neon-green font-semibold hover:text-neon-green/80">
                  Review →
                </button>
              </div>
            )}
            {(stats?.pendingWithdrawals.length ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-300">
                  {stats?.pendingWithdrawals.length} pending withdrawal{stats!.pendingWithdrawals.length > 1 ? 's' : ''} waiting for approval
                </p>
                <button onClick={() => navigate('/admin/withdrawals')} className="text-xs text-neon-yellow font-semibold hover:text-neon-yellow/80">
                  Review →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
