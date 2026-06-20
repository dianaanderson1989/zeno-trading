import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatNumber } from '@/utils/format'

export function AdminWithdrawals() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('pending')
  const [processing, setProcessing] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const { data: withdrawals = [], isLoading } = useQuery({
    queryKey: ['admin_withdrawals', filter],
    queryFn: async () => {
      let q = supabase.from('withdrawals')
        .select('*, assets(*), users(email, first_name, last_name)')
        .order('created_at', { ascending: false })
      if (filter !== 'all') q = q.eq('status', filter)
      const { data } = await q
      return data ?? []
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const handleAction = async (w: any, action: 'approved' | 'rejected') => {
    setProcessing(w.id)
    try {
      await supabase.from('withdrawals').update({
        status: action === 'approved' ? 'completed' : 'rejected',
        admin_notes: notes[w.id] || null,
        rejection_reason: action === 'rejected' ? (notes[w.id] || 'Rejected by admin') : null,
        admin_user_id: (await supabase.auth.getUser()).data.user?.id,
      }).eq('id', w.id)

      if (action === 'approved') {
        // Deduct from wallet
        const { data: wallet } = await supabase.from('wallets')
          .select('id, balance').eq('user_id', w.user_id).eq('asset_id', w.asset_id).single()
        if (wallet) {
          const newBalance = Math.max(0, wallet.balance - Number(w.amount))
          await supabase.from('wallets').update({ balance: newBalance }).eq('id', wallet.id)
        }
        await supabase.from('transactions').insert({
          user_id: w.user_id,
          transaction_type: 'withdrawal',
          asset_id: w.asset_id,
          amount: w.amount,
          fee: w.fee,
          description: `Withdrawal to ${w.address} (${w.network})`,
          withdrawal_id: w.id,
          status: 'completed',
        })
      } else {
        // Refund locked balance back if any was locked
        await supabase.from('transactions').insert({
          user_id: w.user_id,
          transaction_type: 'withdrawal',
          asset_id: w.asset_id,
          amount: w.amount,
          description: `Withdrawal rejected: ${notes[w.id] || 'Admin decision'}`,
          withdrawal_id: w.id,
          status: 'failed',
        })
      }

      queryClient.invalidateQueries({ queryKey: ['admin_withdrawals'] })
    } finally {
      setProcessing(null)
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/15 text-yellow-400',
    completed: 'bg-brand-500/15 text-brand-400',
    rejected: 'bg-red-500/15 text-red-400',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Withdrawals</h1>
        <div className="flex gap-2">
          {['pending', 'completed', 'rejected', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter === f ? 'bg-brand-500 text-white' : 'bg-dark-700 text-gray-400 hover:text-gray-200'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-dark-700 rounded-lg animate-pulse" />)}</div>
        ) : withdrawals.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No {filter} withdrawals</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-600 text-gray-500 text-xs uppercase">
                <th className="text-left p-4 font-medium">User</th>
                <th className="text-right p-4 font-medium">Amount</th>
                <th className="text-left p-4 font-medium">Address</th>
                <th className="text-left p-4 font-medium">Network</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-right p-4 font-medium">Date</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-600">
              {withdrawals.map((w: any) => (
                <tr key={w.id} className="hover:bg-dark-700/40">
                  <td className="p-4">
                    <p className="text-gray-200">{w.users?.first_name ? `${w.users.first_name} ${w.users.last_name ?? ''}` : '—'}</p>
                    <p className="text-xs text-gray-500">{w.users?.email}</p>
                  </td>
                  <td className="p-4 text-right font-mono text-gray-200">{formatNumber(w.amount, 4)} {w.assets?.symbol}</td>
                  <td className="p-4 text-xs text-gray-400 max-w-[120px] truncate">{w.address}</td>
                  <td className="p-4 text-gray-400">{w.network}</td>
                  <td className="p-4"><span className={`badge ${statusColors[w.status] ?? 'bg-gray-500/15 text-gray-400'}`}>{w.status}</span></td>
                  <td className="p-4 text-right text-xs text-gray-500">{formatDate(w.created_at)}</td>
                  <td className="p-4">
                    {w.status === 'pending' && (
                      <div className="flex flex-col gap-1.5">
                        <input
                          placeholder="Note / reject reason..."
                          value={notes[w.id] || ''}
                          onChange={e => setNotes(n => ({ ...n, [w.id]: e.target.value }))}
                          className="input text-xs py-1"
                        />
                        <div className="flex gap-1.5">
                          <button onClick={() => handleAction(w, 'approved')} disabled={processing === w.id}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-brand-500/15 text-brand-400 hover:bg-brand-500/25 rounded-lg">
                            <CheckCircle size={12} /> Approve
                          </button>
                          <button onClick={() => handleAction(w, 'rejected')} disabled={processing === w.id}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500/15 text-red-400 hover:bg-red-500/25 rounded-lg">
                            <XCircle size={12} /> Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
