import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, Profile } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  isOwner: boolean
  canEdit: (createdBy?: string) => boolean
  canDelete: (createdBy?: string) => boolean
  canAddPerson: () => boolean
  canAddRelation: () => boolean
  canExport: () => boolean
  canImport: () => boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session); setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data); setLoading(false)
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const OWNER_EMAIL = 'rf9339945@gmail.com';

  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName } }
    })
    if (!error && data.user) {
      // Жестко задаем владельца
      const role = email === OWNER_EMAIL ? 'owner' : 'member';
      setTimeout(async () => {
        await supabase.from('profiles').update({ role }).eq('id', data.user!.id)
      }, 1500)
    }
    return { error }
  }

  async function signOut() { await supabase.auth.signOut() }

  const isOwner = profile?.role === 'owner' || user?.email === OWNER_EMAIL;

  // Владелец может редактировать всё. Участник — только своё (или новое, где createdBy не задан)
  const canEdit = (createdBy?: string) => {
    if (isOwner) return true
    if (!user) return false // Неавторизованные не могут редактировать
    if (!createdBy) return true // новый объект
    return createdBy === user?.id
  }

  // Владелец удаляет всё. Участник — только своё
  const canDelete = (createdBy?: string) => {
    if (isOwner) return true
    if (!user) return false // Неавторизованные не могут удалять
    if (!createdBy) return false
    return createdBy === user?.id
  }

  // Ограничения для не-владельцев
  const canAddPerson = () => isOwner || !!user
  const canAddRelation = () => isOwner || !!user
  const canExport = () => isOwner
  const canImport = () => isOwner

  return (
    <AuthContext.Provider value={{ 
      user, profile, session, loading, isOwner, 
      canEdit, canDelete, canAddPerson, canAddRelation, canExport, canImport,
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
