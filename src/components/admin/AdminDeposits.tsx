import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatNumber } from '@/utils/format'

export function AdminDeposits() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('pending')
  const [processing, setProcessing] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const { data: deposits = [], isLoading } = useQuery({
    queryKey: ['admin_deposits', filter],
    queryFn: async () => {
      let q = supabase.from('deposits')
        .select('*, assets(*), users(email, first_name, last_name)')
        .order('created_at', { ascending: false })
      if (filter !== 'all') q = q.eq('status', filter)
      const { data } = await q
      return data ?? []
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const handleAction = async (deposit: any, action: 'approved' | 'rejected') => {
    setProcessing(deposit.id)
    try {
      await supabase.from('deposits').update({
        status: action,
        admin_notes: notes[deposit.id] || null,
        admin_user_id: (await supabase.auth.getUser()).data.user?.id,
        updated_at: new Date().toISOString(),
      }).eq('id', deposit.id)

      if (action === 'approved') {
        // Credit wallet
        const { data: wallet } = await supabase.from('wallets')
          .select('id, balance').eq('user_id', deposit.user_id).eq('asset_id', deposit.asset_id).single()
        if (wallet) {
          await supabase.from('wallets').update({ balance: wallet.balance + Number(deposit.amount) }).eq('id', wallet.id)
          await supabase.from('transactions').insert({
            user_id: deposit.user_id,
            transaction_type: 'deposit',
            asset_id: deposit.asset_id,
            amount: deposit.amount,
            description: `Deposit approved (${deposit.network})`,
            deposit_id: deposit.id,
            status: 'completed',
          })
          // Mark deposit as completed
          await supabase.from('deposits').update({ status: 'completed' }).eq('id', deposit.id)
        }
      }

      queryClient.invalidateQueries({ queryKey: ['admin_deposits'] })
    } finally {
      setProcessing(null)
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/15 text-yellow-400',
    approved: 'bg-blue-500/15 text-blue-400',
    completed: 'bg-brand-500/15 text-brand-400',
    rejected: 'bg-red-500/15 text-red-400',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Deposits</h1>
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
        ) : deposits.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No {filter} deposits</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-600 text-gray-500 text-xs uppercase">
                <th className="text-left p-4 font-medium">User</th>
                <th className="text-right p-4 font-medium">Amount</th>
                <th className="text-left p-4 font-medium">Network</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-right p-4 font-medium">Date</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-600">
              {deposits.map((d: any) => (
                <tr key={d.id} className="hover:bg-dark-700/40">
                  <td className="p-4">
                    <p className="text-gray-200">{d.users?.first_name ? `${d.users.first_name} ${d.users.last_name ?? ''}` : d.users?.email}</p>
                    <p className="text-xs text-gray-500">{d.users?.email}</p>
                  </td>
                  <td className="p-4 text-right font-mono text-gray-200">{formatNumber(d.amount, 4)} {d.assets?.symbol}</td>
                  <td className="p-4 text-gray-400">{d.network}</td>
                  <td className="p-4"><span className={`badge ${statusColors[d.status]}`}>{d.status}</span></td>
                  <td className="p-4 text-right text-xs text-gray-500">{formatDate(d.created_at)}</td>
                  <td className="p-4">
                    {d.status === 'pending' && (
                      <div className="flex flex-col gap-1.5">
                        <input
                          placeholder="Admin note..."
                          value={notes[d.id] || ''}
                          onChange={e => setNotes(n => ({ ...n, [d.id]: e.target.value }))}
                          className="input text-xs py-1"
                        />
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleAction(d, 'approved')}
                            disabled={processing === d.id}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-brand-500/15 text-brand-400 hover:bg-brand-500/25 rounded-lg transition-colors"
                          >
                            <CheckCircle size={12} /> Approve
                          </button>
                          <button
                            onClick={() => handleAction(d, 'rejected')}
                            disabled={processing === d.id}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500/15 text-red-400 hover:bg-red-500/25 rounded-lg transition-colors"
                          >
                            <XCircle size={12} /> Reject
                          </button>
                        </div>
                      </div>
                    )}
                    {d.admin_notes && d.status !== 'pending' && (
                      <p className="text-xs text-gray-500 italic">{d.admin_notes}</p>
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
