import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { formatNumber } from '@/utils/format'
import type { StakingPool } from '@/types'

export function AdminStaking() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<StakingPool>>({})
  const [saving, setSaving] = useState(false)

  const { data: pools = [], isLoading } = useQuery({
    queryKey: ['admin_staking_pools'],
    queryFn: async () => {
      const { data } = await supabase.from('staking_pools').select('*, assets(*)').order('apy_rate', { ascending: false })
      return (data ?? []) as StakingPool[]
    },
    staleTime: 30_000,
  })

  const startEdit = (pool: StakingPool) => {
    setEditing(pool.id)
    setEditValues({ apy_rate: pool.apy_rate, min_stake_amount: pool.min_stake_amount, lock_period_days: pool.lock_period_days, is_active: pool.is_active })
  }

  const saveEdit = async (poolId: string) => {
    setSaving(true)
    await supabase.from('staking_pools').update(editValues).eq('id', poolId)
    setSaving(false)
    setEditing(null)
    queryClient.invalidateQueries({ queryKey: ['admin_staking_pools'] })
    queryClient.invalidateQueries({ queryKey: ['staking_pools'] })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Staking Pools</h1>
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-dark-800 rounded-xl animate-pulse" />)}</div>
        ) : pools.map(pool => (
          <div key={pool.id} className="card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {(pool as any).assets?.icon_url && <img src={(pool as any).assets.icon_url} alt="" className="w-8 h-8 rounded-full" />}
                <div>
                  <p className="font-semibold text-white">{pool.name}</p>
                  <p className="text-xs text-gray-400">{(pool as any).assets?.symbol} • Total staked: {formatNumber(pool.total_staked, 2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${pool.is_active ? 'bg-brand-500/15 text-brand-400' : 'bg-gray-500/15 text-gray-400'}`}>
                  {pool.is_active ? 'Active' : 'Inactive'}
                </span>
                <button onClick={() => editing === pool.id ? setEditing(null) : startEdit(pool)}
                  className="btn-secondary text-xs py-1 px-3">
                  {editing === pool.id ? 'Cancel' : 'Edit'}
                </button>
              </div>
            </div>

            {editing === pool.id ? (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">APY %</label>
                  <input type="number" value={editValues.apy_rate ?? ''} onChange={e => setEditValues(v => ({ ...v, apy_rate: parseFloat(e.target.value) }))} className="input text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Min Stake</label>
                  <input type="number" value={editValues.min_stake_amount ?? ''} onChange={e => setEditValues(v => ({ ...v, min_stake_amount: parseFloat(e.target.value) }))} className="input text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Lock Days</label>
                  <input type="number" value={editValues.lock_period_days ?? ''} onChange={e => setEditValues(v => ({ ...v, lock_period_days: parseInt(e.target.value) }))} className="input text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Active</label>
                  <select value={editValues.is_active ? 'true' : 'false'} onChange={e => setEditValues(v => ({ ...v, is_active: e.target.value === 'true' }))} className="input text-sm">
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <div className="col-span-2 md:col-span-4">
                  <button onClick={() => saveEdit(pool.id)} disabled={saving} className="btn-primary text-sm">{saving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-6 mt-3 text-sm">
                <span className="text-gray-400">APY: <span className="text-brand-400 font-semibold">{pool.apy_rate}%</span></span>
                <span className="text-gray-400">Lock: <span className="text-gray-200">{pool.lock_period_days}d</span></span>
                <span className="text-gray-400">Min: <span className="text-gray-200">{pool.min_stake_amount}</span></span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
