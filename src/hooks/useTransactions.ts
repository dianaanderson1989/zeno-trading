import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Transaction } from '@/types'

export function useTransactions(limit?: number) {
  const user = useAuthStore(s => s.user)

  return useQuery({
    queryKey: ['transactions', user?.id, limit],
    enabled: !!user?.id,
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select('*, assets(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })

      if (limit) query = query.limit(limit)

      const { data, error } = await query
      if (error) throw error
      return data as Transaction[]
    },
    staleTime: 15_000,
  })
}
