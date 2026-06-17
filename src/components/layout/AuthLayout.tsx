import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-dark-900 flex">
      {/* Left: branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-dark-800 flex-col justify-center items-center p-12 border-r border-dark-600">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center font-bold text-white text-lg">Z</div>
            <span className="text-2xl font-bold text-white">Zeno</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Trade crypto with confidence
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            Practice with paper trading, earn staking rewards, and swap assets — all in one platform.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              { label: 'Assets', value: '8+' },
              { label: 'Starter Balance', value: '$10,000' },
              { label: 'Trading Fee', value: '0.1%' },
              { label: 'Max APY', value: '12.5%' },
            ].map(stat => (
              <div key={stat.label} className="bg-dark-700 rounded-xl p-4 border border-dark-500">
                <p className="text-brand-400 font-bold text-xl">{stat.value}</p>
                <p className="text-gray-400 text-sm mt-1">{stat.label}</p>
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
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-white">Z</div>
            <span className="text-xl font-bold text-white">Zeno</span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
