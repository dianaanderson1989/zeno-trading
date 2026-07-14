import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  session: any | null
  loading: boolean
  initialized: boolean
  setSession: (session: any) => void
  fetchProfile: (userId: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,

  setSession: (session) => set({ session }),

  fetchProfile: async (userId: string) => {
    // Use maybeSingle so missing profile returns null instead of throwing 406
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (data) {
      set({ user: data as User })
      return
    }

    // Profile missing — auto-repair transparently
    console.warn('[Auth] Profile missing for', userId, '— attempting repair...')
    try {
      const { data: repaired } = await supabase.rpc('repair_user_profile', {
        p_user_id: userId
      })

      if (repaired?.success) {
        console.log('[Auth] Profile repaired:', repaired.action)
        // Fetch again after repair
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle()
        if (profile) set({ user: profile as User })
      } else {
        console.error('[Auth] Profile repair failed:', repaired?.error)
      }
    } catch (e) {
      console.error('[Auth] Repair RPC failed:', e)
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null })
  },
}))
