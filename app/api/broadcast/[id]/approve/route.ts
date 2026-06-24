// app/api/broadcast/[id]/approve/route.ts  (v2)
import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { runCampaign } from '@/lib/broadcast-send'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const APPROVER_ROLES = ['admin', 'owner']

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!APPROVER_ROLES.includes(actor.role || '')) {
    return NextResponse.json({ error: 'Hanya admin yang bisa approve broadcast.' }, { status: 403 })
  }

  const { id } = await ctx.params

  const { data: camp } = await supabaseAdmin
    .from('broadcast_campaigns')
    .select('id, tenant_id, wa_number_id, status')
    .eq('id', id).eq('tenant_id', actor.tenantId).maybeSingle()
  if (!camp) return NextResponse.json({ error: 'campaign tidak ditemukan' }, { status: 404 })
  if (camp.status !== 'pending_approval') {
    return NextResponse.json({ error: `Status sekarang "${camp.status}", tidak bisa di-approve.` }, { status: 409 })
  }

  const { data: num } = await supabaseAdmin
    .from('wa_numbers').select('id, phone_number_id').eq('id', camp.wa_number_id).eq('tenant_id', actor.tenantId).maybeSingle()
  if (!num) return NextResponse.json({ error: 'nomor pengirim tidak ada' }, { status: 400 })
  const { data: sec } = await supabaseAdmin
    .from('wa_number_secrets').select('access_token').eq('wa_number_id', num.id).maybeSingle()
  if (!sec?.access_token) return NextResponse.json({ error: 'token nomor tidak ada' }, { status: 400 })

  await supabaseAdmin.from('broadcast_campaigns')
    .update({ approved_by: actor.userId, approved_at: new Date().toISOString(), status: 'approved' })
    .eq('id', camp.id)

  const res = await runCampaign({
    campaignId: camp.id,
    tenantId: actor.tenantId,
    phoneNumberId: num.phone_number_id as string,
    accessToken: sec.access_token as string,
  })

  return NextResponse.json({ ok: true, ...res })
}
