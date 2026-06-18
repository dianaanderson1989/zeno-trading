import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const COINGECKO_IDS = 'bitcoin,ethereum,binancecoin,solana,cardano,polkadot,ripple,tether'
const POLL_INTERVAL = 60_000 // 1 minute (CoinGecko free tier limit)

export function usePriceUpdater() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAndUpdate = async () => {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_IDS}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_24h_high=true&include_24h_low=true`
      )
      if (!res.ok) return
      const data = await res.json()

      // Map coingecko_id -> price data
      const updates = [
        { coingecko_id: 'bitcoin', ...data.bitcoin },
        { coingecko_id: 'ethereum', ...data.ethereum },
        { coingecko_id: 'binancecoin', ...data.binancecoin },
        { coingecko_id: 'solana', ...data.solana },
        { coingecko_id: 'cardano', ...data.cardano },
        { coingecko_id: 'polkadot', ...data.polkadot },
        { coingecko_id: 'ripple', ...data.ripple },
        { coingecko_id: 'tether', ...data.tether },
      ]

      for (const u of updates) {
        if (!u.usd) continue
        // Get asset id
        const { data: asset } = await supabase
          .from('assets')
          .select('id')
          .eq('coingecko_id', u.coingecko_id)
          .single()

        if (!asset) continue

        await supabase
          .from('price_feeds')
          .update({
            price: u.usd,
            change_24h: u.usd_24h_change ?? 0,
            volume_24h: u.usd_24h_vol ?? 0,
            high_24h: u.usd_24h_high ?? 0,
            low_24h: u.usd_24h_low ?? 0,
            updated_at: new Date().toISOString(),
          })
          .eq('asset_id', asset.id)
      }
    } catch (e) {
      // Silently fail — stale prices are fine
      console.warn('Price update failed:', e)
    }
  }

  useEffect(() => {
    fetchAndUpdate()
    timerRef.current = setInterval(fetchAndUpdate, POLL_INTERVAL)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])
}
