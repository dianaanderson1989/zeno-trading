import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Eye, User, Coins, RefreshCw, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatNumber } from '@/utils/format'

export function AdminDeposits() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('pending')
  const [processing, setProcessing] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [detail, setDetail] = useState<any | null>(null)
  const [approveModal, setApproveModal] = useState<{ deposit: any; verifiedAmount: string; note: string } | null>(null)

  const { data: deposits = [], isLoading, error, refetch } = useQuery({
    queryKey: ['admin_deposits', filter],
    queryFn: async () => {
      // Always fetch ALL deposits first, then filter client-side
      // This avoids any server-side filter issues
      const { data, error } = await supabase
        .from('deposits')
        .select(`
          id, user_id, asset_id, amount, network, tx_hash,
          address, status, admin_notes, created_at, updated_at,
          assets:asset_id(symbol, name, icon_url),
          users:user_id(id, email, first_name, last_name, created_at)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[AdminDeposits] Query error:', error)
        throw error
      }

      console.log('[AdminDeposits] All deposits:', data?.length, data?.map(d => ({ id: d.id, status: d.status })))

      const all = data ?? []
      if (filter === 'all') return all
      return all.filter((d: any) => d.status === filter)
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
  })

  const handleAction = async (deposit: any, action: 'approved' | 'rejected', customAmount?: number) => {
    setProcessing(deposit.id)
    try {
      const { data: { user: adminUser } } = await supabase.auth.getUser()
      const adminId = adminUser?.id

      if (action === 'approved') {
        // Step 1: Find wallet
        const { data: wallet, error: walletErr } = await supabase
          .from('wallets')
          .select('id, balance')
          .eq('user_id', deposit.user_id)
          .eq('asset_id', deposit.asset_id)
          .single()

        if (walletErr || !wallet) {
          throw new Error('Could not find wallet for user. Error: ' + walletErr?.message)
        }

        // Step 2: Credit wallet
        const creditAmount = customAmount ?? Number(deposit.amount)
        const { error: updateErr } = await supabase
          .from('wallets')
          .update({ balance: Number(wallet.balance) + creditAmount })
          .eq('id', wallet.id)

        if (updateErr) throw new Error('Wallet update failed: ' + updateErr.message)

        // Step 3: Create transaction record
        const { error: txErr } = await supabase
          .from('transactions')
          .insert({
            user_id: deposit.user_id,
            transaction_type: 'deposit',
            asset_id: deposit.asset_id,
            amount: creditAmount,
            fee: 0,
            description: `Deposit approved — ${deposit.network} — ${creditAmount} ${deposit.assets?.symbol ?? ''} (user entered: ${deposit.amount})`,
            deposit_id: deposit.id,
            status: 'completed',
          })

        if (txErr) throw new Error('Transaction insert failed: ' + txErr.message)

        // Step 4: Mark deposit as completed
        const { error: depErr } = await supabase
          .from('deposits')
          .update({
            status: 'completed',
            admin_notes: notes[deposit.id] || null,
            admin_user_id: adminId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', deposit.id)

        if (depErr) throw new Error('Deposit status update failed: ' + depErr.message)

        // Notify user — deposit approved
        await supabase.from('notifications').insert({
          user_id: deposit.user_id,
          type: 'deposit_approved',
          title: '✅ Deposit Approved',
          message: `Your deposit of ${creditAmount} ${deposit.assets?.symbol ?? ''} via ${deposit.network} has been approved and credited to your wallet.`,
          metadata: { deposit_id: deposit.id, amount: creditAmount, asset: deposit.assets?.symbol, network: deposit.network },
        })

      } else {
        // Reject
        const { error: depErr } = await supabase
          .from('deposits')
          .update({
            status: 'rejected',
            admin_notes: notes[deposit.id] || 'Rejected by admin',
            admin_user_id: adminId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', deposit.id)

        if (depErr) throw new Error('Reject failed: ' + depErr.message)

        // Notify user — deposit rejected
        await supabase.from('notifications').insert({
          user_id: deposit.user_id,
          type: 'deposit_rejected',
          title: '❌ Deposit Rejected',
          message: `Your deposit of ${Number(deposit.amount)} ${deposit.assets?.symbol ?? ''} via ${deposit.network} was rejected. ${notes[deposit.id] ? 'Reason: ' + notes[deposit.id] : 'Please contact support.'}`,
          metadata: { deposit_id: deposit.id, amount: deposit.amount, network: deposit.network },
        })
      }

      // Refresh both this list and the dashboard stats
      queryClient.invalidateQueries({ queryKey: ['admin_deposits'] })
      queryClient.invalidateQueries({ queryKey: ['admin_stats'] })
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
      setDetail(null)

    } catch (e: any) {
      alert('❌ Error: ' + e.message)
      console.error('[AdminDeposits] Action error:', e)
    } finally {
      setProcessing(null)
    }
  }

  const statusColors: Record<string, string> = {
    pending:   'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
    completed: 'bg-neon-green/10 text-neon-green border border-neon-green/30',
    rejected:  'bg-neon-red/10 text-neon-red border border-neon-red/30',
  }

  const filterCounts = {
    pending:   deposits.length === 0 && filter !== 'pending' ? 0 : undefined,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Deposits</h1>
          {error && (
            <p className="text-neon-red text-xs mt-1">
              ⚠️ Query error: {(error as any).message} — check RLS policies
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
            <RefreshCw size={12} /> Refresh
          </button>
          {['pending', 'completed', 'rejected', 'all'].map(f => (
            <button key={f} onClick={() => { setFilter(f); setDetail(null) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                filter === f
                  ? 'bg-neon-green text-dark-950'
                  : 'bg-dark-700 text-slate-400 hover:text-white border border-white/[0.06]'
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
              <div className="p-6 space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl shimmer" />)}
              </div>
            ) : deposits.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <p className="text-slate-400 text-sm font-medium">No {filter} deposits</p>
                <p className="text-slate-600 text-xs">
                  {filter === 'pending'
                    ? 'If you see pending deposits on the dashboard, run fix_rls.sql in Supabase then click Refresh'
                    : 'Try switching to "All" to see all deposits'}
                </p>
                <button onClick={() => setFilter('all')} className="text-xs text-neon-green hover:text-neon-green/80 mt-2">
                  Show all deposits →
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    {['User', 'Amount', 'Network', 'Status', 'Date', ''].map(h => (
                      <th key={h} className={`p-4 text-[10px] font-bold text-slate-600 uppercase tracking-wider ${
                        ['User','Network'].includes(h) ? 'text-left' : h === '' ? '' : 'text-right'
                      }`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {deposits.map((d: any) => (
                    <tr key={d.id}
                      onClick={() => setDetail(detail?.id === d.id ? null : d)}
                      className={`table-row-hover cursor-pointer transition-colors ${
                        detail?.id === d.id ? 'bg-neon-green/5' : ''
                      }`}>
                      <td className="p-4">
                        <p className="text-slate-200 font-semibold text-sm">
                          {d.users?.first_name
                            ? `${d.users.first_name} ${d.users.last_name ?? ''}`.trim()
                            : d.users?.email ?? 'Unknown'}
                        </p>
                        <p className="text-xs text-slate-600">{d.users?.email}</p>
                      </td>
                      <td className="p-4 text-right">
                        <p className="font-mono font-bold text-slate-200">{formatNumber(d.amount, 4)}</p>
                        <p className="text-xs text-slate-600">{d.assets?.symbol}</p>
                      </td>
                      <td className="p-4">
                        <span className="badge bg-dark-700 text-slate-400 border border-white/[0.06] text-xs">{d.network}</span>
                      </td>
                      <td className="p-4 text-right">
                        <span className={`badge text-xs ${statusColors[d.status] ?? 'bg-dark-700 text-slate-400'}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="p-4 text-right text-xs text-slate-600 whitespace-nowrap">{formatDate(d.created_at)}</td>
                      <td className="p-4 text-right">
                        <Eye size={14} className={`ml-auto transition-colors ${detail?.id === d.id ? 'text-neon-green' : 'text-slate-600 hover:text-neon-green'}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {detail && (
          <div className="lg:col-span-1 animate-slide-up">
            <div className="card border border-white/[0.08] sticky top-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-sm">Deposit Detail</h3>
                <button onClick={() => setDetail(null)} className="text-slate-600 hover:text-slate-300 text-lg">✕</button>
              </div>

              {/* User */}
              <div className="bg-white/[0.03] rounded-xl p-4 space-y-2 border border-white/[0.05]">
                <div className="flex items-center gap-2 mb-1">
                  <User size={12} className="text-neon-cyan" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">User</span>
                </div>
                <p className="text-white font-bold">
                  {detail.users?.first_name
                    ? `${detail.users.first_name} ${detail.users.last_name ?? ''}`.trim()
                    : 'No name set'}
                </p>
                <p className="text-xs text-slate-500">{detail.users?.email}</p>
                <p className="text-xs text-slate-600">
                  Member since {detail.users?.created_at ? new Date(detail.users.created_at).toLocaleDateString() : '—'}
                </p>
              </div>

              {/* Deposit info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Coins size={12} className="text-neon-green" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Deposit Info</span>
                </div>
                {[
                  { label: 'Amount',    value: `${formatNumber(detail.amount, 6)} ${detail.assets?.symbol ?? ''}` },
                  { label: 'Asset',     value: detail.assets?.name ?? '—' },
                  { label: 'Network',   value: detail.network },
                  { label: 'Status',    value: detail.status, isStatus: true },
                  { label: 'Submitted', value: formatDate(detail.created_at) },
                  { label: 'TX Hash',   value: detail.tx_hash ? detail.tx_hash.slice(0, 16) + '...' : 'Not provided' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-start gap-3">
                    <span className="text-xs text-slate-600 flex-shrink-0">{row.label}</span>
                    <span className={`text-xs font-mono text-right ${
                      row.isStatus
                        ? detail.status === 'pending'   ? 'text-yellow-400'
                        : detail.status === 'completed' ? 'text-neon-green'
                        : 'text-neon-red'
                        : 'text-slate-300'
                    }`}>{row.value}</span>
                  </div>
                ))}
              </div>

              {detail.status === 'pending' && (
                <>
                  <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Admin Note (optional)</label>
                    <textarea
                      value={notes[detail.id] || ''}
                      onChange={e => setNotes(n => ({ ...n, [detail.id]: e.target.value }))}
                      placeholder="Add a note..."
                      rows={2}
                      className="input text-xs resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setApproveModal({ deposit: detail, verifiedAmount: String(detail.amount), note: notes[detail.id] || '' })}
                      disabled={processing === detail.id}
                      className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-black transition-all disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #00ff88, #00cc6a)', color: '#050810', boxShadow: '0 0 20px rgba(0,255,136,0.3)' }}
                    >
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button
                      onClick={() => handleAction(detail, 'rejected')}
                      disabled={processing === detail.id}
                      className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-black bg-neon-red/10 text-neon-red border border-neon-red/30 hover:bg-neon-red/20 disabled:opacity-50 transition-all"
                    >
                      <XCircle size={13} /> Reject
                    </button>
                  </div>
                </>
              )}

              {detail.status !== 'pending' && detail.admin_notes && (
                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Admin Note</p>
                  <p className="text-xs text-slate-400">{detail.admin_notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Approve Confirmation Modal */}
      {approveModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={e => { if (e.target === e.currentTarget) setApproveModal(null) }}>
          <div className="bg-dark-800 border border-neon-green/20 rounded-2xl p-6 w-full max-w-md shadow-neon-green animate-slide-up">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-neon-green/10 flex items-center justify-center border border-neon-green/20">
                <AlertTriangle size={18} className="text-neon-green" />
              </div>
              <div>
                <h3 className="font-black text-white">Verify Deposit Amount</h3>
                <p className="text-xs text-slate-500">Review before crediting user's wallet</p>
              </div>
            </div>

            {/* User summary */}
            <div className="bg-white/[0.03] rounded-xl p-4 mb-4 border border-white/[0.06] space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">User</span>
                <span className="text-slate-200 font-medium">
                  {approveModal.deposit.users?.first_name
                    ? `${approveModal.deposit.users.first_name} ${approveModal.deposit.users.last_name ?? ''}`.trim()
                    : approveModal.deposit.users?.email}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Asset</span>
                <span className="text-slate-200">{approveModal.deposit.assets?.symbol}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Network</span>
                <span className="text-slate-200">{approveModal.deposit.network}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-white/[0.06] pt-2">
                <span className="text-slate-500">User entered</span>
                <span className="font-mono font-bold text-yellow-400">{formatNumber(approveModal.deposit.amount, 6)} {approveModal.deposit.assets?.symbol}</span>
              </div>
            </div>

            {/* Editable amount */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                Credit Amount (editable) <span className="text-neon-green">*</span>
              </label>
              <input
                type="number"
                value={approveModal.verifiedAmount}
                onChange={e => setApproveModal(m => m ? { ...m, verifiedAmount: e.target.value } : null)}
                className="input font-mono text-lg font-bold text-neon-green"
                step="any"
                min="0"
                autoFocus
              />
              {parseFloat(approveModal.verifiedAmount) !== Number(approveModal.deposit.amount) && (
                <p className="text-xs text-yellow-400 mt-1.5 flex items-center gap-1">
                  <AlertTriangle size={11} />
                  Amount differs from user's entry ({formatNumber(approveModal.deposit.amount, 6)})
                </p>
              )}
            </div>

            {/* Admin note */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Admin Note (optional)</label>
              <input
                value={approveModal.note}
                onChange={e => setApproveModal(m => m ? { ...m, note: e.target.value } : null)}
                placeholder="e.g. Corrected amount from 1000 to 100"
                className="input text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setApproveModal(null)}
                className="btn-secondary py-3 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const amount = parseFloat(approveModal.verifiedAmount)
                  if (!amount || amount <= 0) { alert('Enter a valid amount'); return }
                  const dep = approveModal.deposit
                  setNotes(n => ({ ...n, [dep.id]: approveModal.note }))
                  setApproveModal(null)
                  setDetail(null)
                  await handleAction({ ...dep, _adminNote: approveModal.note }, 'approved', amount)
                }}
                disabled={!approveModal.verifiedAmount || parseFloat(approveModal.verifiedAmount) <= 0 || processing === approveModal.deposit.id}
                className="py-3 rounded-xl font-black text-sm transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #00ff88, #00cc6a)', color: '#050810', boxShadow: '0 0 20px rgba(0,255,136,0.3)' }}
              >
                {processing ? 'Processing...' : 'Confirm & Credit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
