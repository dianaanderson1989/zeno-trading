import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export function AdminDepositAddresses() {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ asset_id: '', network: '', address: '', label: '' })
  const [editForm, setEditForm] = useState({ network: '', address: '', label: '' })
  const [saving, setSaving] = useState(false)

  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data } = await supabase.from('assets').select('*').eq('is_active', true)
      return data ?? []
    },
    staleTime: Infinity,
  })

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ['deposit_addresses_admin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('deposit_addresses')
        .select('*, assets(*)')
        .order('created_at', { ascending: false })
      return data ?? []
    },
    staleTime: 15_000,
  })

  const handleAdd = async () => {
    if (!form.asset_id || !form.network || !form.address) return
    setSaving(true)
    await supabase.from('deposit_addresses').upsert({
      asset_id: form.asset_id,
      network: form.network,
      address: form.address,
      label: form.label || null,
      is_active: true,
    }, { onConflict: 'asset_id,network' })
    setSaving(false)
    setAdding(false)
    setForm({ asset_id: '', network: '', address: '', label: '' })
    queryClient.invalidateQueries({ queryKey: ['deposit_addresses_admin'] })
  }

  const handleEdit = async (id: string) => {
    setSaving(true)
    await supabase.from('deposit_addresses').update({
      network: editForm.network,
      address: editForm.address,
      label: editForm.label,
    }).eq('id', id)
    setSaving(false)
    setEditingId(null)
    queryClient.invalidateQueries({ queryKey: ['deposit_addresses_admin'] })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this deposit address?')) return
    await supabase.from('deposit_addresses').delete().eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['deposit_addresses_admin'] })
  }

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('deposit_addresses').update({ is_active: !current }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['deposit_addresses_admin'] })
  }

  const networks = ['ERC20', 'TRC20', 'BEP20', 'BTC', 'SOL', 'Polygon', 'Arbitrum', 'Optimism']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Deposit Addresses</h1>
        <button onClick={() => setAdding(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Add Address
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="card border border-brand-500/30">
          <h3 className="font-semibold text-white mb-4">New Deposit Address</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Asset</label>
              <select value={form.asset_id} onChange={e => setForm(f => ({ ...f, asset_id: e.target.value }))} className="input text-sm">
                <option value="">Select asset</option>
                {assets.map((a: any) => <option key={a.id} value={a.id}>{a.symbol} — {a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Network</label>
              <select value={form.network} onChange={e => setForm(f => ({ ...f, network: e.target.value }))} className="input text-sm">
                <option value="">Select network</option>
                {networks.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1.5">Wallet Address</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="0x... or bc1..." className="input text-sm font-mono" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1.5">Label (optional)</label>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Ethereum Mainnet" className="input text-sm" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setAdding(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleAdd} disabled={saving || !form.asset_id || !form.network || !form.address} className="btn-primary text-sm">
              {saving ? 'Saving...' : 'Save Address'}
            </button>
          </div>
        </div>
      )}

      {/* Addresses list */}
      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-dark-700 rounded animate-pulse" />)}</div>
        ) : addresses.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No deposit addresses yet. Add one above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-600 text-gray-500 text-xs uppercase">
                <th className="text-left p-4 font-medium">Asset</th>
                <th className="text-left p-4 font-medium">Network</th>
                <th className="text-left p-4 font-medium">Address</th>
                <th className="text-left p-4 font-medium">Label</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-600">
              {addresses.map((a: any) => (
                <tr key={a.id} className={`hover:bg-dark-700/40 ${!a.is_active ? 'opacity-50' : ''}`}>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {a.assets?.icon_url && <img src={a.assets.icon_url} alt="" className="w-6 h-6 rounded-full" />}
                      <span className="text-gray-200 font-medium">{a.assets?.symbol}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="badge bg-dark-600 text-gray-300">{a.network}</span>
                  </td>
                  <td className="p-4">
                    {editingId === a.id ? (
                      <input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} className="input text-xs font-mono py-1" />
                    ) : (
                      <span className="font-mono text-xs text-gray-300 truncate max-w-[200px] block">{a.address}</span>
                    )}
                  </td>
                  <td className="p-4">
                    {editingId === a.id ? (
                      <input value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))} className="input text-xs py-1" />
                    ) : (
                      <span className="text-gray-400 text-xs">{a.label || '—'}</span>
                    )}
                  </td>
                  <td className="p-4">
                    <button onClick={() => toggleActive(a.id, a.is_active)}
                      className={`badge cursor-pointer ${a.is_active ? 'bg-brand-500/15 text-brand-400' : 'bg-gray-500/15 text-gray-400'}`}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      {editingId === a.id ? (
                        <>
                          <button onClick={() => handleEdit(a.id)} disabled={saving} className="text-brand-400 hover:text-brand-300"><Check size={15} /></button>
                          <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-200"><X size={15} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingId(a.id); setEditForm({ network: a.network, address: a.address, label: a.label || '' }) }}
                            className="text-gray-400 hover:text-gray-200"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(a.id)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
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
