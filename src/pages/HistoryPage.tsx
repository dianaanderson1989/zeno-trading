import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, TrendingUp, TrendingDown, ArrowUpRight, RefreshCw, Layers, ArrowLeftRight, Trophy, XCircle, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useTransactions } from '@/hooks/useTransactions'
import { formatCurrency, formatNumber, formatDate } from '@/utils/format'

const TX_TYPES = ['all', 'trade_buy', 'trade_sell', 'deposit', 'withdrawal', 'swap', 'stake', 'staking_reward']

export function HistoryPage() {
  const user = useAuthStore(s => s.user)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<any>(null)
  const { data: transactions = [], isLoading } = useTransactions()

  // Binary options history for detail lookup
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

  // Try to match a transaction to a binary trade by description
  const getBinaryDetail = (tx: any) => {
    if (!tx.description?.startsWith('Binary')) return null
    return binaryTrades.find((b: any) =>
      Math.abs(new Date(b.created_at).getTime() - new Date(tx.created_at).getTime()) < 5000
    ) ?? null
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Transaction History</h1>

      <div className="flex flex-wrap gap-2">
        {TX_TYPES.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === t ? 'bg-brand-500 text-white' : 'bg-dark-700 text-gray-400 hover:text-gray-200'
            }`}>
            {t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={selected ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <div className="card overflow-hidden p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-dark-700 rounded-lg animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-12">No transactions found</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-600 text-gray-500 text-xs uppercase">
                    <th className="text-left p-4 font-medium">Type</th>
                    <th className="text-right p-4 font-medium">Amount</th>
                    <th className="text-right p-4 font-medium hidden md:table-cell">Fee</th>
                    <th className="text-left p-4 font-medium hidden lg:table-cell">Description</th>
                    <th className="text-right p-4 font-medium">Status</th>
                    <th className="text-right p-4 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-600">
                  {filtered.map(tx => (
                    <tr
                      key={tx.id}
                      onClick={() => setSelected(selected?.id === tx.id ? null : tx)}
                      className={`cursor-pointer transition-colors ${
                        selected?.id === tx.id ? 'bg-brand-500/10' : 'hover:bg-dark-700/40'
                      }`}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <TxIcon type={tx.transaction_type} />
                          <span className="capitalize text-gray-200 text-xs md:text-sm">
                            {tx.transaction_type.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono text-gray-200 text-xs md:text-sm">
                        {formatNumber(tx.amount, 4)} {tx.assets?.symbol}
                      </td>
                      <td className="p-4 text-right font-mono text-gray-500 text-xs hidden md:table-cell">
                        {tx.fee > 0 ? formatCurrency(tx.fee) : '—'}
                      </td>
                      <td className="p-4 text-gray-400 text-xs hidden lg:table-cell max-w-[180px] truncate">
                        {tx.description || '—'}
                      </td>
                      <td className="p-4 text-right">
                        <span className={`badge text-xs ${
                          tx.status === 'completed' ? 'bg-brand-500/15 text-brand-400' :
                          tx.status === 'pending' ? 'bg-yellow-500/15 text-yellow-400' :
                          'bg-red-500/15 text-red-400'
                        }`}>{tx.status}</span>
                      </td>
                      <td className="p-4 text-right text-gray-500 text-xs whitespace-nowrap">
                        {formatDate(tx.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="lg:col-span-1">
            <div className="card sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Transaction Detail</h3>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <TxIcon type={selected.transaction_type} large />
                <div>
                  <p className="text-gray-200 font-medium capitalize">{selected.transaction_type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-500">{selected.assets?.name}</p>
                </div>
              </div>

              <div className="space-y-3">
                <DetailRow label="Amount" value={`${formatNumber(selected.amount, 6)} ${selected.assets?.symbol}`} highlight />
                {selected.fee > 0 && <DetailRow label="Fee" value={formatCurrency(selected.fee)} />}
                <DetailRow label="Status" value={selected.status} badge
                  badgeColor={selected.status === 'completed' ? 'bg-brand-500/15 text-brand-400' : 'bg-yellow-500/15 text-yellow-400'} />
                <DetailRow label="Date" value={formatDate(selected.created_at)} />
                {selected.description && <DetailRow label="Description" value={selected.description} small />}

                {/* Binary trade detail */}
                {selected.description?.startsWith('Binary') && (() => {
                  const bt = getBinaryDetail(selected)
                  if (!bt) return null
                  const pnl = bt.outcome === 'win'
                    ? bt.payout_amount - bt.stake_amount
                    : -bt.stake_amount
                  return (
                    <div className="border-t border-dark-600 pt-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Binary Options Detail</p>
                      <DetailRow label="Direction" value={bt.direction === 'up' ? '▲ UP' : '▼ DOWN'}
                        color={bt.direction === 'up' ? 'text-brand-400' : 'text-red-400'} />
                      <DetailRow label="Stake" value={formatCurrency(bt.stake_amount)} />
                      <DetailRow label="Duration" value={bt.duration_seconds === 86400 ? '1 Day' : bt.duration_seconds + 's'} />
                      <DetailRow label="Payout %" value={`${bt.total_payout_percent}%${bt.high_roller_bonus > 0 ? ` (+${bt.high_roller_bonus}% bonus)` : ''}`} />
                      <DetailRow label="Entry Price" value={formatCurrency(bt.entry_price)} />
                      {bt.exit_price && <DetailRow label="Exit Price" value={formatCurrency(bt.exit_price)} />}
                      <DetailRow label="Entry Time" value={formatDate(bt.entry_time)} small />
                      {bt.exit_time && <DetailRow label="Exit Time" value={formatDate(bt.exit_time)} small />}
                      <div className="flex items-center justify-between pt-2 border-t border-dark-600">
                        <span className="text-xs text-gray-400">Outcome</span>
                        {bt.outcome === 'win'
                          ? <span className="flex items-center gap-1 text-brand-400 font-bold"><Trophy size={13} /> WIN</span>
                          : <span className="flex items-center gap-1 text-red-400 font-bold"><XCircle size={13} /> LOSE</span>}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">P&L</span>
                        <span className={`font-mono font-bold ${pnl >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                          {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                        </span>
                      </div>
                      {bt.outcome === 'win' && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Total Payout</span>
                          <span className="font-mono text-brand-400 font-bold">{formatCurrency(bt.payout_amount)}</span>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, value, highlight, badge, badgeColor, small, color }: {
  label: string; value: string; highlight?: boolean; badge?: boolean
  badgeColor?: string; small?: boolean; color?: string
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      {badge
        ? <span className={`badge text-xs ${badgeColor}`}>{value}</span>
        : <span className={`text-right ${small ? 'text-xs' : 'text-sm'} ${highlight ? 'text-white font-semibold font-mono' : color ?? 'text-gray-300'}`}>
            {value}
          </span>}
    </div>
  )
}

function TxIcon({ type, large }: { type: string; large?: boolean }) {
  const size = large ? 18 : 13
  const cls = `${large ? 'w-9 h-9' : 'w-6 h-6'} rounded-full flex items-center justify-center flex-shrink-0`
  if (type === 'trade_buy')      return <div className={`${cls} bg-brand-500/15 text-brand-400`}><TrendingUp size={size} /></div>
  if (type === 'trade_sell')     return <div className={`${cls} bg-red-500/15 text-red-400`}><TrendingDown size={size} /></div>
  if (type === 'deposit')        return <div className={`${cls} bg-blue-500/15 text-blue-400`}><ArrowUpRight size={size} /></div>
  if (type === 'withdrawal')     return <div className={`${cls} bg-orange-500/15 text-orange-400`}><ArrowUpRight size={size} className="rotate-180" /></div>
  if (type === 'swap')           return <div className={`${cls} bg-purple-500/15 text-purple-400`}><ArrowLeftRight size={size} /></div>
  if (type.includes('stak'))     return <div className={`${cls} bg-yellow-500/15 text-yellow-400`}><Layers size={size} /></div>
  if (type === 'admin_adjustment') return <div className={`${cls} bg-pink-500/15 text-pink-400`}><Zap size={size} /></div>
  return <div className={`${cls} bg-gray-500/15 text-gray-400`}><RefreshCw size={size} /></div>
}
