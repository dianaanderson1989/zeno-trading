import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { formatNumber } from '@/utils/format'
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react'
import type { StakingPool } from '@/types'

const EMPTY_FORM = {
  asset_id: '', name: '', description: '',
  apy_rate: '', min_stake_amount: '', max_stake_amount: '',
  lock_period_days: '', is_active: true,
}

// OUTSIDE component — prevents focus loss on keystroke re-render
function PoolFormFields({ values, onChange }: {
  values: any
  onChange: (k: string, v: any) => void
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
      <div className="col-span-2 lg:col-span-1">
        <label className="block text-xs text-slate-500 mb-1">Pool Name</label>
        <input
          value={values.name}
          onChange={e => onChange('name', e.target.value)}
          className="input text-sm" placeholder="e.g. ETH 2.0 Staking" />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">APY %</label>
        <input type="number"
          value={values.apy_rate}
          onChange={e => onChange('apy_rate', e.target.value)}
          className="input text-sm" placeholder="5.00" />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Lock Days</label>
        <input type="number"
          value={values.lock_period_days}
          onChange={e => onChange('lock_period_days', e.target.value)}
          className="input text-sm" placeholder="30" />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Min Stake</label>
        <input type="number"
          value={values.min_stake_amount}
          onChange={e => onChange('min_stake_amount', e.target.value)}
          className="input text-sm" placeholder="0.01" />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Max Stake (optional)</label>
        <input type="number"
          value={values.max_stake_amount}
          onChange={e => onChange('max_stake_amount', e.target.value)}
          className="input text-sm" placeholder="No limit" />
      </div>
      <div className="col-span-2 lg:col-span-3">
        <label className="block text-xs text-slate-500 mb-1">Description (optional)</label>
        <input
          value={values.description}
          onChange={e => onChange('description', e.target.value)}
          className="input text-sm" placeholder="Pool description..." />
      </div>
      <div className="flex items-center gap-3 col-span-2 lg:col-span-3">
        <label className="text-xs text-slate-400">Active</label>
        <button type="button" onClick={() => onChange('is_active', !values.is_active)}
          className={`relative w-10 h-5 rounded-full transition-all ${values.is_active ? 'bg-neon-green' : 'bg-dark-600'}`}>
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${values.is_active ? 'left-[calc(100%-18px)]' : 'left-0.5'}`} />
        </button>
        <span className={`text-xs ${values.is_active ? 'text-neon-green' : 'text-slate-500'}`}>
          {values.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
    </div>
  )
}

export function AdminStaking() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<any>({})
  const [creating, setCreating] = useState(false)
  const [newPool, setNewPool] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const { data: pools = [], isLoading } = useQuery({
    queryKey: ['admin_staking_pools'],
    queryFn: async () => {
      const { data } = await supabase
        .from('staking_pools').select('*, assets(*)')
        .order('apy_rate', { ascending: false })
      return (data ?? []) as StakingPool[]
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

  const startEdit = (pool: StakingPool) => {
    setEditing(pool.id)
    setEditValues({
      name: pool.name,
      description: pool.description ?? '',
      apy_rate: pool.apy_rate,
      min_stake_amount: pool.min_stake_amount,
      max_stake_amount: pool.max_stake_amount ?? '',
      lock_period_days: pool.lock_period_days,
      is_active: pool.is_active,
    })
  }

  const saveEdit = async (poolId: string) => {
    setSaving(true)
    const { error } = await supabase.from('staking_pools').update({
      name: editValues.name,
      description: editValues.description || null,
      apy_rate: parseFloat(editValues.apy_rate),
      min_stake_amount: parseFloat(editValues.min_stake_amount) || 0,
      max_stake_amount: editValues.max_stake_amount ? parseFloat(editValues.max_stake_amount) : null,
      lock_period_days: parseInt(editValues.lock_period_days) || 0,
      is_active: editValues.is_active,
    }).eq('id', poolId)
    setSaving(false)
    if (error) { setMsg('Error: ' + error.message); return }
    setEditing(null)
    queryClient.invalidateQueries({ queryKey: ['admin_staking_pools'] })
    queryClient.invalidateQueries({ queryKey: ['staking_pools'] })
  }

  const createPool = async () => {
    if (!newPool.asset_id || !newPool.name || !newPool.apy_rate) {
      setMsg('Asset, name and APY are required'); return
    }
    setSaving(true); setMsg('')
    const { error } = await supabase.from('staking_pools').insert({
      asset_id: newPool.asset_id,
      name: newPool.name,
      description: newPool.description || null,
      apy_rate: parseFloat(newPool.apy_rate),
      min_stake_amount: parseFloat(newPool.min_stake_amount) || 0,
      max_stake_amount: newPool.max_stake_amount ? parseFloat(newPool.max_stake_amount) : null,
      lock_period_days: parseInt(newPool.lock_period_days) || 0,
      is_active: newPool.is_active,
      total_staked: 0,
    })
    setSaving(false)
    if (error) { setMsg('Error: ' + error.message); return }
    setCreating(false)
    setNewPool({ ...EMPTY_FORM })
    queryClient.invalidateQueries({ queryKey: ['admin_staking_pools'] })
    queryClient.invalidateQueries({ queryKey: ['staking_pools'] })
  }

  const deletePool = async (poolId: string) => {
    if (!confirm('Delete this staking pool? Users with active stakes will be unaffected.')) return
    await supabase.from('staking_pools').delete().eq('id', poolId)
    queryClient.invalidateQueries({ queryKey: ['admin_staking_pools'] })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">Staking Pools</h1>
        <button onClick={() => { setCreating(true); setMsg('') }}
          className="btn-primary flex items-center gap-2 text-sm py-2">
          <Plus size={14} /> New Pool
        </button>
      </div>

      {/* Create new pool */}
      {creating && (
        <div className="card border border-neon-green/20 bg-neon-green/5 animate-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">Create New Pool</h3>
            <button onClick={() => { setCreating(false); setMsg('') }} className="text-slate-500 hover:text-slate-300">
              <X size={16} />
            </button>
          </div>
          <div className="mt-3">
            <label className="block text-xs text-slate-500 mb-1">Asset</label>
            <select
              value={newPool.asset_id}
              onChange={e => setNewPool(p => ({ ...p, asset_id: e.target.value }))}
              className="input text-sm">
              <option value="">Select asset</option>
              {assets.map((a: any) => (
                <option key={a.id} value={a.id}>{a.symbol} — {a.name}</option>
              ))}
            </select>
          </div>
          <PoolFormFields
            values={newPool}
            onChange={(k, v) => setNewPool(p => ({ ...p, [k]: v }))}
          />
          {msg && (
            <p className={`text-xs mt-3 p-2 rounded-xl ${msg.startsWith('Error') ? 'bg-neon-red/10 text-neon-red' : 'bg-neon-green/10 text-neon-green'}`}>
              {msg}
            </p>
          )}
          <div className="flex gap-3 mt-4">
            <button onClick={() => { setCreating(false); setMsg('') }} className="btn-secondary text-sm flex-1">Cancel</button>
            <button onClick={createPool} disabled={saving} className="btn-primary text-sm flex-1">
              {saving ? 'Creating...' : 'Create Pool'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl shimmer" />)}</div>
      ) : pools.length === 0 ? (
        <div className="card text-center py-12 text-slate-500">No staking pools yet. Create one above.</div>
      ) : (
        <div className="space-y-4">
          {pools.map(pool => (
            <div key={pool.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {(pool as any).assets?.icon_url && (
                    <img src={(pool as any).assets.icon_url} alt="" className="w-9 h-9 rounded-full" />
                  )}
                  <div>
                    <p className="font-bold text-white">{pool.name}</p>
                    <p className="text-xs text-slate-500">
                      {(pool as any).assets?.symbol} · Staked: {formatNumber(pool.total_staked, 2)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`badge text-xs ${pool.is_active ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' : 'bg-slate-500/15 text-slate-400'}`}>
                    {pool.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {editing !== pool.id ? (
                    <>
                      <button onClick={() => startEdit(pool)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => deletePool(pool.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-neon-red/10 text-neon-red hover:bg-neon-red/20 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => saveEdit(pool.id)} disabled={saving}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-neon-green/10 text-neon-green hover:bg-neon-green/20 transition-colors">
                        <Check size={13} />
                      </button>
                      <button onClick={() => setEditing(null)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] text-slate-400 hover:text-white transition-colors">
                        <X size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {editing === pool.id ? (
                <PoolFormFields
                  values={editValues}
                  onChange={(k, v) => setEditValues((prev: any) => ({ ...prev, [k]: v }))}
                />
              ) : (
                <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-white/[0.05] text-sm">
                  <span className="text-slate-400">APY: <span className="text-neon-green font-bold">{pool.apy_rate}%</span></span>
                  <span className="text-slate-400">Lock: <span className="text-slate-200">{pool.lock_period_days}d</span></span>
                  <span className="text-slate-400">Min: <span className="text-slate-200">{pool.min_stake_amount}</span></span>
                  {pool.max_stake_amount && (
                    <span className="text-slate-400">Max: <span className="text-slate-200">{pool.max_stake_amount}</span></span>
                  )}
                  {pool.description && (
                    <span className="text-slate-500 text-xs w-full">{pool.description}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
