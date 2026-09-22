import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowUpFromLine, Copy, Check, X } from 'lucide-react'
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
  return <canvas ref={canvasRef} className="rounded-lg mx-auto" />
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

  const { data: depositAddresses = [] } = useQuery({
    queryKey: ['deposit_addresses', selectedWallet?.asset_id],
    enabled: !!selectedWallet && modal === 'deposit',
    queryFn: async () => {
      const { data } = await supabase.from('deposit_addresses').select('*')
        .eq('asset_id', selectedWallet!.asset_id).eq('is_active', true)
      return data ?? []
    },
  })

  const currentDepositAddress = depositAddresses.find((a: any) => a.network === selectedNetwork)
  const networks = ['ERC20', 'TRC20', 'BEP20', 'BTC', 'SOL']

  const openModal = (type: 'deposit' | 'withdraw', wallet: Wallet) => {
    setModal(type); setSelectedWallet(wallet)
    setSelectedNetwork(''); setAmount(''); setTxHash('')
    setAddress(''); setMsg(''); setCopied(false)
  }

  const copyAddress = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const handleDepositConfirm = async () => {
    if (!user || !selectedWallet || !amount || !selectedNetwork) return
    setSubmitting(true)
    const { error } = await supabase.from('deposits').insert({
      user_id: user.id, asset_id: selectedWallet.asset_id,
      amount: parseFloat(amount), network: selectedNetwork,
      tx_hash: txHash || null, address: currentDepositAddress?.address || null, status: 'pending',
    })
    setSubmitting(false)
    if (error) { setMsg('Error: ' + error.message); return }
    setMsg('✅ Deposit submitted! Closing...')
    queryClient.invalidateQueries({ queryKey: ['wallets'] })
    setTimeout(() => { setModal(null); setMsg('') }, 3000)
  }

  const handleWithdraw = async () => {
    if (!user || !selectedWallet || !amount || !selectedNetwork || !address) return
    setSubmitting(true); setMsg('')
    const { data, error } = await supabase.rpc('submit_withdrawal_with_checks', {
      p_user_id: user.id, p_asset_id: selectedWallet.asset_id,
      p_amount: parseFloat(amount), p_network: selectedNetwork, p_address: address,
    })
    setSubmitting(false)
    if (error) { setMsg('Error: ' + error.message); return }
    if (!data.success) { setMsg((data.kyc_required ? '⚠️ ' : 'Error: ') + data.error); return }
    setMsg('✅ Withdrawal submitted! Closing...')
    queryClient.invalidateQueries({ queryKey: ['wallets'] })
    setTimeout(() => { setModal(null); setMsg('') }, 3000)
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-black text-white">Wallet</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Total: <span className="text-white font-mono font-semibold">{formatCurrency(totalValue)}</span>
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl shimmer" />)}</div>
      ) : (
        <div className="space-y-2">
          {walletsWithValue.map(w => (
            <div key={w.id} className="card p-3 lg:p-4 flex items-center gap-3">
              {/* Icon */}
              {w.assets?.icon_url
                ? <img src={w.assets.icon_url} alt={w.assets.symbol} className="w-9 h-9 rounded-full flex-shrink-0" />
                : <div className="w-9 h-9 rounded-full bg-dark-600 flex items-center justify-center text-xs text-slate-300 flex-shrink-0">{w.assets?.symbol?.[0]}</div>}

              {/* Name + balance */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-200 text-sm">{w.assets?.symbol}</p>
                  <p className="font-mono text-sm text-slate-200">{formatCurrency(w.usdValue)}</p>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs text-slate-500">{formatNumber(w.balance, 4)}</p>
                  <p className={`text-xs ${getChangeColor(w.change24h)}`}>{formatPercent(w.change24h)}</p>
                </div>
              </div>

              {/* Actions — icon only on mobile */}
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => openModal('deposit', w)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-neon-green/10 text-neon-green hover:bg-neon-green/20 transition-colors"
                  title="Deposit">
                  <ArrowDownToLine size={14} />
                </button>
                <button onClick={() => openModal('withdraw', w)} disabled={w.balance === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] text-slate-400 hover:bg-white/[0.08] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Withdraw">
                  <ArrowUpFromLine size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && selectedWallet && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50"
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden animate-slide-up"
            style={{ background: '#0d1424', border: '1px solid rgba(255,255,255,0.08)' }}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-base font-black text-white">
                {modal === 'deposit' ? '↓ Deposit' : '↑ Withdraw'} {selectedWallet.assets?.symbol}
              </h2>
              <button onClick={() => setModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] text-slate-400">
                <X size={15} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Network selector */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Select Network</p>
                <div className="flex flex-wrap gap-2">
                  {networks.map(n => (
                    <button key={n} onClick={() => { setSelectedNetwork(n); setMsg('') }}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        selectedNetwork === n
                          ? 'border-neon-green/40 bg-neon-green/10 text-neon-green'
                          : 'border-white/[0.06] text-slate-400 hover:text-white'
                      }`}>{n}</button>
                  ))}
                </div>
              </div>

              {/* Deposit flow */}
              {modal === 'deposit' && selectedNetwork && (
                <>
                  {currentDepositAddress ? (
                    <div className="space-y-4">
                      <div className="bg-dark-800 rounded-2xl p-4 flex flex-col items-center gap-3">
                        <QRCanvas text={currentDepositAddress.address} />
                        <p className="text-xs text-slate-500">Scan to get address</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Address</p>
                        <div className="flex gap-2">
                          <div className="flex-1 bg-dark-800 rounded-xl px-3 py-2.5 font-mono text-xs text-slate-300 break-all">
                            {currentDepositAddress.address}
                          </div>
                          <button onClick={() => copyAddress(currentDepositAddress.address)}
                            className="w-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-neon-green/10 text-neon-green hover:bg-neon-green/20 transition-colors">
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-3 py-2.5 text-xs text-yellow-400">
                        ⚠️ Only send {selectedWallet.assets?.symbol} on {selectedNetwork} to this address.
                      </div>
                      <div className="border-t border-white/[0.06] pt-4 space-y-3">
                        <p className="text-xs font-bold text-slate-400">Confirm after sending:</p>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                          placeholder={`Amount (${selectedWallet.assets?.symbol})`} className="input text-sm" />
                        <input value={txHash} onChange={e => setTxHash(e.target.value)}
                          placeholder="Transaction hash (optional)" className="input text-sm font-mono" />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-500 text-sm">
                      No address configured for {selectedWallet.assets?.symbol} on {selectedNetwork}
                    </div>
                  )}
                </>
              )}

              {/* Withdraw flow */}
              {modal === 'withdraw' && selectedNetwork && (
                <div className="space-y-3">
                  <input value={address} onChange={e => setAddress(e.target.value)}
                    placeholder="Your withdrawal address" className="input text-sm font-mono" />
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs text-slate-500">Amount ({selectedWallet.assets?.symbol})</span>
                      <button onClick={() => setAmount(String(selectedWallet.balance))} className="text-xs text-neon-green">
                        Max: {formatNumber(selectedWallet.balance, 4)}
                      </button>
                    </div>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                      placeholder="0.00" className="input text-sm" />
                  </div>
                </div>
              )}

              {msg && (
                <p className={`text-xs p-3 rounded-xl ${msg.startsWith('Error') || msg.startsWith('⚠️')
                  ? 'bg-neon-red/10 text-neon-red' : 'bg-neon-green/10 text-neon-green'}`}>{msg}</p>
              )}

              {selectedNetwork && (
                <div className="flex gap-3 pb-2">
                  <button onClick={() => setModal(null)} className="btn-secondary flex-1 py-3 text-sm">Cancel</button>
                  {((modal === 'deposit' && currentDepositAddress && amount) ||
                    (modal === 'withdraw' && address && amount)) && (
                    <button
                      onClick={modal === 'deposit' ? handleDepositConfirm : handleWithdraw}
                      disabled={submitting}
                      className="btn-primary flex-1 py-3 text-sm font-bold">
                      {submitting ? 'Submitting...' : modal === 'deposit' ? 'Confirm Deposit' : 'Request Withdrawal'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
