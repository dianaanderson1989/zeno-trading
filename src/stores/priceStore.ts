import { create } from 'zustand'
import type { PriceFeed } from '@/types'

interface PriceState {
  prices: Record<string, PriceFeed>  // keyed by asset_id
  setPrices: (feeds: PriceFeed[]) => void
  updatePrice: (feed: PriceFeed) => void
}

export const usePriceStore = create<PriceState>((set) => ({
  prices: {},

  setPrices: (feeds) => {
    const map: Record<string, PriceFeed> = {}
    feeds.forEach(f => { map[f.asset_id] = f })
    set({ prices: map })
  },

  updatePrice: (feed) => set((state) => ({
    prices: { ...state.prices, [feed.asset_id]: feed }
  })),
}))
