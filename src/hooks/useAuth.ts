import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const { user, session, loading, initialized, fetchProfile, setSession } = useAuthStore()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => {
          useAuthStore.setState({ loading: false, initialized: true })
        })
      } else {
        useAuthStore.setState({ loading: false, initialized: true })
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        useAuthStore.setState({ user: null })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, session, loading, initialized }
}
