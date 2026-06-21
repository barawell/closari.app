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

  const { data: m } = await supabaseAdmin
    .from('tenant_members')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  return { userId: user.id, tenantId: (m?.tenant_id as string) ?? null, role: (m?.role as string) ?? null }
}
