import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ajwoiljtvvdktsytzauu.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqd29pbGp0dnZka3RzeXR6YXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMDY2NTIsImV4cCI6MjA4ODg4MjY1Mn0.SJlS15mfCFNwSpLqx8U5JVT2fPCCcfYNW7pH3Z0Akfo'

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
  birth_date?: string
  death_date?: string
  birth_place?: string
  gender: string
  notes?: string
  privacy: string
  photo_url?: string
  x: number
  y: number
  is_me: boolean
  created_by?: string
  created_at?: string
  updated_at?: string
}

export type DBRelation = {
  id: string
  type: string
  source_id: string
  target_id: string
  created_by?: string
  created_at?: string
}

export type DBHistory = {
  id: string
  user_id: string
  user_name: string
  action: string
  entity_id?: string
  entity_name?: string
  details?: any
  created_at: string
}
