import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  is_read: boolean
  metadata: Record<string, any>
  created_at: string
}

export function useNotifications(limit?: number) {
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['notifications', user?.id, limit],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (limit) q = q.limit(limit)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Notification[]
    },
    staleTime: 0,
    refetchInterval: 30_000,
  })

  const unreadCount = query.data?.filter(n => !n.is_read).length ?? 0

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const markAllRead = async () => {
    if (!user) return
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  return { ...query, unreadCount, markRead, markAllRead }
}
