import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './supabase-admin'

export type Actor = { userId: string; tenantId: string | null; role: string | null }

// Validasi Bearer token (JWT Supabase) → user → tenant. Dipakai semua API route.
export async function getActor(req: Request): Promise<Actor | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
  const { data: { user } } = await anon.auth.getUser(token)
  if (!user) return null

  // DETERMINISTIK: kalau user kebetulan member >1 tenant, jangan ambil acak.
  // Urutkan by created_at (membership paling awal = workspace utama),
  // jadi /api/me dan semua query inbox SELALU pakai tenant yang sama.
  const { data: rows } = await supabaseAdmin
    .from('tenant_members')
    .select('tenant_id, role, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)

  const m = rows?.[0]
  return { userId: user.id, tenantId: (m?.tenant_id as string) ?? null, role: (m?.role as string) ?? null }
}
