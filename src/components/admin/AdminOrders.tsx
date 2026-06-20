import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { formatDate, formatNumber, formatCurrency } from '@/utils/format'
import { useState } from 'react'

export function AdminOrders() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('all')

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin_orders', filter],
    queryFn: async () => {
      let q = supabase.from('orders')
        .select('*, base_asset:assets!orders_base_asset_id_fkey(*), quote_asset:assets!orders_quote_asset_id_fkey(*), users(email, first_name)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (filter !== 'all') q = q.eq('status', filter)
      const { data } = await q
      return data ?? []
    },
    staleTime: 15_000,
  })

  const cancel = async (orderId: string) => {
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    queryClient.invalidateQueries({ queryKey: ['admin_orders'] })
  }

  const statusColors: Record<string, string> = {
    filled: 'bg-brand-500/15 text-brand-400',
    pending: 'bg-yellow-500/15 text-yellow-400',
    cancelled: 'bg-gray-500/15 text-gray-400',
    rejected: 'bg-red-500/15 text-red-400',
    partial: 'bg-blue-500/15 text-blue-400',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Orders</h1>
        <div className="flex gap-2">
          {['all', 'pending', 'filled', 'cancelled'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter === f ? 'bg-brand-500 text-white' : 'bg-dark-700 text-gray-400 hover:text-gray-200'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-dark-700 rounded animate-pulse" />)}</div>
        ) : orders.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No orders found</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-600 text-gray-500 text-xs uppercase">
                <th className="text-left p-4 font-medium">User</th>
                <th className="text-left p-4 font-medium">Pair</th>
                <th className="text-left p-4 font-medium">Type</th>
                <th className="text-right p-4 font-medium">Qty</th>
                <th className="text-right p-4 font-medium">Price</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-right p-4 font-medium">Date</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-600">
              {orders.map((o: any) => (
                <tr key={o.id} className="hover:bg-dark-700/40">
                  <td className="p-4 text-xs text-gray-400">{o.users?.first_name || o.users?.email}</td>
                  <td className="p-4">
                    <span className={`font-medium ${o.side === 'buy' ? 'text-brand-400' : 'text-red-400'}`}>{o.side.toUpperCase()}</span>
                    <span className="text-gray-500 ml-1 text-xs">{o.base_asset?.symbol}/USDT</span>
                  </td>
                  <td className="p-4 text-gray-400 capitalize">{o.order_type}</td>
                  <td className="p-4 text-right font-mono text-gray-200">{formatNumber(o.quantity, 4)}</td>
                  <td className="p-4 text-right font-mono text-gray-200">{o.average_price ? formatCurrency(o.average_price) : o.price ? formatCurrency(o.price) : '—'}</td>
                  <td className="p-4"><span className={`badge ${statusColors[o.status] ?? 'bg-gray-500/15 text-gray-400'}`}>{o.status}</span></td>
                  <td className="p-4 text-right text-xs text-gray-500">{formatDate(o.created_at)}</td>
                  <td className="p-4">
                    {o.status === 'pending' && (
                      <button onClick={() => cancel(o.id)} className="text-xs text-red-400 hover:text-red-300">Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
