import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
const ADMIN_ROLES = ['admin', 'owner']

// PATCH /api/team/[id]  body { role }  → ubah role anggota (id = user_id)
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!ADMIN_ROLES.includes(actor.role || '')) return NextResponse.json({ error: 'Hanya admin.' }, { status: 403 })

  const { id } = await ctx.params
  const b = await req.json().catch(() => ({}))
  const role = ['admin', 'agent', 'owner'].includes(b.role) ? b.role : null
  if (!role) return NextResponse.json({ error: 'role tidak valid' }, { status: 400 })
  if (id === actor.userId) return NextResponse.json({ error: 'Tidak bisa ubah role sendiri.' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('tenant_members').update({ role })
    .eq('tenant_id', actor.tenantId).eq('user_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/team/[id]?type=member|invite  → keluarkan anggota / batalkan undangan
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!ADMIN_ROLES.includes(actor.role || '')) return NextResponse.json({ error: 'Hanya admin.' }, { status: 403 })

  const { id } = await ctx.params
  const type = new URL(req.url).searchParams.get('type') || 'member'

  if (type === 'invite') {
    const { error } = await supabaseAdmin.from('tenant_invites').delete().eq('id', id).eq('tenant_id', actor.tenantId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (id === actor.userId) return NextResponse.json({ error: 'Tidak bisa keluarkan diri sendiri.' }, { status: 400 })
  const { error } = await supabaseAdmin
    .from('tenant_members').delete().eq('tenant_id', actor.tenantId).eq('user_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
