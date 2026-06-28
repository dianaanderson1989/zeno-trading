import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// Use CoinGecko v3 — this endpoint is CORS-enabled for browsers
const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price' +
  '?ids=bitcoin,ethereum,binancecoin,solana,cardano,polkadot,ripple,tether' +
  '&vs_currencies=usd' +
  '&include_24hr_change=true' +
  '&include_24hr_vol=true' +
  '&include_24h_high_low=true'

// Fallback: use a public proxy if CoinGecko blocks
const PROXY_URL =
  'https://api.coingecko.com/api/v3/simple/price' +
  '?ids=bitcoin,ethereum,binancecoin,solana,cardano,polkadot,ripple,tether' +
  '&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_24h_high_low=true'

const ID_TO_SYMBOL: Record<string, string> = {
  bitcoin:     'BTC',
  ethereum:    'ETH',
  binancecoin: 'BNB',
  solana:      'SOL',
  cardano:     'ADA',
  polkadot:    'DOT',
  ripple:      'XRP',
  tether:      'USDT',
}

const POLL_MS = 30_000

export function usePriceUpdater() {
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeRef = useRef(false)

  const fetchAndUpdate = async () => {
    if (activeRef.current) return
    activeRef.current = true

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 12_000)

      const res = await fetch(COINGECKO_URL, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
      clearTimeout(timeout)

      if (!res.ok) {
        console.warn(`[Prices] CoinGecko HTTP ${res.status}`)
        return
      }

      const json = await res.json()
      console.log('[Prices] Fetched:', Object.keys(json).length, 'coins')

      // Get all asset IDs from DB
      const { data: assets, error: assetsErr } = await supabase
        .from('assets')
        .select('id, symbol')

      if (assetsErr || !assets) {
        console.warn('[Prices] Could not fetch assets:', assetsErr?.message)
        return
      }

      const symbolToAssetId: Record<string, string> = {}
      assets.forEach(a => { symbolToAssetId[a.symbol] = a.id })

      // Build rows to upsert
      const rows: any[] = []
      for (const [cgId, vals] of Object.entries(json) as [string, any][]) {
        const symbol  = ID_TO_SYMBOL[cgId]
        const assetId = symbol ? symbolToAssetId[symbol] : undefined
        if (!assetId || !vals.usd) continue

        rows.push({
          asset_id:   assetId,
          price:      vals.usd,
          change_24h: vals.usd_24h_change ?? 0,
          volume_24h: vals.usd_24h_vol    ?? 0,
          high_24h:   vals.usd_24h_high   ?? 0,
          low_24h:    vals.usd_24h_low    ?? 0,
          updated_at: new Date().toISOString(),
        })
      }

      if (rows.length === 0) {
        console.warn('[Prices] No rows to upsert')
        return
      }

      const { error: upsertErr } = await supabase
        .from('price_feeds')
        .upsert(rows, { onConflict: 'asset_id' })

      if (upsertErr) {
        console.error('[Prices] Upsert failed:', upsertErr.message, '— check price_feeds RLS policies')
      } else {
        console.log(`[Prices] ✅ Updated ${rows.length} prices —`, new Date().toLocaleTimeString())
      }

    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.warn('[Prices] Request timed out')
      } else {
        console.warn('[Prices] Fetch error:', e.message)
      }
    } finally {
      activeRef.current = false
    }
  }

  useEffect(() => {
    fetchAndUpdate()
    timerRef.current = setInterval(fetchAndUpdate, POLL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])
}
