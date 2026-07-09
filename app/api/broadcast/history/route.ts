import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Resolusi nama berdasarkan NOMOR (untuk penerima yang contact_id-nya kosong,
// mis. broadcast via daftar nomor/CSV). Dicocokkan ke wa_contacts by phone.
async function namesByPhone(tenantId: string, phones: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const uniq = Array.from(new Set(phones.filter(Boolean)))
  for (let i = 0; i < uniq.length; i += 500) {
    const chunk = uniq.slice(i, i + 500)
    const { data } = await supabaseAdmin.from('wa_contacts')
      .select('phone, name').eq('tenant_id', tenantId).in('phone', chunk)
    for (const row of data || []) if (row.name) map.set(row.phone, row.name)
  }
  return map
}

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
      .select('phone, status, error, created_at, delivered_at, read_at, contact:wa_contacts(name)')
      .eq('campaign_id', id).eq('tenant_id', actor.tenantId)
      .order('created_at', { ascending: true })
      .limit(5000)

    const recs = recipients || []
    const nameMap = await namesByPhone(actor.tenantId, recs.map((r: any) => r.phone))

    return NextResponse.json({
      campaign,
      recipients: recs.map((r: any) => {
        const cn = Array.isArray(r.contact) ? r.contact[0]?.name : r.contact?.name
        return {
          phone: r.phone,
          status: r.status,
          error: r.error || null,
          sent_at: r.created_at,
          delivered_at: r.delivered_at,
          read_at: r.read_at,
          name: cn || nameMap.get(r.phone) || null,
        }
      }),
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
