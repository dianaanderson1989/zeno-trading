import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, RefreshCw, Wrench, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/utils/format'

export function AdminOrphanedUsers() {
  const queryClient = useQueryClient()
  const [fixing, setFixing] = useState<string | null>(null)
  const [fixResults, setFixResults] = useState<Record<string, string>>({})

  const { data: orphans = [], isLoading, refetch } = useQuery({
    queryKey: ['orphaned_users'],
    queryFn: async () => {
      // Get all auth users that have no public.users row
      const { data, error } = await supabase.rpc('get_orphaned_users')
      if (error) {
        console.error('get_orphaned_users error:', error)
        return []
      }
      return data ?? []
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const repairUser = async (userId: string) => {
    setFixing(userId)
    try {
      const { data } = await supabase.rpc('repair_user_profile', { p_user_id: userId })
      setFixResults(prev => ({
        ...prev,
        [userId]: data?.success
          ? `✅ ${data.action === 'repaired' ? 'Repaired successfully' : 'Already exists'}`
          : `❌ ${data?.error ?? 'Unknown error'}`
      }))
      if (data?.success) {
        queryClient.invalidateQueries({ queryKey: ['orphaned_users'] })
        queryClient.invalidateQueries({ queryKey: ['admin_users'] })
        setTimeout(() => refetch(), 1000)
      }
    } catch (e: any) {
      setFixResults(prev => ({ ...prev, [userId]: '❌ ' + e.message }))
    } finally {
      setFixing(null)
    }
  }

  const repairAll = async () => {
    for (const orphan of orphans) {
      await repairUser(orphan.id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <AlertTriangle size={20} className="text-neon-yellow" /> Orphaned Users
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Auth users with no profile row — these users cannot log in
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
            <RefreshCw size={12} /> Refresh
          </button>
          {orphans.length > 0 && (
            <button onClick={repairAll}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
              <Wrench size={12} /> Fix All ({orphans.length})
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl shimmer" />)}
        </div>
      ) : orphans.length === 0 ? (
        <div className="card border border-neon-green/20 bg-neon-green/5 text-center py-12">
          <CheckCircle size={32} className="text-neon-green mx-auto mb-3" />
          <p className="text-neon-green font-semibold">All users have profiles</p>
          <p className="text-slate-500 text-sm mt-1">No orphaned users detected</p>
        </div>
      ) : (
        <>
          <div className="card border border-neon-yellow/20 bg-neon-yellow/5">
            <div className="flex items-center gap-2 text-neon-yellow mb-1">
              <AlertTriangle size={14} />
              <span className="font-bold text-sm">{orphans.length} user{orphans.length > 1 ? 's' : ''} cannot log in</span>
            </div>
            <p className="text-slate-400 text-xs">
              These users signed up but their profile was not created due to a trigger error.
              Click "Fix" to repair each one, or "Fix All" to repair all at once.
            </p>
          </div>

          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {['Email', 'Auth ID', 'Signed Up', 'Status', ''].map(h => (
                    <th key={h} className={`p-4 text-[10px] font-bold text-slate-600 uppercase tracking-wider ${h === 'Email' || h === 'Auth ID' ? 'text-left' : h === '' ? '' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {orphans.map((orphan: any) => (
                  <tr key={orphan.id} className="hover:bg-white/[0.02]">
                    <td className="p-4">
                      <p className="text-slate-200 font-medium">{orphan.email}</p>
                      <p className="text-xs text-slate-600">
                        {orphan.raw_user_meta_data?.first_name
                          ? `${orphan.raw_user_meta_data.first_name} ${orphan.raw_user_meta_data.last_name ?? ''}`
                          : 'No name'}
                      </p>
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-500">{orphan.id.slice(0, 8)}...</td>
                    <td className="p-4 text-xs text-slate-500">{formatDate(orphan.created_at)}</td>
                    <td className="p-4">
                      {fixResults[orphan.id] ? (
                        <span className={`text-xs font-medium ${fixResults[orphan.id].startsWith('✅') ? 'text-neon-green' : 'text-neon-red'}`}>
                          {fixResults[orphan.id]}
                        </span>
                      ) : (
                        <span className="badge bg-neon-red/10 text-neon-red border border-neon-red/20 text-xs">
                          No profile
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => repairUser(orphan.id)}
                        disabled={fixing === orphan.id || fixResults[orphan.id]?.startsWith('✅')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-neon-yellow/10 text-neon-yellow hover:bg-neon-yellow/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all ml-auto"
                      >
                        {fixing === orphan.id
                          ? <span className="w-3 h-3 border-2 border-neon-yellow/30 border-t-neon-yellow rounded-full animate-spin" />
                          : <Wrench size={12} />}
                        {fixing === orphan.id ? 'Fixing...' : 'Fix'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
