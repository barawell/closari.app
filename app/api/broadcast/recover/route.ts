import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { runCampaign } from '@/lib/broadcast-send'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const APPROVER_ROLES = ['admin', 'owner']

// POST /api/broadcast/recover  body { id }
// Untuk campaign yang nyangkut di status "sending"/"partial" → lanjutkan/selesaikan.
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!APPROVER_ROLES.includes(actor.role || '')) {
    return NextResponse.json({ error: 'Hanya admin.' }, { status: 403 })
  }

  const b = await req.json().catch(() => ({}))
  const id = String(b.id || '')
  if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 })

  const { data: camp } = await supabaseAdmin
    .from('broadcast_campaigns')
    .select('id, tenant_id, wa_number_id, status')
    .eq('id', id).eq('tenant_id', actor.tenantId).maybeSingle()
  if (!camp) return NextResponse.json({ error: 'campaign tidak ditemukan' }, { status: 404 })

  if (!['sending', 'partial', 'approved'].includes(camp.status)) {
    return NextResponse.json({ error: `Status "${camp.status}" tidak perlu di-recover.` }, { status: 409 })
  }

  const { data: num } = await supabaseAdmin
    .from('wa_numbers').select('id, phone_number_id').eq('id', camp.wa_number_id).maybeSingle()
  const { data: sec } = num ? await supabaseAdmin
    .from('wa_number_secrets').select('access_token').eq('wa_number_id', num.id).maybeSingle() : { data: null }
  if (!num || !sec?.access_token) return NextResponse.json({ error: 'nomor / token tidak ada' }, { status: 400 })

  // Hapus recipient lama campaign ini biar tidak dobel, lalu jalankan ulang
  await supabaseAdmin.from('broadcast_recipients').delete().eq('campaign_id', camp.id)

  const res = await runCampaign({
    campaignId: camp.id,
    tenantId: actor.tenantId,
    phoneNumberId: num.phone_number_id as string,
    accessToken: sec.access_token as string,
  })

  return NextResponse.json({ ok: true, recovered: true, ...res })
}
