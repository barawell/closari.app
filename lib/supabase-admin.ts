import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lazy singleton — client baru dibuat saat PERTAMA dipakai (bukan saat import),
// biar `next build` (collect page data tanpa env) gak error "supabaseUrl is required".
let _admin: SupabaseClient | null = null
function admin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  }
  return _admin
}

// Proxy: akses .from()/.storage/dll men-trigger pembuatan client di runtime.
// HANYA dipakai di server (bypass RLS) — jangan di-import ke komponen client.
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop) { return (admin() as any)[prop] },
})
