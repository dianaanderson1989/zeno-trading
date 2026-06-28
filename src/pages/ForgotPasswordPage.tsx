import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  if (sent) return (
    <div className="animate-fade-in text-center">
      <div className="w-16 h-16 rounded-full bg-neon-green/10 border border-neon-green/20 flex items-center justify-center mx-auto mb-6">
        <CheckCircle size={28} className="text-neon-green" />
      </div>
      <h2 className="text-2xl font-black text-white mb-2">Check your email</h2>
      <p className="text-slate-400 text-sm mb-8">
        We sent a password reset link to <span className="text-white font-medium">{email}</span>
      </p>
      <Link to="/login" className="btn-secondary flex items-center justify-center gap-2 w-full">
        <ArrowLeft size={14} /> Back to Sign In
      </Link>
    </div>
  )

  return (
    <div className="animate-fade-in">
      <Link to="/login" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-8">
        <ArrowLeft size={14} /> Back to Sign In
      </Link>
      <h2 className="text-3xl font-black text-white mb-1">Reset password</h2>
      <p className="text-slate-400 text-sm mb-8">Enter your email and we'll send you a reset link</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email</label>
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="input pl-10" required />
          </div>
        </div>
        {error && <p className="text-neon-red text-xs bg-neon-red/5 border border-neon-red/20 rounded-xl px-4 py-3">{error}</p>}
        <button type="submit" disabled={loading || !email} className="btn-primary w-full py-3">
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
    </div>
  )
}
