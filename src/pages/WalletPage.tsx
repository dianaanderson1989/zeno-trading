import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowUpFromLine, Copy, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useWallets } from '@/hooks/useWallets'
import { usePrices } from '@/hooks/usePrices'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatNumber, formatPercent, getChangeColor } from '@/utils/format'
import type { Wallet } from '@/types'
import QRCode from 'qrcode'
import { useEffect, useRef } from 'react'

function QRCanvas({ text }: { text: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvasRef.current && text) {
      QRCode.toCanvas(canvasRef.current, text, {
        width: 180, margin: 2,
        color: { dark: '#ffffff', light: '#0f1626' }
      })
    }
  }, [text])
  return <canvas ref={canvasRef} className="rounded-lg" />
}

export function WalletPage() {
  const user = useAuthStore(s => s.user)
  const { data: wallets = [], isLoading } = useWallets()
  const { prices } = usePrices()
  const queryClient = useQueryClient()

  const [modal, setModal] = useState<'deposit' | 'withdraw' | null>(null)
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null)
  const [selectedNetwork, setSelectedNetwork] = useState('')
  const [amount, setAmount] = useState('')
  const [txHash, setTxHash] = useState('')
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)

  const totalValue = wallets.reduce((sum, w) => sum + w.balance * (prices[w.asset_id]?.price ?? 0), 0)

  const walletsWithValue = wallets.map(w => ({
    ...w,
    usdValue: w.balance * (prices[w.asset_id]?.price ?? 0),
    change24h: prices[w.asset_id]?.change_24h ?? 0,
  })).sort((a, b) => b.usdValue - a.usdValue)

  // Deposit addresses for selected wallet + network
  const { data: depositAddresses = [] } = useQuery({
    queryKey: ['deposit_addresses', selectedWallet?.asset_id],
    enabled: !!selectedWallet && modal === 'deposit',
    queryFn: async () => {
      const { data } = await supabase
        .from('deposit_addresses')
        .select('*')
        .eq('asset_id', selectedWallet!.asset_id)
        .eq('is_active', true)
      return data ?? []
    },
  })

  const currentDepositAddress = depositAddresses.find((a: any) => a.network === selectedNetwork)

  const openModal = (type: 'deposit' | 'withdraw', wallet: Wallet) => {
    setModal(type)
    setSelectedWallet(wallet)
    setSelectedNetwork('')
    setAmount('')
    setTxHash('')
    setAddress('')
    setMsg('')
    setCopied(false)
  }

  const copyAddress = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDepositConfirm = async () => {
    if (!user || !selectedWallet || !amount || !selectedNetwork) return
    setSubmitting(true)
    const { error } = await supabase.from('deposits').insert({
      user_id: user.id,
      asset_id: selectedWallet.asset_id,
      amount: parseFloat(amount),
      network: selectedNetwork,
      tx_hash: txHash || null,
      address: currentDepositAddress?.address || null,
      status: 'pending',
    })
    setSubmitting(false)
    if (error) { setMsg('Error: ' + error.message); return }
    setMsg('Deposit submitted! Admin will verify and credit your account.')
    queryClient.invalidateQueries({ queryKey: ['wallets'] })
  }

  const handleWithdraw = async () => {
    if (!user || !selectedWallet || !amount || !selectedNetwork || !address) return
    setSubmitting(true)
    const { error } = await supabase.from('withdrawals').insert({
      user_id: user.id,
      asset_id: selectedWallet.asset_id,
      amount: parseFloat(amount),
      network: selectedNetwork,
      address,
      status: 'pending',
    })
    setSubmitting(false)
    if (error) { setMsg('Error: ' + error.message); return }
    setMsg('Withdrawal request submitted! Awaiting admin approval.')
  }

  const networks = ['ERC20', 'TRC20', 'BEP20', 'BTC', 'SOL', 'Polygon', 'Arbitrum']

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
                        : <div className="w-8 h-8 rounded-full bg-dark-500 flex items-center justify-center text-xs text-gray-300">{w.assets?.symbol?.[0]}</div>}
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
                      <button onClick={() => openModal('deposit', w)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 rounded-lg transition-colors">
                        <ArrowDownToLine size={12} /> Deposit
                      </button>
                      <button onClick={() => openModal('withdraw', w)} disabled={w.balance === 0}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-dark-600 text-gray-400 hover:bg-dark-500 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                {modal === 'deposit' ? 'Deposit' : 'Withdraw'} {selectedWallet.assets?.symbol}
              </h2>
              <button onClick={() => setModal(null)} className="text-gray-500 hover:text-gray-300">✕</button>
            </div>

            {/* Network select */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1.5">Select Network</label>
              <div className="flex flex-wrap gap-2">
                {networks.map(n => (
                  <button key={n} onClick={() => { setSelectedNetwork(n); setMsg('') }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      selectedNetwork === n
                        ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                        : 'border-dark-500 text-gray-400 hover:text-gray-200'
                    }`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {modal === 'deposit' && selectedNetwork && (
              <>
                {currentDepositAddress ? (
                  <div className="space-y-4">
                    {/* QR Code */}
                    <div className="flex flex-col items-center bg-dark-700 rounded-xl p-4 gap-3">
                      <QRCanvas text={currentDepositAddress.address} />
                      <p className="text-xs text-gray-400 text-center">Scan to get deposit address</p>
                    </div>

                    {/* Address */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">
                        {selectedWallet.assets?.symbol} Address ({selectedNetwork})
                      </label>
                      <div className="flex gap-2">
                        <div className="input flex-1 font-mono text-xs text-gray-200 break-all leading-relaxed">
                          {currentDepositAddress.address}
                        </div>
                        <button onClick={() => copyAddress(currentDepositAddress.address)}
                          className="btn-secondary flex-shrink-0 flex items-center gap-1 px-3 text-sm">
                          {copied ? <><Check size={13} className="text-brand-400" /> Copied</> : <><Copy size={13} /> Copy</>}
                        </button>
                      </div>
                      {currentDepositAddress.label && (
                        <p className="text-xs text-gray-500 mt-1">{currentDepositAddress.label}</p>
                      )}
                    </div>

                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-xs text-yellow-400">
                      ⚠️ Only send {selectedWallet.assets?.symbol} on the {selectedNetwork} network to this address. Sending wrong assets will result in permanent loss.
                    </div>

                    {/* Confirm sent */}
                    <div className="border-t border-dark-600 pt-4 space-y-3">
                      <p className="text-xs text-gray-400 font-medium">After sending, confirm your deposit below:</p>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">Amount Sent ({selectedWallet.assets?.symbol})</label>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="input text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">Transaction Hash (optional but recommended)</label>
                        <input value={txHash} onChange={e => setTxHash(e.target.value)} placeholder="0x..." className="input text-sm font-mono" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-dark-700 rounded-xl p-6 text-center">
                    <p className="text-gray-400 text-sm">No deposit address configured for {selectedWallet.assets?.symbol} on {selectedNetwork}.</p>
                    <p className="text-gray-500 text-xs mt-1">Please contact support or try another network.</p>
                  </div>
                )}
              </>
            )}

            {modal === 'withdraw' && selectedNetwork && (
              <div className="space-y-3 mt-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Your Withdrawal Address</label>
                  <input value={address} onChange={e => setAddress(e.target.value)} placeholder={`Your ${selectedNetwork} address`} className="input text-sm font-mono" />
                </div>
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-xs text-gray-400">Amount ({selectedWallet.assets?.symbol})</label>
                    <button onClick={() => setAmount(String(selectedWallet.balance))} className="text-xs text-brand-400">Max: {formatNumber(selectedWallet.balance, 6)}</button>
                  </div>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="input text-sm" />
                </div>
                <div className="bg-dark-700 rounded-lg p-3 text-xs text-gray-400">
                  Withdrawal requests are reviewed by admin within 24 hours.
                </div>
              </div>
            )}

            {msg && (
              <p className={`text-xs mt-3 p-2 rounded-lg ${msg.startsWith('Error') ? 'bg-red-500/10 text-red-400' : 'bg-brand-500/10 text-brand-400'}`}>{msg}</p>
            )}

            {selectedNetwork && (
              <div className="flex gap-3 mt-5">
                <button onClick={() => setModal(null)} className="btn-secondary flex-1">Close</button>
                {((modal === 'deposit' && currentDepositAddress && amount) ||
                  (modal === 'withdraw' && address && amount)) && (
                  <button
                    onClick={modal === 'deposit' ? handleDepositConfirm : handleWithdraw}
                    disabled={submitting}
                    className="btn-primary flex-1"
                  >
                    {submitting ? 'Submitting...' : modal === 'deposit' ? 'Confirm Deposit' : 'Request Withdrawal'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
