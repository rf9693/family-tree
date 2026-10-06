import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase, Profile } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  isOwner: boolean
  canDelete: (createdBy?: string) => boolean
  canImport: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile(userId: string) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      if (error) console.error('loadProfile error', error)
      setProfile(data)
      setLoading(false)
    }

    function apply(session: Session | null) {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    }

    supabase.auth.getSession().then(({ data: { session } }) => apply(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => apply(session))
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  // The profile row (and its role) is created by the `handle_new_user` trigger in the database.
  async function signUp(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName } }
    })
    return { error }
  }

  async function signOut() { await supabase.auth.signOut() }

  // UI hint only; the database enforces permissions via RLS.
  const isOwner = profile?.role === 'owner'

  const canDelete = (createdBy?: string) => isOwner || (!!user && !!createdBy && createdBy === user.id)

  return (
    <AuthContext.Provider value={{
      user, profile, session, loading, isOwner,
      canDelete, canImport: isOwner,
      signIn, signUp, signOut
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
