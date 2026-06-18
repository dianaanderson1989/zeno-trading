import { useState } from 'react'
import { useTransactions } from '@/hooks/useTransactions'
import { formatCurrency, formatNumber, formatDate } from '@/utils/format'
import { TrendingUp, TrendingDown, ArrowUpRight, RefreshCw, Layers, ArrowLeftRight } from 'lucide-react'

const TX_TYPES = ['all', 'trade_buy', 'trade_sell', 'deposit', 'withdrawal', 'swap', 'stake', 'staking_reward']

export function HistoryPage() {
  const [filter, setFilter] = useState('all')
  const { data: transactions = [], isLoading } = useTransactions()

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.transaction_type === filter)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Transaction History</h1>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {TX_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === t
                ? 'bg-brand-500 text-white'
                : 'bg-dark-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

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
                <th className="text-left p-4 font-medium hidden md:table-cell">Description</th>
                <th className="text-right p-4 font-medium">Status</th>
                <th className="text-right p-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-600">
              {filtered.map(tx => (
                <tr key={tx.id} className="hover:bg-dark-700/40 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <TxIcon type={tx.transaction_type} />
                      <span className="capitalize text-gray-200">{tx.transaction_type.replace(/_/g, ' ')}</span>
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono text-gray-200">
                    {formatNumber(tx.amount, 4)} {tx.assets?.symbol}
                  </td>
                  <td className="p-4 text-right font-mono text-gray-500 hidden md:table-cell">
                    {tx.fee > 0 ? formatCurrency(tx.fee) : '—'}
                  </td>
                  <td className="p-4 text-gray-400 text-xs hidden md:table-cell max-w-xs truncate">
                    {tx.description || '—'}
                  </td>
                  <td className="p-4 text-right">
                    <span className={`badge ${tx.status === 'completed' ? 'bg-brand-500/15 text-brand-400' : tx.status === 'pending' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="p-4 text-right text-gray-500 text-xs whitespace-nowrap">{formatDate(tx.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function TxIcon({ type }: { type: string }) {
  const cls = 'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0'
  if (type === 'trade_buy') return <div className={`${cls} bg-brand-500/15 text-brand-400`}><TrendingUp size={12} /></div>
  if (type === 'trade_sell') return <div className={`${cls} bg-red-500/15 text-red-400`}><TrendingDown size={12} /></div>
  if (type === 'deposit') return <div className={`${cls} bg-blue-500/15 text-blue-400`}><ArrowUpRight size={12} /></div>
  if (type === 'withdrawal') return <div className={`${cls} bg-orange-500/15 text-orange-400`}><ArrowUpRight size={12} className="rotate-180" /></div>
  if (type === 'swap') return <div className={`${cls} bg-purple-500/15 text-purple-400`}><ArrowLeftRight size={12} /></div>
  if (type.includes('stak')) return <div className={`${cls} bg-yellow-500/15 text-yellow-400`}><Layers size={12} /></div>
  return <div className={`${cls} bg-gray-500/15 text-gray-400`}><RefreshCw size={12} /></div>
}
