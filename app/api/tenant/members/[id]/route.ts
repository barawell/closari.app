import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// DELETE — remove member dari workspace
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: 'hanya admin' }, { status: 403 })

  const { id } = await ctx.params  // id = user_id

  // Cek member yang mau dihapus
  const { data: target } = await supabaseAdmin
    .from('tenant_members')
    .select('user_id, role, tenant_id')
    .eq('user_id', id)
    .eq('tenant_id', actor.tenantId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: 'member tidak ditemukan' }, { status: 404 })
  }

  // Jangan biarin admin terakhir menghapus dirinya sendiri
  if (target.user_id === actor.userId) {
    const { count } = await supabaseAdmin
      .from('tenant_members')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', actor.tenantId)
      .eq('role', 'admin')

    if ((count || 0) <= 1) {
      return NextResponse.json({ error: 'Tidak bisa keluar — kamu satu-satunya admin. Promote member lain dulu jadi admin atau hapus workspace.' }, { status: 400 })
    }
  }

  const { error } = await supabaseAdmin
    .from('tenant_members')
    .delete()
    .eq('user_id', id)
    .eq('tenant_id', actor.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// PUT — update role member
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: 'hanya admin' }, { status: 403 })

  const { id } = await ctx.params  // id = user_id
  const b = await req.json().catch(() => ({}))
  const newRole = b.role === 'admin' ? 'admin' : 'agent'

  const { data: target } = await supabaseAdmin
    .from('tenant_members')
    .select('user_id, role, tenant_id')
    .eq('user_id', id)
    .eq('tenant_id', actor.tenantId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: 'member tidak ditemukan' }, { status: 404 })
  }

  // Kalau demote diri sendiri dari admin → cek apakah admin terakhir
  if (target.user_id === actor.userId && target.role === 'admin' && newRole !== 'admin') {
    const { count } = await supabaseAdmin
      .from('tenant_members')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', actor.tenantId)
      .eq('role', 'admin')

    if ((count || 0) <= 1) {
      return NextResponse.json({ error: 'Tidak bisa demote — kamu satu-satunya admin.' }, { status: 400 })
    }
  }

  const { error } = await supabaseAdmin
    .from('tenant_members')
    .update({ role: newRole })
    .eq('user_id', id)
    .eq('tenant_id', actor.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
