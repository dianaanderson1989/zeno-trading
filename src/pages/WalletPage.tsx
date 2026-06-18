import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowUpFromLine, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useWallets } from '@/hooks/useWallets'
import { usePrices } from '@/hooks/usePrices'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatNumber, formatPercent, getChangeColor } from '@/utils/format'
import type { Wallet } from '@/types'

export function WalletPage() {
  const user = useAuthStore(s => s.user)
  const { data: wallets = [], isLoading } = useWallets()
  const { prices } = usePrices()
  const queryClient = useQueryClient()

  const [modal, setModal] = useState<'deposit' | 'withdraw' | null>(null)
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null)
  const [amount, setAmount] = useState('')
  const [network, setNetwork] = useState('ERC20')
  const [txHash, setTxHash] = useState('')
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  const totalValue = wallets.reduce((sum, w) => {
    return sum + w.balance * (prices[w.asset_id]?.price ?? 0)
  }, 0)

  const walletsWithValue = wallets.map(w => ({
    ...w,
    usdValue: w.balance * (prices[w.asset_id]?.price ?? 0),
    change24h: prices[w.asset_id]?.change_24h ?? 0,
  })).sort((a, b) => b.usdValue - a.usdValue)

  const openModal = (type: 'deposit' | 'withdraw', wallet: Wallet) => {
    setModal(type)
    setSelectedWallet(wallet)
    setAmount('')
    setTxHash('')
    setAddress('')
    setMsg('')
  }

  const handleDeposit = async () => {
    if (!user || !selectedWallet || !amount || !network) return
    setSubmitting(true)
    const { error } = await supabase.from('deposits').insert({
      user_id: user.id,
      asset_id: selectedWallet.asset_id,
      amount: parseFloat(amount),
      network,
      tx_hash: txHash || null,
      status: 'pending',
    })
    setSubmitting(false)
    if (error) { setMsg('Error: ' + error.message); return }
    setMsg('Deposit request submitted! Awaiting admin approval.')
    queryClient.invalidateQueries({ queryKey: ['wallets'] })
  }

  const handleWithdraw = async () => {
    if (!user || !selectedWallet || !amount || !network || !address) return
    setSubmitting(true)
    const { error } = await supabase.from('withdrawals').insert({
      user_id: user.id,
      asset_id: selectedWallet.asset_id,
      amount: parseFloat(amount),
      network,
      address,
      status: 'pending',
    })
    setSubmitting(false)
    if (error) { setMsg('Error: ' + error.message); return }
    setMsg('Withdrawal request submitted! Awaiting admin approval.')
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Wallet</h1>
        <p className="text-gray-400 text-sm mt-1">Total Value: <span className="text-white font-mono font-semibold">{formatCurrency(totalValue)}</span></p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-dark-800 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-600 text-gray-500 text-xs uppercase">
                <th className="text-left p-4 font-medium">Asset</th>
                <th className="text-right p-4 font-medium">Balance</th>
                <th className="text-right p-4 font-medium">Value (USD)</th>
                <th className="text-right p-4 font-medium hidden md:table-cell">24h</th>
                <th className="text-right p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-600">
              {walletsWithValue.map(w => (
                <tr key={w.id} className="hover:bg-dark-700/40 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {w.assets?.icon_url
                        ? <img src={w.assets.icon_url} alt={w.assets.symbol} className="w-8 h-8 rounded-full" />
                        : <div className="w-8 h-8 rounded-full bg-dark-500 flex items-center justify-center text-xs text-gray-300">{w.assets?.symbol?.[0]}</div>
                      }
                      <div>
                        <p className="font-medium text-gray-200">{w.assets?.symbol}</p>
                        <p className="text-xs text-gray-500">{w.assets?.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono text-gray-200">{formatNumber(w.balance, 6)}</td>
                  <td className="p-4 text-right font-mono text-gray-200">{formatCurrency(w.usdValue)}</td>
                  <td className="p-4 text-right hidden md:table-cell">
                    <span className={`text-sm ${getChangeColor(w.change24h)}`}>{formatPercent(w.change24h)}</span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openModal('deposit', w)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 rounded-lg transition-colors">
                        <ArrowDownToLine size={12} /> Deposit
                      </button>
                      <button onClick={() => openModal('withdraw', w)} disabled={w.balance === 0} className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-dark-600 text-gray-400 hover:bg-dark-500 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <ArrowUpFromLine size={12} /> Withdraw
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && selectedWallet && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-white mb-1">
              {modal === 'deposit' ? 'Deposit' : 'Withdraw'} {selectedWallet.assets?.symbol}
            </h2>
            <p className="text-gray-400 text-sm mb-5">
              {modal === 'deposit'
                ? 'Submit a deposit request. An admin will approve and credit your account.'
                : 'Submit a withdrawal request. An admin will process it.'}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Network</label>
                <select value={network} onChange={e => setNetwork(e.target.value)} className="input text-sm">
                  <option value="ERC20">ERC20 (Ethereum)</option>
                  <option value="TRC20">TRC20 (Tron)</option>
                  <option value="BEP20">BEP20 (BSC)</option>
                  <option value="SOL">Solana</option>
                  <option value="BTC">Bitcoin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Amount ({selectedWallet.assets?.symbol})</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="input text-sm" />
              </div>
              {modal === 'deposit' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Transaction Hash (optional)</label>
                  <input value={txHash} onChange={e => setTxHash(e.target.value)} placeholder="0x..." className="input text-sm" />
                </div>
              )}
              {modal === 'withdraw' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Withdrawal Address</label>
                  <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Your wallet address" className="input text-sm" />
                </div>
              )}
            </div>

            {msg && <p className={`text-xs mt-3 p-2 rounded-lg ${msg.startsWith('Error') ? 'bg-red-500/10 text-red-400' : 'bg-brand-500/10 text-brand-400'}`}>{msg}</p>}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={modal === 'deposit' ? handleDeposit : handleWithdraw}
                disabled={submitting || !amount}
                className="btn-primary flex-1"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
