import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './supabase-admin'

export type Actor = { userId: string; tenantId: string | null; role: string | null }

// Validasi Bearer token (JWT Supabase) → user → tenant aktif.
// Tenant aktif diambil dari header 'x-tenant-id' (tenant switcher), DIVALIDASI
// bahwa user benar-benar member. Kalau tidak ada/invalid → membership pertama.
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

  // 1) Tenant yang diminta client (workspace yang sedang dibuka)
  const wanted = (req.headers.get('x-tenant-id') || '').trim()
  if (wanted) {
    const { data: m } = await supabaseAdmin
      .from('tenant_members').select('tenant_id, role')
      .eq('user_id', user.id).eq('tenant_id', wanted).maybeSingle()
    if (m) return { userId: user.id, tenantId: m.tenant_id as string, role: (m.role as string) ?? null }
    // bukan member tenant itu → jangan pakai, lanjut fallback
  }

  // 2) Fallback deterministik: membership paling awal
  const { data: rows } = await supabaseAdmin
    .from('tenant_members')
    .select('tenant_id, role, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)

  const first = rows?.[0]
  return { userId: user.id, tenantId: (first?.tenant_id as string) ?? null, role: (first?.role as string) ?? null }
}
