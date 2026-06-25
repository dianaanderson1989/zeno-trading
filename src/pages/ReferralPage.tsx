import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, Check, Users, DollarSign, Gift, Share2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatDate } from '@/utils/format'

export function ReferralPage() {
  const { user, fetchProfile } = useAuthStore()
  const [copied, setCopied] = useState(false)

  // Refresh profile to get referral_code
  useEffect(() => { if (user?.id) fetchProfile(user.id) }, [user?.id])

  const referralCode = (user as any)?.referral_code ?? '...'
  const referralLink = `${window.location.origin}/register?ref=${referralCode}`
  const totalEarnings = (user as any)?.total_referral_earnings ?? 0

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['my_referrals', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('referrals')
        .select('*, referred:users!referrals_referred_id_fkey(email, first_name, last_name, created_at)')
        .eq('referrer_id', user!.id)
        .order('created_at', { ascending: false })
      return data ?? []
    },
    staleTime: 30_000,
  })

  const completed = referrals.filter((r: any) => r.status === 'completed')
  const pending = referrals.filter((r: any) => r.status === 'pending')

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Referral Program</h1>
        <p className="text-gray-400 text-sm mt-1">Invite friends and earn $10 USDT when they make their first trade</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Invited', value: referrals.length, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Completed', value: completed.length, icon: Check, color: 'text-brand-400', bg: 'bg-brand-500/10' },
          { label: 'Total Earned', value: formatCurrency(totalEarnings), icon: DollarSign, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
        ].map(stat => (
          <div key={stat.label} className="card text-center">
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mx-auto mb-2`}>
              <stat.icon size={18} className={stat.color} />
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="card bg-gradient-to-br from-brand-500/10 to-dark-700 border-brand-500/20">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2"><Gift size={16} className="text-brand-400" /> How It Works</h2>
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          {[
            { step: '1', label: 'Share your link', desc: 'Send your unique referral link to friends' },
            { step: '2', label: 'Friend signs up', desc: 'They register using your link' },
            { step: '3', label: 'Earn $10 USDT', desc: 'When they complete their first trade' },
          ].map(s => (
            <div key={s.step} className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-sm mx-auto">{s.step}</div>
              <p className="font-medium text-gray-200">{s.label}</p>
              <p className="text-xs text-gray-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Referral code + link */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2"><Share2 size={16} /> Your Referral</h2>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Referral Code</label>
          <div className="flex gap-2">
            <div className="input flex-1 font-mono text-brand-400 font-bold tracking-widest text-lg flex items-center">
              {referralCode}
            </div>
            <button onClick={() => copy(referralCode)} className="btn-secondary flex items-center gap-2 px-4">
              {copied ? <Check size={15} className="text-brand-400" /> : <Copy size={15} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Referral Link</label>
          <div className="flex gap-2">
            <div className="input flex-1 text-sm text-gray-300 truncate flex items-center">
              {referralLink}
            </div>
            <button onClick={() => copy(referralLink)} className="btn-primary flex items-center gap-2 px-4">
              {copied ? <Check size={15} /> : <Copy size={15} />}
              Copy Link
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <a
            href={`https://twitter.com/intent/tweet?text=Join%20me%20on%20Zeno%20Trading%20and%20get%20%2410%20USDT!%20Use%20my%20code%3A%20${referralCode}&url=${encodeURIComponent(referralLink)}`}
            target="_blank" rel="noopener noreferrer"
            className="btn-secondary text-sm flex items-center gap-2"
          >
            Share on X (Twitter)
          </a>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Join%20Zeno%20Trading%20with%20my%20referral%20link%20and%20earn%20%2410%20USDT!`}
            target="_blank" rel="noopener noreferrer"
            className="btn-secondary text-sm flex items-center gap-2"
          >
            Share on Telegram
          </a>
        </div>
      </div>

      {/* Referral history */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Referral History</h2>
        {isLoading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-dark-700 rounded-lg animate-pulse" />)}</div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-8">
            <Users size={32} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No referrals yet</p>
            <p className="text-gray-500 text-xs mt-1">Share your link to start earning</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-600 text-gray-500 text-xs uppercase">
                <th className="text-left pb-3 font-medium">Friend</th>
                <th className="text-left pb-3 font-medium">Joined</th>
                <th className="text-left pb-3 font-medium">Status</th>
                <th className="text-right pb-3 font-medium">Reward</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-600">
              {referrals.map((r: any) => (
                <tr key={r.id} className="hover:bg-dark-700/40">
                  <td className="py-3">
                    <p className="text-gray-200">
                      {r.referred?.first_name ? `${r.referred.first_name} ${r.referred.last_name ?? ''}` : 'Pending signup'}
                    </p>
                    {r.referred?.email && <p className="text-xs text-gray-500">{r.referred.email}</p>}
                  </td>
                  <td className="py-3 text-xs text-gray-400">
                    {r.referred?.created_at ? formatDate(r.referred.created_at) : '—'}
                  </td>
                  <td className="py-3">
                    <span className={`badge ${
                      r.status === 'completed' ? 'bg-brand-500/15 text-brand-400' :
                      r.status === 'pending' ? 'bg-yellow-500/15 text-yellow-400' :
                      'bg-gray-500/15 text-gray-400'
                    }`}>
                      {r.status === 'completed' ? '✓ Rewarded' : r.status === 'pending' ? '⏳ Pending trade' : r.status}
                    </span>
                  </td>
                  <td className="py-3 text-right font-mono">
                    {r.status === 'completed'
                      ? <span className="text-brand-400">+{formatCurrency(r.reward_amount)}</span>
                      : <span className="text-gray-500">$10.00</span>}
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
