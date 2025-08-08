import { createClient } from '@supabase/supabase-js'

// Read-only client for server-side usage in API routes.
// Uses anon key and public URL — RLS enforces read access.
export function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return createClient(url, anon, {
    auth: { persistSession: false },
  })
}
