import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency } from '@/utils/format'
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
    staleTime: 30_000,
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

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase())
  )

  const updateStatus = async (user: User, status: string) => {
    await supabase.from('users').update({ status }).eq('id', user.id)
    queryClient.invalidateQueries({ queryKey: ['admin_users'] })
  }

  const adjustBalance = async () => {
    if (!selectedUser || !adjustAsset || !adjustAmount) return
    setSaving(true)
    setMsg('')
    const asset = assets.find((a: any) => a.id === adjustAsset)
    const amount = parseFloat(adjustAmount)
    const { error } = await supabase.rpc('execute_market_order', {
      p_user_id: selectedUser.id,
      p_base_asset_id: adjustAsset,
      p_quote_asset_id: adjustAsset,
      p_side: 'buy',
      p_quantity: Math.abs(amount),
      p_price: 0,
    }).then(() => {
      // Simpler: direct wallet update
      return supabase.from('wallets')
        .select('balance')
        .eq('user_id', selectedUser.id)
        .eq('asset_id', adjustAsset)
        .single()
    }).then(async ({ data: wallet }: any) => {
      const newBalance = Math.max(0, (wallet?.balance ?? 0) + amount)
      const r = await supabase.from('wallets').update({ balance: newBalance })
        .eq('user_id', selectedUser.id).eq('asset_id', adjustAsset)
      await supabase.from('transactions').insert({
        user_id: selectedUser.id,
        transaction_type: 'admin_adjustment',
        asset_id: adjustAsset,
        amount: Math.abs(amount),
        description: adjustNote || `Admin adjustment: ${amount > 0 ? '+' : ''}${amount}`,
        status: 'completed',
      })
      await supabase.from('audit_logs').insert({
        admin_id: (await supabase.auth.getUser()).data.user?.id,
        user_id: selectedUser.id,
        action: 'balance_adjustment',
        resource_type: 'wallet',
        new_values: { asset_id: adjustAsset, amount, note: adjustNote },
      })
      return r
    })
    setSaving(false)
    setMsg(error ? 'Error: ' + (error as any).message : `Balance adjusted by ${amount > 0 ? '+' : ''}${amount}`)
    setAdjustAmount('')
    setAdjustNote('')
    queryClient.invalidateQueries({ queryKey: ['admin_user_wallets'] })
  }

  const statusColors: Record<string, string> = {
    active: 'bg-brand-500/15 text-brand-400',
    suspended: 'bg-yellow-500/15 text-yellow-400',
    banned: 'bg-red-500/15 text-red-400',
    pending_verification: 'bg-gray-500/15 text-gray-400',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="input text-sm pl-9 w-64" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className={`${selectedUser ? 'lg:col-span-3' : 'lg:col-span-5'} card overflow-hidden p-0`}>
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-dark-700 rounded-lg animate-pulse" />)}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600 text-gray-500 text-xs uppercase">
                  <th className="text-left p-4 font-medium">User</th>
                  <th className="text-left p-4 font-medium hidden md:table-cell">Role</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium hidden md:table-cell">Joined</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-600">
                {filtered.map(user => (
                  <tr
                    key={user.id}
                    onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                    className={`cursor-pointer transition-colors ${selectedUser?.id === user.id ? 'bg-brand-500/10' : 'hover:bg-dark-700/40'}`}
                  >
                    <td className="p-4">
                      <p className="text-gray-200 font-medium">{user.first_name ? `${user.first_name} ${user.last_name ?? ''}` : '—'}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <span className="badge bg-dark-600 text-gray-300 capitalize">{user.role.replace('_', ' ')}</span>
                    </td>
                    <td className="p-4">
                      <span className={`badge ${statusColors[user.status] ?? 'bg-gray-500/15 text-gray-400'}`}>{user.status}</span>
                    </td>
                    <td className="p-4 text-xs text-gray-500 hidden md:table-cell">{formatDate(user.created_at)}</td>
                    <td className="p-4 text-right text-brand-400 text-xs">Details →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* User detail panel */}
        {selectedUser && (
          <div className="lg:col-span-2 space-y-4">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">User Detail</h3>
                <button onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-gray-300 text-xs">✕ Close</button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Email</span><span className="text-gray-200 truncate ml-2">{selectedUser.email}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Role</span><span className="text-gray-200 capitalize">{selectedUser.role}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">KYC</span><span className="text-gray-200">{selectedUser.kyc_status} (L{selectedUser.kyc_level})</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Status</span>
                  <select
                    value={selectedUser.status}
                    onChange={e => updateStatus(selectedUser, e.target.value)}
                    className="bg-dark-600 border border-dark-400 text-gray-200 text-xs rounded px-2 py-0.5"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="banned">Banned</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Wallets */}
            <div className="card">
              <h3 className="font-semibold text-white mb-3">Wallets</h3>
              <div className="space-y-1.5">
                {userWallets.map((w: any) => (
                  <div key={w.id} className="flex justify-between text-sm">
                    <span className="text-gray-400">{w.assets?.symbol}</span>
                    <span className="text-gray-200 font-mono">{Number(w.balance).toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Adjust balance */}
            <div className="card">
              <h3 className="font-semibold text-white mb-3">Adjust Balance</h3>
              <div className="space-y-2">
                <select value={adjustAsset} onChange={e => setAdjustAsset(e.target.value)} className="input text-sm">
                  <option value="">Select asset</option>
                  {assets.map((a: any) => <option key={a.id} value={a.id}>{a.symbol}</option>)}
                </select>
                <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="Amount (+/-)" className="input text-sm" />
                <input value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="Note (optional)" className="input text-sm" />
                {msg && <p className={`text-xs p-2 rounded ${msg.startsWith('Error') ? 'bg-red-500/10 text-red-400' : 'bg-brand-500/10 text-brand-400'}`}>{msg}</p>}
                <button onClick={adjustBalance} disabled={saving || !adjustAsset || !adjustAmount} className="btn-primary w-full text-sm">
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
