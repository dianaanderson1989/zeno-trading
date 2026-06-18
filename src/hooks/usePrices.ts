import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { usePriceStore } from '@/stores/priceStore'
import type { PriceFeed } from '@/types'

// 🔥 GLOBAL STATE – This lives outside React, so it's shared across ALL components
let globalChannel: any = null
let isGlobalSubscribed = false

export function usePrices() {
  const { prices, setPrices, updatePrice } = usePriceStore()
  const [isLoading, setIsLoading] = useState(true)

  // 1. Fetch initial data (this runs once per component, but React Query caches it)
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

  // 2. Set up the REAL TIME channel – but ONLY ONCE globally
  useEffect(() => {
    // ✅ If the global channel doesn't exist, create it
    if (!globalChannel) {
      console.log('🔧 Creating global price channel...')

      const channel = supabase
        .channel('price_feeds_realtime')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'price_feeds' },
          (payload) => {
            updatePrice(payload.new as PriceFeed)
          }
        )

      globalChannel = channel
    }

    // ✅ If it's not subscribed yet, subscribe NOW (once)
    if (!isGlobalSubscribed) {
      globalChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Global price channel subscribed')
          isGlobalSubscribed = true
        }
      })
    }

    // ✅ Cleanup: We DO NOT remove the channel on unmount,
    // because other components are still using it.
    // The channel lives for the entire lifecycle of the app.
    return () => {
      // We intentionally do NOT remove the channel here.
      // It stays alive for all components.
    }
  }, []) // Empty array = runs ONCE, when the FIRST component using this hook mounts

  return { prices, isLoading: isLoading || queryLoading }
}