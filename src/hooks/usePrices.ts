import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { usePriceStore } from '@/stores/priceStore'
import type { PriceFeed } from '@/types'

// 🔥 GLOBAL STATE – lives outside React, shared across ALL components
let globalChannel: any = null
let isGlobalSubscribed = false

export function usePrices() {
  const { prices, setPrices, updatePrice } = usePriceStore()
  const [isLoading, setIsLoading] = useState(true)

  const { data, isLoading: queryLoading } = useQuery({
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
    if (data) {
      setPrices(data)
      setIsLoading(false)
    }
  }, [data])

  // Set up realtime channel ONCE globally — not per component
  useEffect(() => {
    if (!globalChannel) {
      globalChannel = supabase
        .channel('price_feeds_realtime')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'price_feeds' },
          (payload) => {
            updatePrice(payload.new as PriceFeed)
          }
        )
    }

    if (!isGlobalSubscribed) {
      globalChannel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          isGlobalSubscribed = true
        }
      })
    }

    // Intentionally NO cleanup — channel stays alive for all components
    return () => {}
  }, [])

  return { prices, isLoading: isLoading || queryLoading }
}
