import { LogOut } from 'lucide-react'

interface Props {
  onConfirm: () => void
  onCancel: () => void
}

export function SignOutConfirm({ onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="w-full max-w-xs rounded-2xl overflow-hidden animate-slide-up"
        style={{ background: '#0d1424', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-6 pt-6 pb-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-neon-red/10 border border-neon-red/20 flex items-center justify-center mx-auto mb-4">
            <LogOut size={20} className="text-neon-red" />
          </div>
          <h3 className="text-base font-black text-white mb-1">Sign Out?</h3>
          <p className="text-sm text-slate-500">You'll need to sign in again to access your account.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 px-6 pb-6">
          <button onClick={onCancel}
            className="py-3 rounded-xl text-sm font-bold text-slate-300 bg-white/[0.05] hover:bg-white/[0.08] transition-colors border border-white/[0.06]">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="py-3 rounded-xl text-sm font-bold text-white bg-neon-red hover:bg-neon-red/80 transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
