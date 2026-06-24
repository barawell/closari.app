import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
const ADMIN_ROLES = ['admin', 'owner']

// GET: daftar anggota + undangan pending di tenant aktif
export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: members } = await supabaseAdmin
    .from('tenant_members')
    .select('user_id, email, role, display_name, created_at')
    .eq('tenant_id', actor.tenantId)
    .order('created_at', { ascending: true })

  const { data: invites } = await supabaseAdmin
    .from('tenant_invites')
    .select('id, email, role, created_at')
    .eq('tenant_id', actor.tenantId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    members: members || [],
    invites: invites || [],
    me: { userId: actor.userId, role: actor.role },
    can_manage: ADMIN_ROLES.includes(actor.role || ''),
  })
}

// POST: undang anggota baru (admin only). body { email, role }
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!ADMIN_ROLES.includes(actor.role || '')) return NextResponse.json({ error: 'Hanya admin yang bisa mengundang.' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const email = String(b.email || '').trim().toLowerCase()
  const role = ['admin', 'agent'].includes(b.role) ? b.role : 'agent'
  if (!email || !email.includes('@')) return NextResponse.json({ error: 'Email tidak valid.' }, { status: 400 })

  // Sudah jadi anggota?
  const { data: already } = await supabaseAdmin
    .from('tenant_members').select('user_id').eq('tenant_id', actor.tenantId).eq('email', email).maybeSingle()
  if (already) return NextResponse.json({ error: 'Email ini sudah jadi anggota.' }, { status: 409 })

  // Upsert undangan (kalau sudah ada yg pending, update role-nya)
  const { error } = await supabaseAdmin
    .from('tenant_invites')
    .upsert(
      { tenant_id: actor.tenantId, email, role, invited_by: actor.userId, accepted_at: null },
      { onConflict: 'tenant_id,email' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, email, role, note: 'Undangan dibuat. Orang ini otomatis gabung saat login dengan email tsb.' })
}
