import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, TrendingUp, TrendingDown, ArrowUpRight, RefreshCw, Layers, ArrowLeftRight, Zap, Trophy, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useTransactions } from '@/hooks/useTransactions'
import { BinaryReceipt } from '@/components/BinaryReceipt'
import { formatCurrency, formatNumber, formatDate } from '@/utils/format'

const TX_TYPES = ['all', 'trade_buy', 'trade_sell', 'deposit', 'withdrawal', 'swap', 'stake']

export function HistoryPage() {
  const user = useAuthStore(s => s.user)
  const [filter, setFilter] = useState('all')
  const [selectedTx, setSelectedTx] = useState<any>(null)
  const [selectedBinaryTrade, setSelectedBinaryTrade] = useState<any>(null)
  const { data: transactions = [], isLoading } = useTransactions()

  const { data: binaryTrades = [] } = useQuery({
    queryKey: ['binary_history_full', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('binary_options')
        .select('*, assets(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      return data ?? []
    },
    staleTime: 30_000,
  })

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.transaction_type === filter)

  const getBinaryTrade = (tx: any) => {
    if (!tx.description?.startsWith('Binary')) return null
    return binaryTrades.find((b: any) =>
      Math.abs(new Date(b.created_at).getTime() - new Date(tx.created_at).getTime()) < 10000
    ) ?? null
  }

  const handleTxClick = (tx: any) => {
    const binary = getBinaryTrade(tx)
    if (binary) {
      setSelectedBinaryTrade(binary)
    } else {
      setSelectedTx(selectedTx?.id === tx.id ? null : tx)
    }
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <h1 className="text-xl lg:text-2xl font-black text-white">History</h1>

      {/* Filter tabs — scrollable on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TX_TYPES.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors whitespace-nowrap flex-shrink-0 ${
              filter === t ? 'bg-neon-green text-dark-950' : 'bg-dark-700 text-slate-400 hover:text-white border border-white/[0.06]'
            }`}>
            {t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Transaction list */}
        <div className={selectedTx ? 'lg:col-span-2' : 'lg:col-span-3'}>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl shimmer" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="card text-center py-12 text-slate-500 text-sm">No transactions found</div>
          ) : (
            <div className="space-y-2">
              {filtered.map(tx => {
                const isBinary = tx.description?.startsWith('Binary')
                return (
                  <div key={tx.id}
                    onClick={() => handleTxClick(tx)}
                    className={`card p-3 lg:p-4 flex items-center gap-3 cursor-pointer transition-all hover:border-neon-green/20 ${
                      selectedTx?.id === tx.id ? 'border-neon-green/30 bg-neon-green/5' : ''
                    }`}>
                    <TxIcon type={tx.transaction_type} isBinary={isBinary} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-slate-200 capitalize">
                          {isBinary ? 'Binary Trade' : tx.transaction_type.replace(/_/g, ' ')}
                        </p>
                        {isBinary && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            tx.transaction_type === 'trade_buy'
                              ? 'bg-neon-green/15 text-neon-green'
                              : 'bg-neon-red/15 text-neon-red'
                          }`}>
                            {tx.transaction_type === 'trade_buy' ? 'WIN' : 'LOSE'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600">{formatDate(tx.created_at)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-mono text-slate-200">
                        {formatNumber(tx.amount, 4)} {tx.assets?.symbol}
                      </p>
                      <span className={`text-[10px] ${
                        tx.status === 'completed' ? 'text-neon-green' :
                        tx.status === 'pending' ? 'text-yellow-400' : 'text-neon-red'
                      }`}>{tx.status}</span>
                    </div>
                    <span className="text-slate-600 text-xs flex-shrink-0">›</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Desktop detail panel */}
        {selectedTx && !selectedBinaryTrade && (
          <div className="hidden lg:block lg:col-span-1 animate-slide-up">
            <div className="card sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white text-sm">Detail</h3>
                <button onClick={() => setSelectedTx(null)} className="text-slate-600 hover:text-slate-300"><X size={15} /></button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <TxIcon type={selectedTx.transaction_type} large />
                <div>
                  <p className="text-slate-200 font-semibold capitalize">{selectedTx.transaction_type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-500">{selectedTx.assets?.name}</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'Amount', value: `${formatNumber(selectedTx.amount, 6)} ${selectedTx.assets?.symbol}`, bold: true },
                  { label: 'Fee', value: selectedTx.fee > 0 ? formatCurrency(selectedTx.fee) : '—' },
                  { label: 'Status', value: selectedTx.status },
                  { label: 'Date', value: formatDate(selectedTx.created_at) },
                  { label: 'Description', value: selectedTx.description || '—', small: true },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-start gap-2">
                    <span className="text-xs text-slate-500 flex-shrink-0">{row.label}</span>
                    <span className={`text-right ${row.small ? 'text-xs' : 'text-sm'} ${row.bold ? 'text-white font-bold font-mono' : 'text-slate-300'}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Binary receipt modal */}
      {selectedBinaryTrade && (
        <BinaryReceipt trade={selectedBinaryTrade} onClose={() => setSelectedBinaryTrade(null)} />
      )}

      {/* Mobile transaction detail sheet */}
      {selectedTx && !selectedBinaryTrade && (
        <div className="lg:hidden fixed inset-0 bg-black/70 flex items-end z-50"
          onClick={e => { if (e.target === e.currentTarget) setSelectedTx(null) }}>
          <div className="w-full rounded-t-3xl p-6 space-y-4 animate-slide-up"
            style={{ background: '#0d1424', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">Transaction Detail</h3>
              <button onClick={() => setSelectedTx(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] text-slate-400">
                <X size={15} />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Type', value: selectedTx.transaction_type.replace(/_/g, ' ') },
                { label: 'Amount', value: `${formatNumber(selectedTx.amount, 6)} ${selectedTx.assets?.symbol}`, bold: true },
                { label: 'Fee', value: selectedTx.fee > 0 ? formatCurrency(selectedTx.fee) : '—' },
                { label: 'Status', value: selectedTx.status },
                { label: 'Date', value: formatDate(selectedTx.created_at) },
              ].map(row => (
                <div key={row.label} className="flex justify-between py-2.5 border-b border-white/[0.05] last:border-0">
                  <span className="text-sm text-slate-500">{row.label}</span>
                  <span className={`text-sm capitalize ${row.bold ? 'text-white font-bold font-mono' : 'text-slate-200'}`}>{row.value}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedTx(null)} className="btn-secondary w-full py-3 text-sm font-bold">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

function TxIcon({ type, isBinary, large }: { type: string; isBinary?: boolean; large?: boolean }) {
  const size = large ? 18 : 13
  const cls = `${large ? 'w-9 h-9' : 'w-6 h-6'} rounded-lg flex items-center justify-center flex-shrink-0`
  if (isBinary) return (
    <div className={`${cls} ${type === 'trade_buy' ? 'bg-neon-green/10' : 'bg-neon-red/10'}`}>
      {type === 'trade_buy'
        ? <Trophy size={size} className="text-neon-green" />
        : <XCircle size={size} className="text-neon-red" />}
    </div>
  )
  if (type === 'trade_buy')   return <div className={`${cls} bg-neon-green/10`}><TrendingUp size={size} className="text-neon-green" /></div>
  if (type === 'trade_sell')  return <div className={`${cls} bg-neon-red/10`}><TrendingDown size={size} className="text-neon-red" /></div>
  if (type === 'deposit')     return <div className={`${cls} bg-neon-cyan/10`}><ArrowUpRight size={size} className="text-neon-cyan" /></div>
  if (type === 'withdrawal')  return <div className={`${cls} bg-orange-500/10`}><ArrowUpRight size={size} className="text-orange-400 rotate-180" /></div>
  if (type === 'swap')        return <div className={`${cls} bg-purple-500/10`}><ArrowLeftRight size={size} className="text-purple-400" /></div>
  if (type.includes('stak'))  return <div className={`${cls} bg-yellow-500/10`}><Layers size={size} className="text-yellow-400" /></div>
  if (type === 'admin_adjustment') return <div className={`${cls} bg-pink-500/10`}><Zap size={size} className="text-pink-400" /></div>
  return <div className={`${cls} bg-white/5`}><RefreshCw size={size} className="text-slate-500" /></div>
}
