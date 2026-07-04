import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Eye, User, FileText, RefreshCw, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/utils/format'

export function AdminKyc() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('in_review')
  const [detail, setDetail] = useState<any | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [loadedUrls, setLoadedUrls] = useState<Record<string, string>>({})

  const { data: submissions = [], isLoading, refetch } = useQuery({
    queryKey: ['admin_kyc', filter],
    queryFn: async () => {
      const { data: docs, error } = await supabase
        .from('kyc_documents')
        .select('*, users:user_id(id, email, first_name, last_name, kyc_status, country, date_of_birth, phone, created_at)')
        .order('created_at', { ascending: false })
      if (error) throw error

      // Group by user
      const grouped: Record<string, any> = {}
      for (const doc of docs ?? []) {
        if (!grouped[doc.user_id]) {
          grouped[doc.user_id] = {
            user_id: doc.user_id,
            users: doc.users,
            docs: [],
            latest_submission: doc.created_at,
            status: doc.users?.kyc_status ?? 'pending',
          }
        }
        grouped[doc.user_id].docs.push(doc)
      }

      const all = Object.values(grouped)
      return filter === 'all' ? all : all.filter((s: any) => s.status === filter)
    },
    staleTime: 15_000,
    refetchInterval: 20_000,
  })

  const loadDocUrl = async (doc: any) => {
    if (loadedUrls[doc.id]) return
    const { data } = await supabase.storage.from('kyc-documents').createSignedUrl(doc.file_path, 3600)
    if (data?.signedUrl) setLoadedUrls(prev => ({ ...prev, [doc.id]: data.signedUrl }))
  }

  const handleApprove = async () => {
    if (!detail) return
    setProcessing(true)
    try {
      await supabase.from('users').update({ kyc_status: 'approved', kyc_level: 1, kyc_verified_at: new Date().toISOString() }).eq('id', detail.user_id)
      await supabase.from('kyc_documents').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('user_id', detail.user_id)
      await supabase.from('notifications').insert({
        user_id: detail.user_id,
        type: 'kyc_approved',
        title: '✅ KYC Approved',
        message: 'Your identity has been verified! You now have full access to all platform features including withdrawals.',
        metadata: {},
      })
      queryClient.invalidateQueries({ queryKey: ['admin_kyc'] })
      setDetail(null)
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setProcessing(false) }
  }

  const handleReject = async () => {
    if (!detail || !rejectReason.trim()) return
    setProcessing(true)
    try {
      await supabase.from('users').update({ kyc_status: 'rejected' }).eq('id', detail.user_id)
      await supabase.from('kyc_documents').update({ status: 'rejected', rejection_reason: rejectReason, reviewed_at: new Date().toISOString() }).eq('user_id', detail.user_id)
      await supabase.from('notifications').insert({
        user_id: detail.user_id,
        type: 'kyc_rejected',
        title: '❌ KYC Rejected',
        message: `Your identity verification was rejected. Reason: ${rejectReason}. Please resubmit with correct documents.`,
        metadata: { reason: rejectReason },
      })
      queryClient.invalidateQueries({ queryKey: ['admin_kyc'] })
      setDetail(null); setShowRejectForm(false); setRejectReason('')
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setProcessing(false) }
  }

  const statusColors: Record<string, string> = {
    pending:   'bg-slate-500/15 text-slate-400 border border-slate-500/20',
    in_review: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
    approved:  'bg-neon-green/10 text-neon-green border border-neon-green/30',
    rejected:  'bg-neon-red/10 text-neon-red border border-neon-red/30',
  }

  const docLabels: Record<string, string> = {
    passport: 'Passport', national_id: 'National ID', drivers_license: "Driver's License",
    selfie: 'Selfie with ID', proof_of_address: 'Proof of Address',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><FileText size={20} className="text-neon-cyan" /> KYC Requests</h1>
          <p className="text-slate-500 text-sm mt-1">Review identity verification submissions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"><RefreshCw size={12} /> Refresh</button>
          {['in_review', 'approved', 'rejected', 'all'].map(f => (
            <button key={f} onClick={() => { setFilter(f); setDetail(null) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${filter === f ? 'bg-neon-green text-dark-950' : 'bg-dark-700 text-slate-400 hover:text-white border border-white/[0.06]'}`}>
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={detail ? 'lg:col-span-1' : 'lg:col-span-3'}>
          <div className="card overflow-hidden p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl shimmer" />)}</div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-16">
                <FileText size={28} className="text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No {filter.replace('_', ' ')} submissions</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {submissions.map((s: any) => (
                  <div key={s.user_id}
                    onClick={() => { setDetail(detail?.user_id === s.user_id ? null : s); setShowRejectForm(false); setRejectReason('') }}
                    className={`p-4 cursor-pointer transition-colors ${detail?.user_id === s.user_id ? 'bg-neon-green/5' : 'hover:bg-white/[0.02]'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-slate-200">
                        {s.users?.first_name ? `${s.users.first_name} ${s.users.last_name ?? ''}` : s.users?.email}
                      </p>
                      <span className={`badge text-xs ${statusColors[s.status] ?? statusColors.pending}`}>{s.status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-xs text-slate-600">{s.users?.email}</p>
                    <div className="flex justify-between mt-1.5">
                      <p className="text-xs text-slate-600">{s.docs.length} doc{s.docs.length > 1 ? 's' : ''}</p>
                      <p className="text-xs text-slate-600">{formatDate(s.latest_submission)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {detail && (
          <div className="lg:col-span-2 animate-slide-up">
            <div className="card space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white">Review Submission</h3>
                <button onClick={() => setDetail(null)} className="text-slate-600 hover:text-slate-300 text-lg">✕</button>
              </div>

              {/* User info */}
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.05] grid grid-cols-2 gap-3">
                <div className="col-span-2 flex items-center gap-2 mb-1">
                  <User size={12} className="text-neon-cyan" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">User Info</span>
                </div>
                {[
                  { label: 'Full Name', value: detail.users?.first_name ? `${detail.users.first_name} ${detail.users.last_name ?? ''}` : 'Not set' },
                  { label: 'Email', value: detail.users?.email },
                  { label: 'Date of Birth', value: detail.users?.date_of_birth || 'Not set' },
                  { label: 'Country', value: detail.users?.country || 'Not set' },
                  { label: 'Phone', value: detail.users?.phone || 'Not set' },
                  { label: 'Member Since', value: detail.users?.created_at ? new Date(detail.users.created_at).toLocaleDateString() : '—' },
                ].map(row => (
                  <div key={row.label}>
                    <p className="text-xs text-slate-600">{row.label}</p>
                    <p className="text-sm text-slate-200 font-medium">{row.value}</p>
                  </div>
                ))}
              </div>

              {/* Documents */}
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Documents ({detail.docs.length})</p>
                <div className="grid grid-cols-2 gap-3">
                  {detail.docs.map((doc: any) => (
                    <div key={doc.id} className="bg-white/[0.02] rounded-xl border border-white/[0.06] overflow-hidden">
                      <div className="aspect-video bg-dark-900 flex items-center justify-center relative">
                        {loadedUrls[doc.id] ? (
                          <>
                            <img src={loadedUrls[doc.id]} alt={doc.doc_type} className="w-full h-full object-cover" />
                            <a href={loadedUrls[doc.id]} target="_blank" rel="noopener noreferrer"
                              className="absolute top-2 right-2 w-6 h-6 rounded-lg bg-black/60 flex items-center justify-center hover:bg-black/80">
                              <ExternalLink size={11} className="text-white" />
                            </a>
                          </>
                        ) : (
                          <button onClick={() => loadDocUrl(doc)}
                            className="flex flex-col items-center gap-2 text-slate-500 hover:text-neon-green transition-colors">
                            <Eye size={20} />
                            <span className="text-xs">Click to view</span>
                          </button>
                        )}
                      </div>
                      <div className="p-2.5 flex items-center justify-between">
                        <p className="text-xs font-medium text-slate-300">{docLabels[doc.doc_type] ?? doc.doc_type}</p>
                        <span className={`badge text-[10px] ${statusColors[doc.status] ?? statusColors.pending}`}>{doc.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              {detail.status === 'in_review' && !showRejectForm && (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleApprove} disabled={processing}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #00ff88, #00cc6a)', color: '#050810', boxShadow: '0 0 20px rgba(0,255,136,0.3)' }}>
                    {processing ? <span className="w-4 h-4 border-2 border-dark-950/30 border-t-dark-950 rounded-full animate-spin" /> : <><CheckCircle size={15} /> Approve KYC</>}
                  </button>
                  <button onClick={() => setShowRejectForm(true)}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black bg-neon-red/10 text-neon-red border border-neon-red/30 hover:bg-neon-red/20 transition-all">
                    <XCircle size={15} /> Reject
                  </button>
                </div>
              )}

              {showRejectForm && (
                <div className="space-y-3 animate-slide-up">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Rejection Reason</label>
                  <div className="flex flex-wrap gap-2">
                    {['Blurry photo', 'Expired ID', 'Document mismatch', 'Incomplete submission', 'Suspected fraud'].map(r => (
                      <button key={r} onClick={() => setRejectReason(r)}
                        className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${rejectReason === r ? 'bg-neon-red/20 text-neon-red border border-neon-red/30' : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08]'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                  <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                    placeholder="Or type a custom reason..." rows={2} className="input text-sm resize-none" />
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => { setShowRejectForm(false); setRejectReason('') }} className="btn-secondary py-2.5">Cancel</button>
                    <button onClick={handleReject} disabled={processing || !rejectReason.trim()}
                      className="py-2.5 rounded-xl text-sm font-black bg-neon-red text-white hover:bg-neon-red/80 disabled:opacity-50 transition-all">
                      {processing ? 'Rejecting...' : 'Confirm Rejection'}
                    </button>
                  </div>
                </div>
              )}

              {detail.status === 'approved' && (
                <div className="bg-neon-green/5 border border-neon-green/20 rounded-xl p-4 text-center">
                  <CheckCircle size={20} className="text-neon-green mx-auto mb-2" />
                  <p className="text-sm text-neon-green font-semibold">This user is verified ✓</p>
                </div>
              )}
              {detail.status === 'rejected' && detail.docs[0]?.rejection_reason && (
                <div className="bg-neon-red/5 border border-neon-red/20 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Rejection reason on file:</p>
                  <p className="text-sm text-neon-red">{detail.docs[0].rejection_reason}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
