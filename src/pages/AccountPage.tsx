import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import {
  User, Shield, FileText, Bell, Eye, EyeOff,
  Upload, CheckCircle, Clock, XCircle, AlertTriangle, Camera
} from 'lucide-react'

const TABS = [
  { id: 'profile',     label: 'Profile',       icon: User },
  { id: 'security',    label: 'Security',      icon: Shield },
  { id: 'kyc',         label: 'Verification',  icon: FileText },
  { id: 'preferences', label: 'Preferences',   icon: Bell },
]

const KYC_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any; desc: string }> = {
  pending:   { label: 'Not Submitted', color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20', icon: Clock,       desc: 'Submit your documents to get verified' },
  in_review: { label: 'Under Review',  color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: Clock,       desc: 'Your documents are being reviewed (1–2 business days)' },
  approved:  { label: 'Verified ✓',    color: 'text-neon-green', bg: 'bg-neon-green/10', border: 'border-neon-green/20', icon: CheckCircle, desc: 'Your identity has been verified' },
  rejected:  { label: 'Rejected',      color: 'text-neon-red',   bg: 'bg-neon-red/10',   border: 'border-neon-red/20',   icon: XCircle,     desc: 'Your documents were rejected. Please resubmit.' },
}

export function AccountPage() {
  const { user, fetchProfile } = useAuthStore()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [kycFiles, setKycFiles] = useState<Record<string, File | null>>({
    id_front: null, id_back: null, selfie: null, proof_of_address: null,
  })
  const [kycDocType, setKycDocType] = useState('national_id')
  const [kycSubmitting, setKycSubmitting] = useState(false)
  const [prefs, setPrefs] = useState({
    notify_trades:      (user as any)?.notify_trades      ?? true,
    notify_deposits:    (user as any)?.notify_deposits    ?? true,
    notify_withdrawals: (user as any)?.notify_withdrawals ?? true,
    notify_promotions:  (user as any)?.notify_promotions  ?? false,
    language: (user as any)?.language ?? 'en',
    timezone: (user as any)?.timezone ?? 'UTC',
  })

  const showMsg = (text: string, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  // Profile form
  const { register: regProfile, handleSubmit: handleProfile } = useForm({
    defaultValues: {
      first_name:    (user as any)?.first_name    ?? '',
      last_name:     (user as any)?.last_name     ?? '',
      phone:         (user as any)?.phone         ?? '',
      date_of_birth: (user as any)?.date_of_birth ?? '',
      country:       (user as any)?.country       ?? '',
    },
  })

  const onSaveProfile = async (data: any) => {
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('users').update(data).eq('id', user.id)
    setSaving(false)
    if (error) showMsg(error.message, false)
    else { await fetchProfile(user.id); showMsg('Profile updated!') }
  }

  // Avatar upload
  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) { showMsg(error.message, false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id)
    await fetchProfile(user.id)
    showMsg('Avatar updated!')
  }

  // Password change
  const { register: regPw, handleSubmit: handlePw, reset: resetPw } = useForm<{ newPassword: string; confirmPassword: string }>()

  const onChangePw = async (data: any) => {
    if (data.newPassword !== data.confirmPassword) { showMsg('Passwords do not match', false); return }
    if (data.newPassword.length < 8) { showMsg('Password must be at least 8 characters', false); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: data.newPassword })
    setSaving(false)
    if (error) showMsg(error.message, false)
    else { resetPw(); showMsg('Password updated successfully!') }
  }

  // KYC docs history
  const { data: kycDocs = [] } = useQuery({
    queryKey: ['kyc_docs', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from('kyc_documents').select('*').eq('user_id', user!.id).order('created_at', { ascending: false })
      return data ?? []
    },
    staleTime: 30_000,
  })

  // KYC submit
  const submitKyc = async () => {
    if (!user) return
    if (!kycFiles.id_front || !kycFiles.selfie) { showMsg('ID front and selfie are required', false); return }
    setKycSubmitting(true)
    try {
      for (const [type, file] of Object.entries(kycFiles)) {
        if (!file) continue
        const ext = file.name.split('.').pop()
        const path = `${user.id}/${type}_${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('kyc-documents').upload(path, file)
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('kyc-documents').getPublicUrl(path)
        await supabase.from('kyc_documents').insert({
          user_id: user.id,
          doc_type: type === 'selfie' ? 'selfie' : type === 'proof_of_address' ? 'proof_of_address' : kycDocType,
          file_url: publicUrl,
          file_path: path,
          status: 'pending',
        })
      }
      await supabase.from('users').update({ kyc_status: 'in_review', kyc_level: 1 }).eq('id', user.id)
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'kyc_in_review',
        title: '🔍 KYC Submitted',
        message: "Your identity documents have been submitted and are under review. We'll notify you within 1–2 business days.",
        metadata: {},
      })
      await fetchProfile(user.id)
      queryClient.invalidateQueries({ queryKey: ['kyc_docs'] })
      showMsg("Documents submitted! We'll review within 1–2 business days.")
      setKycFiles({ id_front: null, id_back: null, selfie: null, proof_of_address: null })
    } catch (e: any) {
      showMsg(e.message, false)
    } finally {
      setKycSubmitting(false)
    }
  }

  const savePrefs = async () => {
    if (!user) return
    setSaving(true)
    await supabase.from('users').update(prefs).eq('id', user.id)
    setSaving(false)
    showMsg('Preferences saved!')
  }

  const kycStatus = (user as any)?.kyc_status ?? 'pending'
  const kycCfg = KYC_CONFIG[kycStatus] ?? KYC_CONFIG.pending
  const KycIcon = kycCfg.icon
  const avatarUrl = (user as any)?.avatar_url

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white">Account Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your profile, security and verification</p>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${msg.ok ? 'bg-neon-green/10 text-neon-green border-neon-green/20' : 'bg-neon-red/10 text-neon-red border-neon-red/20'}`}>
          {msg.text}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
              tab === t.id ? 'text-dark-950 shadow-neon-green' : 'text-slate-400 hover:text-white'
            }`}
            style={tab === t.id ? { background: 'linear-gradient(135deg, #00ff88, #00cc6a)' } : {}}>
            <t.icon size={13} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── PROFILE ── */}
      {tab === 'profile' && (
        <div className="space-y-5">
          <div className="card flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-neon-green/20"
                style={{ background: 'linear-gradient(135deg, #00ff88, #00d4ff)' }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-2xl font-black text-dark-950">
                      {user?.first_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                    </div>}
              </div>
              <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-dark-700 border border-white/10 flex items-center justify-center cursor-pointer hover:bg-dark-600 transition-colors">
                <Camera size={11} className="text-slate-300" />
                <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
              </label>
            </div>
            <div>
              <p className="font-bold text-white">
                {(user as any)?.first_name ? `${(user as any).first_name} ${(user as any).last_name ?? ''}`.trim() : 'No name set'}
              </p>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`badge text-xs ${kycCfg.bg} ${kycCfg.color} ${kycCfg.border}`}>
                  <KycIcon size={10} className="mr-1 inline" /> {kycCfg.label}
                </span>
                <span className="badge bg-white/[0.05] text-slate-400 text-xs capitalize">{user?.role}</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleProfile(onSaveProfile)} className="card space-y-4">
            <h2 className="font-bold text-white text-xs uppercase tracking-widest">Personal Information</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-semibold uppercase tracking-wider">First Name</label>
                <input {...regProfile('first_name')} className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-semibold uppercase tracking-wider">Last Name</label>
                <input {...regProfile('last_name')} className="input text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-semibold uppercase tracking-wider">Email</label>
              <input value={user?.email ?? ''} disabled className="input text-sm opacity-40 cursor-not-allowed" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-semibold uppercase tracking-wider">Phone</label>
                <input {...regProfile('phone')} placeholder="+1 234 567 8900" className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-semibold uppercase tracking-wider">Date of Birth</label>
                <input {...regProfile('date_of_birth')} type="date" className="input text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-semibold uppercase tracking-wider">Country</label>
              <select {...regProfile('country')} className="input text-sm">
                <option value="">Select country</option>
                {['United States','United Kingdom','Canada','Australia','Germany','France','Japan','Singapore','UAE','Saudi Arabia','Nigeria','Kenya','South Africa','India','Brazil','Mexico','Other'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={saving} className="btn-primary text-sm py-2.5">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {/* ── SECURITY ── */}
      {tab === 'security' && (
        <div className="space-y-5">
          <form onSubmit={handlePw(onChangePw)} className="card space-y-4">
            <h2 className="font-bold text-white text-xs uppercase tracking-widest">Change Password</h2>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-semibold uppercase tracking-wider">New Password</label>
              <div className="relative">
                <input {...regPw('newPassword')} type={showPw ? 'text' : 'password'} placeholder="Min 8 characters" className="input text-sm pr-10" />
                <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-semibold uppercase tracking-wider">Confirm Password</label>
              <input {...regPw('confirmPassword')} type={showPw ? 'text' : 'password'} placeholder="Repeat password" className="input text-sm" />
            </div>
            <button type="submit" disabled={saving} className="btn-primary text-sm py-2.5">{saving ? 'Updating...' : 'Update Password'}</button>
          </form>

          <div className="card space-y-1">
            <h2 className="font-bold text-white text-xs uppercase tracking-widest mb-3">Account Info</h2>
            {[
              { label: 'Status',       value: (user as any)?.status ?? '—',    green: true },
              { label: 'KYC Level',    value: `Level ${(user as any)?.kyc_level ?? 0}` },
              { label: 'Member Since', value: user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—' },
            ].map(row => (
              <div key={row.label} className="flex justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                <span className="text-sm text-slate-500">{row.label}</span>
                <span className={`text-sm font-semibold capitalize ${row.green ? 'text-neon-green' : 'text-slate-300'}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KYC ── */}
      {tab === 'kyc' && (
        <div className="space-y-5">
          <div className={`card border ${kycCfg.border} ${kycCfg.bg}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${kycCfg.bg} flex items-center justify-center border ${kycCfg.border}`}>
                <KycIcon size={18} className={kycCfg.color} />
              </div>
              <div>
                <p className={`font-bold ${kycCfg.color}`}>{kycCfg.label}</p>
                <p className="text-xs text-slate-400">{kycCfg.desc}</p>
              </div>
            </div>
            {kycStatus === 'rejected' && (kycDocs[0] as any)?.rejection_reason && (
              <div className="mt-3 pt-3 border-t border-neon-red/20">
                <p className="text-xs text-slate-400"><span className="text-neon-red font-semibold">Reason: </span>{(kycDocs[0] as any).rejection_reason}</p>
              </div>
            )}
          </div>

          {['pending', 'rejected'].includes(kycStatus) && (
            <div className="card space-y-5">
              <h2 className="font-bold text-white text-xs uppercase tracking-widest">Submit Identity Documents</h2>

              {/* Pre-filled profile info */}
              <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04] space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Your Profile Info</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Full Name', value: (user as any)?.first_name ? `${(user as any).first_name} ${(user as any).last_name ?? ''}`.trim() : null },
                    { label: 'Date of Birth', value: (user as any)?.date_of_birth },
                    { label: 'Country', value: (user as any)?.country },
                    { label: 'Email', value: user?.email },
                  ].map(f => (
                    <div key={f.label}>
                      <p className="text-xs text-slate-600">{f.label}</p>
                      {f.value
                        ? <p className="text-slate-200 font-medium">{f.value}</p>
                        : <p className="text-yellow-400 text-xs">Not set — update in Profile tab</p>}
                    </div>
                  ))}
                </div>
                {(!(user as any)?.first_name || !(user as any)?.date_of_birth || !(user as any)?.country) && (
                  <div className="flex items-center gap-2 text-xs text-yellow-400 mt-1">
                    <AlertTriangle size={11} /> Fill in missing profile fields before submitting
                  </div>
                )}
              </div>

              {/* Doc type */}
              <div>
                <label className="block text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wider">Document Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'passport', label: 'Passport' },
                    { value: 'national_id', label: 'National ID' },
                    { value: 'drivers_license', label: "Driver's License" },
                  ].map(opt => (
                    <button key={opt.value} type="button" onClick={() => setKycDocType(opt.value)}
                      className={`py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        kycDocType === opt.value
                          ? 'border-neon-green/40 bg-neon-green/10 text-neon-green'
                          : 'border-white/[0.06] text-slate-400 hover:text-white hover:border-white/10'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* File uploads */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Uploads</p>
                {[
                  { key: 'id_front', label: 'ID Front *', required: true },
                  { key: 'id_back', label: 'ID Back', required: false },
                  { key: 'selfie', label: 'Selfie with ID *', required: true },
                  { key: 'proof_of_address', label: 'Proof of Address', required: false },
                ].map(doc => (
                  <label key={doc.key}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                      kycFiles[doc.key] ? 'border-neon-green/30 bg-neon-green/5' : 'border-white/[0.06] hover:border-white/10 hover:bg-white/[0.02]'
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kycFiles[doc.key] ? 'bg-neon-green/10' : 'bg-white/[0.04]'}`}>
                        {kycFiles[doc.key] ? <CheckCircle size={14} className="text-neon-green" /> : <Upload size={14} className="text-slate-500" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">{doc.label}</p>
                        <p className="text-xs text-slate-600">{kycFiles[doc.key] ? kycFiles[doc.key]!.name : 'JPG, PNG or PDF'}</p>
                      </div>
                    </div>
                    <input type="file" accept="image/*,.pdf" className="hidden"
                      onChange={e => setKycFiles(f => ({ ...f, [doc.key]: e.target.files?.[0] ?? null }))} />
                    <span className="text-xs text-neon-green/60 font-medium">{kycFiles[doc.key] ? 'Change' : 'Upload'}</span>
                  </label>
                ))}
              </div>

              <button onClick={submitKyc} disabled={kycSubmitting || !kycFiles.id_front || !kycFiles.selfie} className="btn-primary w-full py-3 font-black">
                {kycSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-dark-950/30 border-t-dark-950 rounded-full animate-spin" />
                    Uploading...
                  </span>
                ) : 'Submit for Verification'}
              </button>
            </div>
          )}

          {kycDocs.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-white text-xs uppercase tracking-widest mb-4">Submission History</h3>
              <div className="space-y-1">
                {kycDocs.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                    <div>
                      <p className="text-sm text-slate-200 capitalize">{doc.doc_type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-slate-600">{new Date(doc.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`badge text-xs ${
                      doc.status === 'approved' ? 'bg-neon-green/10 text-neon-green border-neon-green/20' :
                      doc.status === 'rejected' ? 'bg-neon-red/10 text-neon-red border-neon-red/20' :
                      'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                    } border`}>{doc.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PREFERENCES ── */}
      {tab === 'preferences' && (
        <div className="card space-y-5">
          <h2 className="font-bold text-white text-xs uppercase tracking-widest">Notification Preferences</h2>
          <div className="space-y-1">
            {[
              { key: 'notify_trades',      label: 'Trade settlements',          desc: 'Get notified when orders are filled' },
              { key: 'notify_deposits',    label: 'Deposit updates',            desc: 'Approval and rejection alerts' },
              { key: 'notify_withdrawals', label: 'Withdrawal updates',         desc: 'Approval and rejection alerts' },
              { key: 'notify_promotions',  label: 'Promotions & announcements', desc: 'Platform news and offers' },
            ].map(p => (
              <div key={p.key} className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-200">{p.label}</p>
                  <p className="text-xs text-slate-500">{p.desc}</p>
                </div>
                <button
                  onClick={() => setPrefs(prev => ({ ...prev, [p.key]: !(prev as any)[p.key] }))}
                  className={`relative w-11 h-6 rounded-full transition-all duration-200 ${(prefs as any)[p.key] ? 'bg-neon-green shadow-neon-green' : 'bg-dark-600'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200 ${(prefs as any)[p.key] ? 'left-[calc(100%-22px)]' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div className="space-y-3">
            <h2 className="font-bold text-white text-xs uppercase tracking-widest">Display</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-semibold uppercase tracking-wider">Language</label>
                <select value={prefs.language} onChange={e => setPrefs(p => ({ ...p, language: e.target.value }))} className="input text-sm">
                  <option value="en">English</option>
                  <option value="ar">Arabic</option>
                  <option value="fr">French</option>
                  <option value="es">Spanish</option>
                  <option value="de">German</option>
                  <option value="zh">Chinese</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-semibold uppercase tracking-wider">Timezone</label>
                <select value={prefs.timezone} onChange={e => setPrefs(p => ({ ...p, timezone: e.target.value }))} className="input text-sm">
                  {['UTC','America/New_York','America/Los_Angeles','Europe/London','Europe/Paris','Asia/Dubai','Asia/Tokyo','Asia/Singapore','Africa/Lagos','Africa/Nairobi'].map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button onClick={savePrefs} disabled={saving} className="btn-primary text-sm py-2.5">
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      )}
    </div>
  )
}
