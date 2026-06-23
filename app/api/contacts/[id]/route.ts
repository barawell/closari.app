import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// GET /api/contacts/[id]
// Next.js 15: params adalah Promise, harus di-await
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { data: contact } = await supabaseAdmin
    .from('wa_contacts')
    .select('id, phone, name, notes, tags, opted_out, first_contact_at, last_order_at, created_at')
    .eq('id', id)
    .eq('tenant_id', actor.tenantId)
    .maybeSingle()

  if (!contact) return NextResponse.json({ error: 'contact tidak ditemukan' }, { status: 404 })

  const [{ count: totalMsgsIn }, { count: totalMsgsOut }, { count: totalConvs }] = await Promise.all([
    supabaseAdmin.from('wa_messages').select('*', { count: 'exact', head: true }).eq('tenant_id', actor.tenantId).eq('contact_id', id).eq('direction', 'in'),
    supabaseAdmin.from('wa_messages').select('*', { count: 'exact', head: true }).eq('tenant_id', actor.tenantId).eq('contact_id', id).eq('direction', 'out'),
    supabaseAdmin.from('wa_conversations').select('*', { count: 'exact', head: true }).eq('tenant_id', actor.tenantId).eq('contact_id', id),
  ])

  const days_since_first = contact.first_contact_at
    ? Math.floor((Date.now() - new Date(contact.first_contact_at).getTime()) / 86400000)
    : null
  const days_since_last_order = contact.last_order_at
    ? Math.floor((Date.now() - new Date(contact.last_order_at).getTime()) / 86400000)
    : null

  return NextResponse.json({
    contact,
    stats: {
      total_messages_in: totalMsgsIn || 0,
      total_messages_out: totalMsgsOut || 0,
      total_conversations: totalConvs || 0,
      days_since_first_contact: days_since_first,
      days_since_last_order: days_since_last_order,
    }
  })
}

// PUT /api/contacts/[id]
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const b = await req.json().catch(() => ({}))

  const patch: any = {}
  if (typeof b.notes === 'string') patch.notes = b.notes
  if (Array.isArray(b.tags)) patch.tags = b.tags.filter((t: any) => typeof t === 'string').slice(0, 20)
  if (typeof b.name === 'string') patch.name = b.name.trim() || null
  if (b.mark_order) patch.last_order_at = new Date().toISOString()

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

  const { error } = await supabaseAdmin.from('wa_contacts').update(patch).eq('id', id).eq('tenant_id', actor.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
