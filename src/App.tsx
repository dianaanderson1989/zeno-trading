import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { usePriceUpdater } from '@/hooks/usePriceUpdater'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { TradingPage } from '@/pages/TradingPage'
import { BinaryPage } from '@/pages/BinaryPage'
import { StakingPage } from '@/pages/StakingPage'
import { SwapPage } from '@/pages/SwapPage'
import { WalletPage } from '@/pages/WalletPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { ReferralPage } from '@/pages/ReferralPage'
import { AdminPage } from '@/pages/AdminPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useAuth()
  if (!initialized || loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useAuth()
  if (!initialized || loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!['admin', 'super_admin'].includes(user.role)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuth()
  if (!initialized) return <LoadingScreen />
  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-dark-950 text-lg animate-glow-pulse"
          style={{ background: 'linear-gradient(135deg, #00ff88, #00d4ff)' }}>Z</div>
        <p className="text-slate-500 text-sm font-mono">Loading Zeno...</p>
      </div>
    </div>
  )
}

function AppWithPrices() {
  usePriceUpdater()
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login"           element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register"        element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />
      </Route>
      <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/trade"          element={<TradingPage />} />
        <Route path="/trade/:symbol"  element={<TradingPage />} />
        <Route path="/binary"    element={<BinaryPage />} />
        <Route path="/staking"   element={<StakingPage />} />
        <Route path="/swap"      element={<SwapPage />} />
        <Route path="/wallet"    element={<WalletPage />} />
        <Route path="/history"   element={<HistoryPage />} />
        <Route path="/account"   element={<ProfilePage />} />
        <Route path="/referral"  element={<ReferralPage />} />
      </Route>
      <Route path="/admin/*" element={<AdminRoute><AdminPage /></AdminRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  useAuth()
  return (
    <BrowserRouter>
      <AppWithPrices />
    </BrowserRouter>
  )
}
