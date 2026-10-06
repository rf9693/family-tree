import { createClient } from '@supabase/supabase-js'

// The anon key is public by design; data is protected by RLS policies (see supabase/migrations).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ajwoiljtvvdktsytzauu.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqd29pbGp0dnZka3RzeXR6YXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMDY2NTIsImV4cCI6MjA4ODg4MjY1Mn0.SJlS15mfCFNwSpLqx8U5JVT2fPCCcfYNW7pH3Z0Akfo'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export type Profile = {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  role: 'owner' | 'member'
  created_at: string
}

export type DBPerson = {
  id: string
  first_name: string
  last_name: string
  birth_date?: string | null
  death_date?: string | null
  birth_place?: string | null
  gender: string
  notes?: string | null
  privacy: string
  photo_url?: string | null
  x: number
  y: number
  is_me: boolean
  created_by?: string | null
  created_at?: string
  updated_at?: string
}

export type DBRelation = {
  id: string
  type: string
  source_id: string
  target_id: string
  created_by?: string | null
  created_at?: string
}

export type DBHistory = {
  id: string
  user_id: string
  user_name: string
  action: string
  entity_id?: string
  entity_name?: string
  details?: unknown
  created_at: string
}
