import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-dark-950 bg-grid flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-16 relative overflow-hidden">
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #00ff88, transparent)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full opacity-8 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #00d4ff, transparent)' }} />

        <div className="relative max-w-md w-full">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-dark-950 text-lg"
              style={{ background: 'linear-gradient(135deg, #00ff88, #00d4ff)', boxShadow: '0 0 24px rgba(0,255,136,0.5)' }}>
              Z
            </div>
            <div>
              <span className="text-2xl font-black text-white tracking-tight">Zeno</span>
              <p className="text-xs text-neon-green/60 font-mono">TRADING PLATFORM</p>
            </div>
          </div>

          <h1 className="text-4xl font-black text-white mb-4 leading-tight">
            Trade smarter.<br />
            <span style={{ background: 'linear-gradient(135deg, #00ff88, #00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Win bigger.
            </span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed mb-10">
            Binary options, spot trading, staking — all in one high-performance platform.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Assets', value: '8+' },
              { label: 'Max Payout', value: '68%' },
              { label: 'Trading Fee', value: '0.1%' },
              { label: 'Max APY', value: '12.5%' },
            ].map(s => (
              <div key={s.label} className="card-neon card p-4">
                <p className="text-neon-green font-black text-2xl glow-green">{s.value}</p>
                <p className="text-slate-500 text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-dark-950 text-sm"
              style={{ background: 'linear-gradient(135deg, #00ff88, #00d4ff)' }}>Z</div>
            <span className="text-xl font-black text-white">Zeno</span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
