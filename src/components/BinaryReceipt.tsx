import { X, Trophy, XCircle, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/format'

interface BinaryReceiptProps {
  trade: any
  onClose: () => void
}

export function BinaryReceipt({ trade, onClose }: BinaryReceiptProps) {
  const isWin = trade.outcome === 'win'
  const pnl = isWin
    ? (trade.payout_amount - trade.stake_amount)
    : -trade.stake_amount

  const durationLabel =
    trade.duration_seconds === 86400 ? '1 Day' :
    trade.duration_seconds === 120   ? '120s' :
    trade.duration_seconds === 90    ? '90s' :
    trade.duration_seconds === 60    ? '60s' : '30s'

  const directionLabel = trade.direction === 'up' ? 'Buy Long' : 'Sell Short'

  const rows = [
    { label: 'Product',              value: `${trade.assets?.symbol ?? '—'} / USDT` },
    { label: 'Direction',            value: directionLabel, dir: trade.direction },
    { label: 'Transaction Period',   value: durationLabel },
    { label: 'Open Position Time',   value: formatDate(trade.entry_time) },
    { label: 'Time to Close',        value: trade.exit_time ? formatDate(trade.exit_time) : '—' },
    { label: 'Open Price',           value: formatCurrency(trade.entry_price) },
    { label: 'Close Price',          value: trade.exit_price ? formatCurrency(trade.exit_price) : '—' },
    { label: 'Amount',               value: formatCurrency(trade.stake_amount) },
    { label: 'Profit / Loss',        value: (pnl >= 0 ? '+' : '') + formatCurrency(pnl), pnl: true, positive: pnl >= 0 },
    { label: 'Handling Fee',         value: formatCurrency(trade.stake_amount * 0.001) },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-16 sm:pt-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div className="w-full max-w-sm rounded-2xl overflow-hidden animate-slide-up"
        style={{ background: '#0d1424', border: '1px solid rgba(255,255,255,0.08)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-base font-black text-white">Trading</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] text-slate-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Outcome badge */}
        <div className={`mx-5 mt-4 mb-2 flex items-center justify-center gap-2 py-3 rounded-2xl ${
          isWin ? 'bg-neon-green/10 border border-neon-green/20' : 'bg-neon-red/10 border border-neon-red/20'
        }`}>
          {isWin
            ? <Trophy size={18} className="text-neon-green" />
            : <XCircle size={18} className="text-neon-red" />}
          <span className={`text-base font-black ${isWin ? 'text-neon-green' : 'text-neon-red'}`}>
            {isWin ? 'Trade Won!' : 'Trade Lost'}
          </span>
          {trade.direction === 'up'
            ? <TrendingUp size={16} className="text-neon-green ml-1" />
            : <TrendingDown size={16} className="text-neon-red ml-1" />}
        </div>

        {/* Receipt rows */}
        <div className="px-5 pb-6 space-y-0">
          {rows.map((row, i) => (
            <div key={row.label}
              className={`flex items-center justify-between py-3.5 ${
                i < rows.length - 1 ? 'border-b border-white/[0.05]' : ''
              }`}>
              <span className="text-sm text-slate-500">{row.label}</span>
              <span className={`text-sm font-semibold ${
                row.pnl
                  ? row.positive ? 'text-neon-green' : 'text-neon-red'
                  : row.dir
                  ? row.dir === 'up' ? 'text-neon-green' : 'text-neon-red'
                  : 'text-slate-200'
              }`}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Close button */}
        <div className="px-5 pb-8 pt-2">
          <button onClick={onClose}
            className="w-full py-3.5 rounded-2xl text-sm font-black transition-all"
            style={{ background: 'linear-gradient(135deg, #00ff88, #00cc6a)', color: '#050810' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
