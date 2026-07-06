import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Shield, ShieldCheck, ShieldX } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/utils/format'
import type { User } from '@/types'

export function AdminUsers() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [adjustAsset, setAdjustAsset] = useState('')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
      return (data ?? []) as User[]
    },
    staleTime: 20_000,
  })

  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data } = await supabase.from('assets').select('*').eq('is_active', true)
      return data ?? []
    },
    staleTime: Infinity,
  })

  const { data: userWallets = [] } = useQuery({
    queryKey: ['admin_user_wallets', selectedUser?.id],
    enabled: !!selectedUser,
    queryFn: async () => {
      const { data } = await supabase.from('wallets').select('*, assets(*)').eq('user_id', selectedUser!.id)
      return data ?? []
    },
  })

  // Load per-user admin settings for selected user
  const { data: userSettings } = useQuery({
    queryKey: ['admin_user_settings', selectedUser?.id],
    enabled: !!selectedUser,
    queryFn: async () => {
      const { data } = await supabase
        .from('admin_user_settings')
        .select('*')
        .eq('user_id', selectedUser!.id)
        .maybeSingle()
      return data
    },
    staleTime: 10_000,
  })

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    `${u.first_name ?? ''} ${u.last_name ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )

  // Update account status
  const updateStatus = async (user: User, status: string) => {
    await supabase.from('users').update({ status }).eq('id', user.id)
    queryClient.invalidateQueries({ queryKey: ['admin_users'] })
  }

  // Update KYC status + notify user
  const updateKyc = async (user: User, kyc_status: string) => {
    await supabase.from('users').update({ kyc_status }).eq('id', user.id)
    const msgs: Record<string, { type: string; title: string; message: string }> = {
      approved:  { type: 'kyc_approved',  title: '✅ KYC Approved',      message: 'Your identity has been verified! You now have full access to all platform features.' },
      rejected:  { type: 'kyc_rejected',  title: '❌ KYC Rejected',      message: 'Your identity verification was rejected. Please resubmit your documents.' },
      in_review: { type: 'kyc_in_review', title: '🔍 KYC Under Review',  message: 'Your identity documents are currently being reviewed. This usually takes 1–2 business days.' },
    }
    if (msgs[kyc_status]) {
      await supabase.from('notifications').insert({ user_id: user.id, metadata: {}, ...msgs[kyc_status] })
    }
    queryClient.invalidateQueries({ queryKey: ['admin_users'] })
  }

  // Toggle per-user KYC enforcement
  const toggleKycEnforcement = async (userId: string, current: boolean) => {
    const newValue = !current
    const adminId = (await supabase.auth.getUser()).data.user?.id
    await supabase.from('admin_user_settings').upsert({
      user_id: userId,
      require_kyc: newValue,
      updated_by: adminId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    // Notify user if KYC is now required
    if (newValue) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'kyc_in_review',
        title: '⚠️ KYC Verification Required',
        message: 'KYC verification is now required on your account before you can make withdrawals. Please go to Account Settings → Verification to submit your documents.',
        metadata: { enforced_by_admin: true },
      })
    }

    queryClient.invalidateQueries({ queryKey: ['admin_user_settings', userId] })
  }

  // Adjust wallet balance
  const adjustBalance = async () => {
    if (!selectedUser || !adjustAsset || !adjustAmount) return
    setSaving(true)
    setMsg('')
    const amount = parseFloat(adjustAmount)
    try {
      const { data: wallet } = await supabase.from('wallets')
        .select('balance').eq('user_id', selectedUser.id).eq('asset_id', adjustAsset).single()
      const newBalance = Math.max(0, (wallet?.balance ?? 0) + amount)
      await supabase.from('wallets').update({ balance: newBalance })
        .eq('user_id', selectedUser.id).eq('asset_id', adjustAsset)
      await supabase.from('transactions').insert({
        user_id: selectedUser.id,
        transaction_type: 'admin_adjustment',
        asset_id: adjustAsset,
        amount: Math.abs(amount),
        description: adjustNote || `Admin adjustment: ${amount > 0 ? '+' : ''}${amount}`,
        status: 'completed',
      })
      setMsg(`Balance adjusted by ${amount > 0 ? '+' : ''}${amount}`)
      setAdjustAmount('')
      setAdjustNote('')
      queryClient.invalidateQueries({ queryKey: ['admin_user_wallets'] })
    } catch (e: any) {
      setMsg('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const statusColors: Record<string, string> = {
    active:               'bg-neon-green/10 text-neon-green border border-neon-green/20',
    suspended:            'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',
    banned:               'bg-neon-red/10 text-neon-red border border-neon-red/20',
    pending_verification: 'bg-slate-500/15 text-slate-400 border border-slate-500/20',
  }

  const kycColors: Record<string, string> = {
    pending:   'bg-slate-500/15 text-slate-400',
    in_review: 'bg-yellow-500/15 text-yellow-400',
    approved:  'bg-neon-green/10 text-neon-green',
    rejected:  'bg-neon-red/10 text-neon-red',
  }

  const kycEnforced = userSettings?.require_kyc ?? false

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">Users</h1>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search users..." className="input text-sm pl-9 w-64" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* User list */}
        <div className={`${selectedUser ? 'lg:col-span-3' : 'lg:col-span-5'} card overflow-hidden p-0`}>
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl shimmer" />)}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {['User', 'KYC', 'Status', 'Joined', ''].map(h => (
                    <th key={h} className={`p-4 text-[10px] font-bold text-slate-600 uppercase tracking-wider ${h === 'User' || h === 'KYC' ? 'text-left' : h === '' ? '' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filtered.map(user => {
                  // Check if this user has KYC enforced — need to load from settings
                  return (
                    <tr key={user.id}
                      onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                      className={`cursor-pointer transition-colors ${selectedUser?.id === user.id ? 'bg-neon-green/5' : 'hover:bg-white/[0.02]'}`}>
                      <td className="p-4">
                        <p className="text-slate-200 font-semibold text-sm">
                          {user.first_name ? `${user.first_name} ${user.last_name ?? ''}` : '—'}
                        </p>
                        <p className="text-xs text-slate-600">{user.email}</p>
                      </td>
                      <td className="p-4">
                        <span className={`badge text-xs ${kycColors[user.kyc_status] ?? kycColors.pending}`}>
                          {user.kyc_status ?? 'pending'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`badge text-xs ${statusColors[user.status] ?? 'bg-slate-500/15 text-slate-400'}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-600 hidden md:table-cell">{formatDate(user.created_at)}</td>
                      <td className="p-4 text-right text-neon-green/50 text-xs">Details →</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {selectedUser && (
          <div className="lg:col-span-2 space-y-4 animate-slide-up">

            {/* Info + controls */}
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-sm">User Detail</h3>
                <button onClick={() => setSelectedUser(null)} className="text-slate-600 hover:text-slate-300 text-lg leading-none">✕</button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Email</span>
                  <span className="text-slate-200 text-xs truncate ml-2 max-w-[180px]">{selectedUser.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Role</span>
                  <span className="text-slate-200 capitalize">{selectedUser.role.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Status</span>
                  <select value={selectedUser.status} onChange={e => updateStatus(selectedUser, e.target.value)}
                    className="bg-dark-700 border border-white/[0.08] text-slate-200 text-xs rounded-lg px-2 py-1">
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="banned">Banned</option>
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">KYC Status</span>
                  <select value={selectedUser.kyc_status ?? 'pending'} onChange={e => updateKyc(selectedUser, e.target.value)}
                    className="bg-dark-700 border border-white/[0.08] text-slate-200 text-xs rounded-lg px-2 py-1">
                    <option value="pending">Pending</option>
                    <option value="in_review">In Review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {/* Per-user KYC enforcement toggle */}
              <div className="pt-3 border-t border-white/[0.06]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${kycEnforced ? 'bg-neon-green/10' : 'bg-slate-500/10'}`}>
                      {kycEnforced
                        ? <ShieldCheck size={15} className="text-neon-green" />
                        : <ShieldX size={15} className="text-slate-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">Enforce KYC</p>
                      <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                        {kycEnforced
                          ? 'KYC required — user cannot withdraw without verification'
                          : 'No forced KYC — platform defaults apply'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleKycEnforcement(selectedUser.id, kycEnforced)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0 mt-1 ${kycEnforced ? 'bg-neon-green shadow-neon-green' : 'bg-dark-600'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200 ${kycEnforced ? 'left-[calc(100%-22px)]' : 'left-0.5'}`} />
                  </button>
                </div>

                {kycEnforced && selectedUser.kyc_status !== 'approved' && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/5 border border-yellow-500/15 rounded-xl px-3 py-2">
                    <Shield size={11} />
                    Withdrawals blocked — user must complete KYC
                  </div>
                )}
                {kycEnforced && selectedUser.kyc_status === 'approved' && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-neon-green bg-neon-green/5 border border-neon-green/15 rounded-xl px-3 py-2">
                    <ShieldCheck size={11} />
                    KYC enforced and verified — withdrawals allowed
                  </div>
                )}
              </div>
            </div>

            {/* Wallets */}
            <div className="card">
              <h3 className="font-bold text-white text-sm mb-3">Wallets</h3>
              <div className="space-y-1.5">
                {userWallets.map((w: any) => (
                  <div key={w.id} className="flex justify-between text-sm py-1">
                    <span className="text-slate-500">{w.assets?.symbol}</span>
                    <span className="text-slate-200 font-mono">{Number(w.balance).toFixed(6)}</span>
                  </div>
                ))}
                {userWallets.length === 0 && <p className="text-xs text-slate-600">No wallets found</p>}
              </div>
            </div>

            {/* Balance adjustment */}
            <div className="card">
              <h3 className="font-bold text-white text-sm mb-3">Adjust Balance</h3>
              <div className="space-y-2">
                <select value={adjustAsset} onChange={e => setAdjustAsset(e.target.value)} className="input text-sm">
                  <option value="">Select asset</option>
                  {assets.map((a: any) => <option key={a.id} value={a.id}>{a.symbol}</option>)}
                </select>
                <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)}
                  placeholder="Amount (+/-)" className="input text-sm" />
                <input value={adjustNote} onChange={e => setAdjustNote(e.target.value)}
                  placeholder="Note (optional)" className="input text-sm" />
                {msg && (
                  <p className={`text-xs p-2 rounded-xl ${msg.startsWith('Error') ? 'bg-neon-red/10 text-neon-red' : 'bg-neon-green/10 text-neon-green'}`}>
                    {msg}
                  </p>
                )}
                <button onClick={adjustBalance} disabled={saving || !adjustAsset || !adjustAmount}
                  className="btn-primary w-full text-sm py-2.5">
                  {saving ? 'Saving...' : 'Apply Adjustment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
