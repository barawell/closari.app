import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// GET /api/broadcast/history          → list campaign
// GET /api/broadcast/history?id=...    → detail penerima 1 campaign
export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')

  if (id) {
    const { data: campaign } = await supabaseAdmin
      .from('broadcast_campaigns')
      .select('id, kind, body, engaged_only, total, sent, failed, status, created_at')
      .eq('id', id).eq('tenant_id', actor.tenantId).maybeSingle()
    if (!campaign) return NextResponse.json({ error: 'campaign tidak ditemukan' }, { status: 404 })

    const { data: recipients } = await supabaseAdmin
      .from('broadcast_recipients')
      .select('phone, status, contact:wa_contacts(name)')
      .eq('campaign_id', id).eq('tenant_id', actor.tenantId)
      .order('created_at', { ascending: true })
      .limit(2000)

    return NextResponse.json({
      campaign,
      recipients: (recipients || []).map((r: any) => ({
        phone: r.phone,
        status: r.status,
        name: Array.isArray(r.contact) ? r.contact[0]?.name : r.contact?.name,
      })),
    })
  }

  const { data: campaigns } = await supabaseAdmin
    .from('broadcast_campaigns')
    .select('id, kind, body, engaged_only, total, sent, failed, status, created_at')
    .eq('tenant_id', actor.tenantId)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ campaigns: campaigns || [] })
}
