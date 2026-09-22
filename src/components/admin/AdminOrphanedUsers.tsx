import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, RefreshCw, Wrench, CheckCircle, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/utils/format'

export function AdminOrphanedUsers() {
  const queryClient = useQueryClient()
  const [fixing, setFixing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { type: 'fix' | 'delete'; msg: string }>>({})
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null)

  const { data: orphans = [], isLoading, refetch } = useQuery({
    queryKey: ['orphaned_users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_orphaned_users')
      if (error) { console.error('get_orphaned_users:', error); return [] }
      return data ?? []
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const repairUser = async (userId: string) => {
    setFixing(userId)
    try {
      const { data } = await supabase.rpc('repair_user_profile', { p_user_id: userId })
      setResults(prev => ({
        ...prev,
        [userId]: {
          type: 'fix',
          msg: data?.success
            ? data.action === 'repaired' ? '✅ Repaired' : '✅ Already exists'
            : '❌ ' + (data?.error ?? 'Failed')
        }
      }))
      if (data?.success) {
        queryClient.invalidateQueries({ queryKey: ['orphaned_users'] })
        queryClient.invalidateQueries({ queryKey: ['admin_users'] })
        setTimeout(() => refetch(), 1000)
      }
    } catch (e: any) {
      setResults(prev => ({ ...prev, [userId]: { type: 'fix', msg: '❌ ' + e.message } }))
    } finally {
      setFixing(null)
    }
  }

  const deleteUser = async (orphan: any) => {
    setDeleting(orphan.id)
    setConfirmDelete(null)
    try {
      const { data, error } = await supabase.rpc('delete_orphaned_user', { p_auth_user_id: orphan.id })
      if (error) throw error
      setResults(prev => ({
        ...prev,
        [orphan.id]: {
          type: 'delete',
          msg: data?.success ? '🗑️ Deleted permanently' : '❌ ' + (data?.error ?? 'Failed')
        }
      }))
      if (data?.success) {
        queryClient.invalidateQueries({ queryKey: ['orphaned_users'] })
        setTimeout(() => refetch(), 500)
      }
    } catch (e: any) {
      setResults(prev => ({ ...prev, [orphan.id]: { type: 'delete', msg: '❌ ' + e.message } }))
    } finally {
      setDeleting(null)
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
          <p className="text-slate-500 text-sm mt-1">Auth users with no profile — cannot log in</p>
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
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl shimmer" />)}</div>
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
              Fix repairs the profile so they can log in. Delete permanently removes them from auth — they can re-register with the same email.
            </p>
          </div>

          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {['Email', 'Signed Up', 'Status', ''].map(h => (
                    <th key={h} className={`p-4 text-[10px] font-bold text-slate-600 uppercase tracking-wider ${h === 'Email' ? 'text-left' : h === '' ? '' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {orphans.map((orphan: any) => (
                  <tr key={orphan.id} className="hover:bg-white/[0.02]">
                    <td className="p-4">
                      <p className="text-slate-200 font-medium text-sm">{orphan.email}</p>
                      <p className="text-xs text-slate-600 font-mono">{orphan.id.slice(0, 12)}...</p>
                    </td>
                    <td className="p-4 text-xs text-slate-500">{formatDate(orphan.created_at)}</td>
                    <td className="p-4">
                      {results[orphan.id] ? (
                        <span className={`text-xs font-medium ${
                          results[orphan.id].msg.startsWith('✅') ? 'text-neon-green' :
                          results[orphan.id].msg.startsWith('🗑️') ? 'text-slate-400' :
                          'text-neon-red'
                        }`}>
                          {results[orphan.id].msg}
                        </span>
                      ) : (
                        <span className="badge bg-neon-red/10 text-neon-red border border-neon-red/20 text-xs">No profile</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Fix button */}
                        <button
                          onClick={() => repairUser(orphan.id)}
                          disabled={!!fixing || !!deleting || results[orphan.id]?.type === 'fix' && results[orphan.id]?.msg.startsWith('✅')}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-neon-green/10 text-neon-green hover:bg-neon-green/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          {fixing === orphan.id
                            ? <span className="w-3 h-3 border-2 border-neon-green/30 border-t-neon-green rounded-full animate-spin" />
                            : <Wrench size={11} />}
                          Fix
                        </button>
                        {/* Delete button */}
                        <button
                          onClick={() => setConfirmDelete(orphan)}
                          disabled={!!fixing || !!deleting || results[orphan.id]?.type === 'delete'}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-neon-red/10 text-neon-red hover:bg-neon-red/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          {deleting === orphan.id
                            ? <span className="w-3 h-3 border-2 border-neon-red/30 border-t-neon-red rounded-full animate-spin" />
                            : <Trash2 size={11} />}
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6"
          onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(null) }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden animate-slide-up"
            style={{ background: '#0d1424', border: '1px solid rgba(255,51,102,0.2)' }}>
            <div className="px-6 pt-6 pb-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-neon-red/10 border border-neon-red/20 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={20} className="text-neon-red" />
              </div>
              <h3 className="text-base font-black text-white mb-1">Delete User?</h3>
              <p className="text-sm text-slate-400 mb-1">{confirmDelete.email}</p>
              <p className="text-xs text-slate-500">
                This permanently deletes the auth record. They can re-register with the same email.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 px-6 pb-6">
              <button onClick={() => setConfirmDelete(null)}
                className="py-3 rounded-xl text-sm font-bold text-slate-300 bg-white/[0.05] hover:bg-white/[0.08] transition-colors border border-white/[0.06]">
                Cancel
              </button>
              <button onClick={() => deleteUser(confirmDelete)}
                className="py-3 rounded-xl text-sm font-bold text-white bg-neon-red hover:bg-neon-red/80 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
