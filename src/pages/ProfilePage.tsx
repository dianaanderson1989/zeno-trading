import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { User, Shield, LogOut } from 'lucide-react'

export function ProfilePage() {
  const { user, fetchProfile, signOut } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const { register, handleSubmit } = useForm({
    defaultValues: {
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
    },
  })

  const onSave = async (data: any) => {
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('users').update({
      first_name: data.first_name,
      last_name: data.last_name,
    }).eq('id', user.id)
    setSaving(false)
    if (error) { setMsg('Error: ' + error.message); return }
    await fetchProfile(user.id)
    setMsg('Profile updated!')
  }

  const kycColors: Record<string, string> = {
    pending: 'bg-gray-500/15 text-gray-400',
    in_review: 'bg-yellow-500/15 text-yellow-400',
    approved: 'bg-brand-500/15 text-brand-400',
    rejected: 'bg-red-500/15 text-red-400',
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Profile</h1>

      {/* Avatar + name */}
      <div className="card flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 text-xl font-bold flex-shrink-0">
          {user?.first_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <p className="text-lg font-semibold text-white">
            {user?.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : 'No name set'}
          </p>
          <p className="text-gray-400 text-sm">{user?.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="badge bg-brand-500/15 text-brand-400 capitalize">{user?.role}</span>
            <span className={`badge ${kycColors[user?.kyc_status ?? 'pending']}`}>
              KYC: {user?.kyc_status}
            </span>
          </div>
        </div>
      </div>

      {/* Edit form */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2"><User size={16} /> Personal Info</h2>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">First Name</label>
              <input {...register('first_name')} className="input text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Last Name</label>
              <input {...register('last_name')} className="input text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Email</label>
            <input value={user?.email ?? ''} disabled className="input text-sm opacity-50 cursor-not-allowed" />
          </div>
          {msg && <p className={`text-xs p-2 rounded-lg ${msg.startsWith('Error') ? 'bg-red-500/10 text-red-400' : 'bg-brand-500/10 text-brand-400'}`}>{msg}</p>}
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
        </form>
      </div>

      {/* Account info */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2"><Shield size={16} /> Account</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Account Status</span>
            <span className="text-brand-400 capitalize">{user?.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Member Since</span>
            <span className="text-gray-200">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">KYC Level</span>
            <span className="text-gray-200">Level {user?.kyc_level}</span>
          </div>
        </div>
      </div>

      <button onClick={signOut} className="btn-danger flex items-center gap-2 w-full justify-center">
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  )
}
