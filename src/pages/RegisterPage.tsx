import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'

const schema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
  referral_code: z.string().optional(),
}).refine(d => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})
type FormData = z.infer<typeof schema>

export function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // Pre-fill referral code from URL
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) setValue('referral_code', ref)
  }, [searchParams])

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')

    // Resolve referrer if code provided
    let referrerId: string | null = null
    if (data.referral_code) {
      const { data: referrer } = await supabase
        .from('users')
        .select('id')
        .eq('referral_code', data.referral_code.toUpperCase())
        .single()
      if (referrer) referrerId = referrer.id
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          first_name: data.first_name,
          last_name: data.last_name,
        },
      },
    })

    if (authError) { setError(authError.message); setLoading(false); return }

    // Link referral after signup
    if (referrerId && authData.user) {
      await supabase.from('users').update({ referred_by: referrerId }).eq('id', authData.user.id)
      await supabase.from('referrals').insert({
        referrer_id: referrerId,
        referred_id: authData.user.id,
        code: data.referral_code!.toUpperCase(),
        status: 'pending',
      })
    }

    navigate('/dashboard')
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">Create account</h2>
      <p className="text-gray-400 mb-8">Start with $10,000 paper trading balance</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">First Name</label>
            <input {...register('first_name')} placeholder="John" className="input" />
            {errors.first_name && <p className="text-red-400 text-xs mt-1">{errors.first_name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Last Name</label>
            <input {...register('last_name')} placeholder="Doe" className="input" />
            {errors.last_name && <p className="text-red-400 text-xs mt-1">{errors.last_name.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
          <input {...register('email')} type="email" placeholder="you@example.com" className="input" />
          {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
          <input {...register('password')} type="password" placeholder="Min 8 characters" className="input" />
          {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm Password</label>
          <input {...register('confirm_password')} type="password" placeholder="••••••••" className="input" />
          {errors.confirm_password && <p className="text-red-400 text-xs mt-1">{errors.confirm_password.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Referral Code <span className="text-gray-500 font-normal">(optional)</span>
          </label>
          <input {...register('referral_code')} placeholder="e.g. ABC12345" className="input uppercase" />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="text-gray-400 text-sm mt-6 text-center">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">Sign in</Link>
      </p>
    </div>
  )
}
