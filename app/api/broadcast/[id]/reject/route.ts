// app/api/broadcast/[id]/reject/route.ts
// Tolak campaign 'pending_approval'. Hanya admin/owner.

import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const APPROVER_ROLES = ['admin', 'owner']

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!APPROVER_ROLES.includes(actor.role || '')) {
    return NextResponse.json({ error: 'Hanya admin yang bisa menolak broadcast.' }, { status: 403 })
  }

  const { id } = await ctx.params
  const b = await req.json().catch(() => ({}))
  const reason = (b.reason || '').trim() || null

  const { data: camp } = await supabaseAdmin
    .from('broadcast_campaigns')
    .select('id, status')
    .eq('id', id).eq('tenant_id', actor.tenantId).maybeSingle()
  if (!camp) return NextResponse.json({ error: 'campaign tidak ditemukan' }, { status: 404 })
  if (camp.status !== 'pending_approval') {
    return NextResponse.json({ error: `Status sekarang "${camp.status}", tidak bisa ditolak.` }, { status: 409 })
  }

  await supabaseAdmin.from('broadcast_campaigns')
    .update({ rejected_by: actor.userId, rejected_at: new Date().toISOString(), reject_reason: reason, status: 'rejected' })
    .eq('id', camp.id)

  return NextResponse.json({ ok: true })
}
