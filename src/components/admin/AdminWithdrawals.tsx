import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Eye, User, Coins, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatNumber } from '@/utils/format'

export function AdminWithdrawals() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('pending')
  const [processing, setProcessing] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [detail, setDetail] = useState<any | null>(null)

  const { data: withdrawals = [], isLoading, refetch } = useQuery({
    queryKey: ['admin_withdrawals', filter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('withdrawals')
        .select(`*, assets:asset_id(symbol, name, icon_url), users:user_id(id, email, first_name, last_name, created_at)`)
        .order('created_at', { ascending: false })
      if (error) {
        console.error('[AdminWithdrawals] Query error:', error)
        throw error
      }
      const all = data ?? []
      if (filter === 'all') return all
      return all.filter((w: any) => w.status === filter)
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  })

  const handleAction = async (w: any, action: 'approved' | 'rejected') => {
    setProcessing(w.id)
    try {
      const adminId = (await supabase.auth.getUser()).data.user?.id

      if (action === 'approved') {
        // Deduct from wallet
        const { data: wallet } = await supabase
          .from('wallets')
          .select('id, balance')
          .eq('user_id', w.user_id)
          .eq('asset_id', w.asset_id)
          .single()

        if (wallet) {
          const newBalance = Math.max(0, wallet.balance - Number(w.amount))
          await supabase.from('wallets').update({ balance: newBalance }).eq('id', wallet.id)
        }

        await supabase.from('transactions').insert({
          user_id: w.user_id,
          transaction_type: 'withdrawal',
          asset_id: w.asset_id,
          amount: w.amount,
          fee: w.fee ?? 0,
          description: `Withdrawal approved — ${w.network} — to ${w.address?.slice(0, 12)}...`,
          withdrawal_id: w.id,
          status: 'completed',
        })

        await supabase.from('withdrawals').update({
          status: 'completed',
          admin_notes: notes[w.id] || null,
          admin_user_id: adminId,
          updated_at: new Date().toISOString(),
        }).eq('id', w.id)

      } else {
        await supabase.from('withdrawals').update({
          status: 'rejected',
          rejection_reason: notes[w.id] || 'Rejected by admin',
          admin_notes: notes[w.id] || null,
          admin_user_id: adminId,
          updated_at: new Date().toISOString(),
        }).eq('id', w.id)
      }

      queryClient.invalidateQueries({ queryKey: ['admin_withdrawals'] })
      queryClient.invalidateQueries({ queryKey: ['admin_stats'] })
      setDetail(null)
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setProcessing(null)
    }
  }

  const statusColors: Record<string, string> = {
    pending:   'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',
    completed: 'bg-neon-green/10 text-neon-green border border-neon-green/20',
    rejected:  'bg-neon-red/10 text-neon-red border border-neon-red/20',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">Withdrawals</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
            <RefreshCw size={12} /> Refresh
          </button>
          {['pending', 'completed', 'rejected', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                filter === f ? 'bg-neon-green text-dark-950' : 'bg-dark-700 text-slate-400 hover:text-white border border-white/[0.06]'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={detail ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <div className="card overflow-hidden p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-lg shimmer" />)}</div>
            ) : withdrawals.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <p className="text-slate-400 text-sm font-medium">No {filter} withdrawals</p>
                <p className="text-slate-600 text-xs">
                  {filter === 'pending'
                    ? 'If dashboard shows pending withdrawals, run fix_withdrawals_rls.sql then click Refresh'
                    : 'Try switching to "All" to see all withdrawals'}
                </p>
                <button onClick={() => setFilter('all')} className="text-xs text-neon-green hover:text-neon-green/80 mt-2">
                  Show all withdrawals →
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    {['User', 'Amount', 'Network', 'Address', 'Status', 'Date', ''].map(h => (
                      <th key={h} className={`p-4 text-[10px] font-bold text-slate-600 uppercase tracking-wider ${['User','Network','Address'].includes(h) ? 'text-left' : h === '' ? '' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {withdrawals.map((w: any) => (
                    <tr key={w.id}
                      onClick={() => setDetail(detail?.id === w.id ? null : w)}
                      className={`table-row-hover cursor-pointer ${detail?.id === w.id ? 'bg-neon-green/5' : ''}`}>
                      <td className="p-4">
                        <p className="text-slate-200 font-medium text-sm">
                          {w.users?.first_name ? `${w.users.first_name} ${w.users.last_name ?? ''}` : '—'}
                        </p>
                        <p className="text-xs text-slate-600">{w.users?.email}</p>
                      </td>
                      <td className="p-4 text-right">
                        <p className="font-mono font-semibold text-slate-200">{formatNumber(w.amount, 4)}</p>
                        <p className="text-xs text-slate-600">{w.assets?.symbol}</p>
                      </td>
                      <td className="p-4"><span className="badge bg-dark-600 text-slate-400 border border-white/[0.06] text-xs">{w.network}</span></td>
                      <td className="p-4 text-xs text-slate-600 font-mono max-w-[100px] truncate">{w.address}</td>
                      <td className="p-4 text-right"><span className={`badge text-xs ${statusColors[w.status] ?? 'bg-dark-600 text-slate-400'}`}>{w.status}</span></td>
                      <td className="p-4 text-right text-xs text-slate-600 whitespace-nowrap">{formatDate(w.created_at)}</td>
                      <td className="p-4 text-right"><Eye size={14} className="text-slate-600 hover:text-neon-green ml-auto transition-colors" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {detail && (
          <div className="lg:col-span-1 animate-slide-up">
            <div className="card border border-white/[0.08] sticky top-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white">Withdrawal Detail</h3>
                <button onClick={() => setDetail(null)} className="text-slate-600 hover:text-slate-300 text-lg leading-none">✕</button>
              </div>

              <div className="bg-dark-700/50 rounded-xl p-4 space-y-2 border border-white/[0.04]">
                <div className="flex items-center gap-2 mb-2">
                  <User size={14} className="text-neon-cyan" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">User</span>
                </div>
                <p className="text-white font-semibold">{detail.users?.first_name ? `${detail.users.first_name} ${detail.users.last_name ?? ''}` : 'No name'}</p>
                <p className="text-xs text-slate-500">{detail.users?.email}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Coins size={14} className="text-neon-green" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Withdrawal Info</span>
                </div>
                {[
                  { label: 'Amount', value: `${formatNumber(detail.amount, 6)} ${detail.assets?.symbol}` },
                  { label: 'Network', value: detail.network },
                  { label: 'Address', value: detail.address },
                  { label: 'Status', value: detail.status },
                  { label: 'Requested', value: formatDate(detail.created_at) },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-start gap-2">
                    <span className="text-xs text-slate-600 flex-shrink-0">{row.label}</span>
                    <span className={`text-xs font-mono text-right break-all ${
                      row.label === 'Status'
                        ? detail.status === 'pending' ? 'text-yellow-400' : detail.status === 'completed' ? 'text-neon-green' : 'text-neon-red'
                        : 'text-slate-300'
                    }`}>{row.value}</span>
                  </div>
                ))}
              </div>

              {detail.status === 'pending' && (
                <>
                  <div className="neon-divider" />
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Note / Reject Reason</label>
                    <textarea
                      value={notes[detail.id] || ''}
                      onChange={e => setNotes(n => ({ ...n, [detail.id]: e.target.value }))}
                      placeholder="Optional note..."
                      rows={2}
                      className="input text-xs resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleAction(detail, 'approved')}
                      disabled={processing === detail.id}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-neon-green text-dark-950 hover:shadow-neon-green disabled:opacity-50 transition-all"
                    >
                      {processing === detail.id
                        ? <span className="w-3 h-3 border-2 border-dark-950/30 border-t-dark-950 rounded-full animate-spin" />
                        : <><CheckCircle size={13} /> Approve</>}
                    </button>
                    <button
                      onClick={() => handleAction(detail, 'rejected')}
                      disabled={processing === detail.id}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-neon-red/10 text-neon-red border border-neon-red/20 hover:bg-neon-red/20 disabled:opacity-50 transition-all"
                    >
                      <XCircle size={13} /> Reject
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
