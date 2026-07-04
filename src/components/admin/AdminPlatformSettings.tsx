import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings, Shield, AlertTriangle, Save, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Setting { key: string; value: string; description: string }

const SETTING_CONFIG: Record<string, { label: string; type: 'toggle' | 'number'; desc: string; prefix?: string }> = {
  kyc_required_global:  { label: 'Require KYC for all withdrawals', type: 'toggle', desc: 'When ON, every user must be KYC verified before any withdrawal' },
  kyc_threshold_usd:    { label: 'KYC threshold (USD)',             type: 'number', desc: 'Withdrawals above this amount require KYC verification', prefix: '$' },
  large_withdrawal_usd: { label: 'Large withdrawal flag (USD)',     type: 'number', desc: 'Withdrawals above this amount are auto-flagged for review', prefix: '$' },
  new_address_flag:     { label: 'Flag new withdrawal addresses',   type: 'toggle', desc: 'Flag withdrawals to addresses never previously used by the user' },
  balance_pct_flag:     { label: 'High balance % flag',            type: 'number', desc: "Flag withdrawals exceeding this % of the user's total balance", prefix: '%' },
}

export function AdminPlatformSettings() {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [localValues, setLocalValues] = useState<Record<string, string>>({})

  const { data: settings = [], isLoading, refetch } = useQuery({
    queryKey: ['platform_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('platform_settings').select('*')
      if (error) throw error
      return (data ?? []) as Setting[]
    },
    staleTime: 30_000,
  })

  const getValue = (key: string) => key in localValues ? localValues[key] : (settings.find(s => s.key === key)?.value ?? '')
  const setValue = (key: string, value: string) => setLocalValues(prev => ({ ...prev, [key]: value }))
  const hasChanges = Object.keys(localValues).length > 0

  const saveAll = async () => {
    setSaving(true)
    const adminId = (await supabase.auth.getUser()).data.user?.id
    await Promise.all(Object.entries(localValues).map(([key, value]) =>
      supabase.from('platform_settings').update({ value, updated_by: adminId, updated_at: new Date().toISOString() }).eq('key', key)
    ))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setLocalValues({})
    queryClient.invalidateQueries({ queryKey: ['platform_settings'] })
  }

  const renderControl = (key: string) => {
    const cfg = SETTING_CONFIG[key]
    const val = getValue(key)
    if (cfg.type === 'toggle') return (
      <button onClick={() => setValue(key, val === 'true' ? 'false' : 'true')}
        className={`relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0 ${val === 'true' ? 'bg-neon-green shadow-neon-green' : 'bg-dark-600'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200 ${val === 'true' ? 'left-[calc(100%-22px)]' : 'left-0.5'}`} />
      </button>
    )
    return (
      <div className="relative flex-shrink-0">
        {cfg.prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-mono">{cfg.prefix}</span>}
        <input type="number" value={val} onChange={e => setValue(key, e.target.value)}
          className={`input text-sm w-32 font-mono ${cfg.prefix ? 'pl-7' : ''}`} />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><Settings size={20} className="text-neon-cyan" /> Platform Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Global KYC enforcement and security thresholds</p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"><RefreshCw size={12} /> Refresh</button>
      </div>

      {saved && (
        <div className="card bg-neon-green/5 border border-neon-green/20 text-neon-green text-sm font-semibold flex items-center gap-2">
          <Save size={14} /> Settings saved successfully
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-xl shimmer" />)}</div>
      ) : (
        <>
          <div className="card space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-white/[0.05]">
              <Shield size={15} className="text-neon-green" />
              <h2 className="font-bold text-white text-sm uppercase tracking-wider">KYC Enforcement</h2>
            </div>
            {['kyc_required_global', 'kyc_threshold_usd'].map(key => (
              <div key={key} className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-200">{SETTING_CONFIG[key].label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{SETTING_CONFIG[key].desc}</p>
                </div>
                {renderControl(key)}
              </div>
            ))}
          </div>

          <div className="card space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-white/[0.05]">
              <AlertTriangle size={15} className="text-neon-yellow" />
              <h2 className="font-bold text-white text-sm uppercase tracking-wider">Suspicious Activity Flags</h2>
            </div>
            {['large_withdrawal_usd', 'new_address_flag', 'balance_pct_flag'].map(key => (
              <div key={key} className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-200">{SETTING_CONFIG[key].label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{SETTING_CONFIG[key].desc}</p>
                </div>
                {renderControl(key)}
              </div>
            ))}
          </div>

          <div className="card border border-white/[0.06] space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Current Effective Rules</p>
            <div className="space-y-2 text-xs">
              {[
                { dot: getValue('kyc_required_global') === 'true' ? 'bg-neon-green' : 'bg-slate-600', text: `Global KYC: `, val: getValue('kyc_required_global') === 'true' ? 'REQUIRED' : 'OFF', valColor: getValue('kyc_required_global') === 'true' ? 'text-neon-green' : 'text-slate-500' },
                { dot: 'bg-neon-cyan', text: 'KYC required above: ', val: `$${getValue('kyc_threshold_usd')}`, valColor: 'text-neon-cyan' },
                { dot: 'bg-neon-yellow', text: 'Flag large withdrawals above: ', val: `$${getValue('large_withdrawal_usd')}`, valColor: 'text-neon-yellow' },
                { dot: 'bg-neon-yellow', text: 'Flag new addresses: ', val: getValue('new_address_flag') === 'true' ? 'ON' : 'OFF', valColor: getValue('new_address_flag') === 'true' ? 'text-neon-yellow' : 'text-slate-500' },
                { dot: 'bg-neon-yellow', text: 'Flag if withdrawal > ', val: `${getValue('balance_pct_flag')}% of balance`, valColor: 'text-neon-yellow' },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${row.dot}`} />
                  <span className="text-slate-400">{row.text}<span className={`font-mono font-semibold ${row.valColor}`}>{row.val}</span></span>
                </div>
              ))}
            </div>
          </div>

          {hasChanges && (
            <button onClick={saveAll} disabled={saving} className="btn-primary w-full py-3 flex items-center justify-center gap-2 font-black">
              {saving ? <><span className="w-4 h-4 border-2 border-dark-950/30 border-t-dark-950 rounded-full animate-spin" />Saving...</> : <><Save size={15} />Save Changes</>}
            </button>
          )}
        </>
      )}
    </div>
  )
}
