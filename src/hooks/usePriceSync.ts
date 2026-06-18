import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { usePriceStore } from '@/stores/priceStore'

const COINGECKO_IDS = 'bitcoin,ethereum,binancecoin,solana,cardano,polkadot,ripple,tether'
const POLL_INTERVAL = 60_000 // 60 seconds (CoinGecko free tier limit)

export function usePriceSync() {
  const { setPrices } = usePriceStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const syncPrices = async () => {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINGECKO_IDS}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h`
      )
      if (!res.ok) return
      const coins = await res.json()

      // Fetch current asset mapping from DB
      const { data: assets } = await supabase.from('assets').select('id, coingecko_id')
      if (!assets) return

      const assetMap = Object.fromEntries(assets.map(a => [a.coingecko_id, a.id]))

      const updates = coins
        .filter((c: any) => assetMap[c.id])
        .map((c: any) => ({
          asset_id: assetMap[c.id],
          price: c.current_price ?? 0,
          change_24h: c.price_change_percentage_24h ?? 0,
          volume_24h: c.total_volume ?? 0,
          high_24h: c.high_24h ?? 0,
          low_24h: c.low_24h ?? 0,
          updated_at: new Date().toISOString(),
        }))

      if (updates.length > 0) {
        await supabase.from('price_feeds').upsert(updates, { onConflict: 'asset_id' })
        // Also update local store directly so UI is instant
        const { data: feeds } = await supabase.from('price_feeds').select('*, assets(*)')
        if (feeds) setPrices(feeds as any)
      }
    } catch (err) {
      console.warn('Price sync failed:', err)
    }
  }

  useEffect(() => {
    syncPrices()
    timerRef.current = setInterval(syncPrices, POLL_INTERVAL)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])
}
