import { createClient } from '@supabase/supabase-js'
import { supabaseAnonKey, supabaseUrl } from '../env'

// Guard the module-scope client: a Vercel/CI build without the VITE_SUPABASE_*
// env vars would otherwise throw at import time and blank the whole app
// (createClient throws on undefined). With a placeholder fallback the app
// boots; only Supabase-backed auth fails at request time (handled in AuthProvider).
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

export const supabaseClient = createClient(
  hasSupabaseConfig ? supabaseUrl : 'https://placeholder.supabase.co',
  hasSupabaseConfig ? supabaseAnonKey : 'placeholder',
  {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
    },
  },
)
