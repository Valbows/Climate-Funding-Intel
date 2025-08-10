import { createClient } from '@supabase/supabase-js'

// Server-only Supabase client using the service role key.
// WARNING: Do not expose this key to the client. This module must only be used in server code (API routes).
export function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  })
}
