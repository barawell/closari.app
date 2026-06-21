import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lazy singleton client browser (anon). RLS yang jaga akses.
let _sb: SupabaseClient | null = null
function sb(): SupabaseClient {
  if (!_sb) {
    _sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return _sb
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop) { return (sb() as any)[prop] },
})
