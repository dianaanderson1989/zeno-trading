import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) setError(error.message)
    else { setDone(true); setTimeout(() => navigate('/login'), 3000) }
  }

  if (done) return (
    <div className="animate-fade-in text-center">
      <div className="w-16 h-16 rounded-full bg-neon-green/10 border border-neon-green/20 flex items-center justify-center mx-auto mb-6">
        <CheckCircle size={28} className="text-neon-green" />
      </div>
      <h2 className="text-2xl font-black text-white mb-2">Password updated!</h2>
      <p className="text-slate-400 text-sm">Redirecting to sign in...</p>
    </div>
  )

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-black text-white mb-1">New password</h2>
      <p className="text-slate-400 text-sm mb-8">Choose a strong password for your account</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">New Password</label>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
            <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Min 8 characters" className="input pl-10 pr-10" required />
            <button type="button" onClick={() => setShow(!show)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300">
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Confirm Password</label>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
            <input type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••" className="input pl-10" required />
          </div>
        </div>
        {error && <p className="text-neon-red text-xs bg-neon-red/5 border border-neon-red/20 rounded-xl px-4 py-3">{error}</p>}
        <button type="submit" disabled={loading || !password || !confirm} className="btn-primary w-full py-3">
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}
