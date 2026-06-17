import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { usePriceStore } from '@/stores/priceStore'
import type { PriceFeed } from '@/types'

export function usePrices() {
  const { prices, setPrices, updatePrice } = usePriceStore()

  const { data, isLoading } = useQuery({
    queryKey: ['price_feeds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_feeds')
        .select('*, assets(*)')
      if (error) throw error
      return data as PriceFeed[]
    },
    staleTime: 30_000,
  })

  useEffect(() => {
    if (data) setPrices(data)
  }, [data])

  // Real-time subscription to price_feeds
  useEffect(() => {
    const channel = supabase
      .channel('price_feeds_realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'price_feeds',
      }, (payload) => {
        updatePrice(payload.new as PriceFeed)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return { prices, isLoading }
}
