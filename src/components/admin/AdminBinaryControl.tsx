import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/utils/format'

export function AdminBinaryControl() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin_binary_users'],
    queryFn: async () => {
      const { data: userList } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, created_at')
        .eq('role', 'user')
        .order('created_at', { ascending: false })

      const { data: settings } = await supabase
        .from('admin_user_settings')
        .select('user_id, binary_outcome, notes, updated_at')

      const settingsMap: Record<string, any> = {}
      settings?.forEach(s => { settingsMap[s.user_id] = s })

      return (userList ?? []).map(u => ({
        ...u,
        binary_outcome: settingsMap[u.id]?.binary_outcome ?? 'random',
        notes: settingsMap[u.id]?.notes ?? '',
        settings_updated_at: settingsMap[u.id]?.updated_at,
      }))
    },
    staleTime: 30_000,
  })

  const filtered = users.filter((u: any) =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase())
  )

  const setOutcome = async (userId: string, outcome: string, notes?: string) => {
    setSaving(userId)
    const adminId = (await supabase.auth.getUser()).data.user?.id
    await supabase.from('admin_user_settings').upsert({
      user_id: userId,
      binary_outcome: outcome,
      notes: notes ?? '',
      updated_by: adminId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    setSaving(null)
    queryClient.invalidateQueries({ queryKey: ['admin_binary_users'] })
  }

  const outcomeConfig = {
    win:    { label: 'WIN',    color: 'bg-brand-500 text-white',             desc: 'User always wins' },
    lose:   { label: 'LOSE',   color: 'bg-red-500 text-white',               desc: 'User always loses' },
    random: { label: 'RANDOM', color: 'bg-gray-600 text-gray-200',           desc: '50/50 random outcome' },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap size={20} className="text-brand-400" /> Binary Outcome Control
          </h1>
          <p className="text-gray-400 text-sm mt-1">Set per-user outcome for binary option trades</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="input text-sm pl-9 w-56" />
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4">
        {Object.entries(outcomeConfig).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-xs text-gray-400">
            <span className={`badge ${v.color} text-xs`}>{v.label}</span>
            {v.desc}
          </div>
        ))}
      </div>

      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-dark-700 rounded animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No users found</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-600 text-gray-500 text-xs uppercase">
                <th className="text-left p-4 font-medium">User</th>
                <th className="text-left p-4 font-medium">Current Mode</th>
                <th className="text-left p-4 font-medium">Last Updated</th>
                <th className="text-left p-4 font-medium">Notes</th>
                <th className="p-4 text-center font-medium">Set Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-600">
              {filtered.map((u: any) => (
                <tr key={u.id} className="hover:bg-dark-700/40">
                  <td className="p-4">
                    <p className="text-gray-200">{u.first_name ? `${u.first_name} ${u.last_name ?? ''}` : '—'}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </td>
                  <td className="p-4">
                    <span className={`badge text-xs ${outcomeConfig[u.binary_outcome as keyof typeof outcomeConfig]?.color}`}>
                      {outcomeConfig[u.binary_outcome as keyof typeof outcomeConfig]?.label}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-gray-500">
                    {u.settings_updated_at ? formatDate(u.settings_updated_at) : 'Never set'}
                  </td>
                  <td className="p-4 text-xs text-gray-400 max-w-[150px] truncate">
                    {u.notes || '—'}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      {(['win', 'random', 'lose'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setOutcome(u.id, mode)}
                          disabled={saving === u.id || u.binary_outcome === mode}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                            u.binary_outcome === mode
                              ? outcomeConfig[mode].color + ' ring-2 ring-white/20'
                              : 'bg-dark-600 text-gray-400 hover:bg-dark-500 hover:text-gray-200'
                          }`}
                        >
                          {saving === u.id ? '...' : outcomeConfig[mode].label}
                        </button>
                      ))}
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
