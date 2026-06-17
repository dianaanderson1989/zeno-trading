import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Wallet } from '@/types'

export function useWallets() {
  const user = useAuthStore(s => s.user)

  return useQuery({
    queryKey: ['wallets', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallets')
        .select('*, assets(*)')
        .eq('user_id', user!.id)
        .order('balance', { ascending: false })
      if (error) throw error
      return data as Wallet[]
    },
    staleTime: 10_000,
  })
}
