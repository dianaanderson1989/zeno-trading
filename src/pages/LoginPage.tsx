import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { Mail, Lock, ArrowRight } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormData = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password })
    if (error) { setError(error.message); setLoading(false) }
    else navigate('/dashboard')
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-black text-white mb-1">Welcome back</h2>
      <p className="text-slate-400 text-sm mb-8">Sign in to your Zeno account</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email</label>
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
            <input {...register('email')} type="email" placeholder="you@example.com" className="input pl-10" />
          </div>
          {errors.email && <p className="text-neon-red text-xs mt-1.5">{errors.email.message}</p>}
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
            <Link to="/forgot-password" className="text-xs text-neon-green/70 hover:text-neon-green transition-colors">Forgot password?</Link>
          </div>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
            <input {...register('password')} type="password" placeholder="••••••••" className="input pl-10" />
          </div>
          {errors.password && <p className="text-neon-red text-xs mt-1.5">{errors.password.message}</p>}
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm text-neon-red border border-neon-red/20 bg-neon-red/5">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          {loading ? (
            <span className="w-4 h-4 border-2 border-dark-950/30 border-t-dark-950 rounded-full animate-spin" />
          ) : (
            <><span>Sign In</span><ArrowRight size={15} /></>
          )}
        </button>
      </form>

      <div className="mt-8 text-center">
        <p className="text-slate-500 text-sm">
          Don't have an account?{' '}
          <Link to="/register" className="text-neon-green font-semibold hover:text-neon-green/80 transition-colors">Create one</Link>
        </p>
      </div>
    </div>
  )
}
