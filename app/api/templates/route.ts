import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
const GRAPH = 'https://graph.facebook.com/v21.0'

// GET: list templates dari Meta
export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: num } = await supabaseAdmin.from('wa_numbers').select('waba_id').eq('tenant_id', actor.tenantId).limit(1).maybeSingle()
  if (!num?.waba_id) return NextResponse.json({ templates: [] })

  const { data: sec } = await supabaseAdmin.from('wa_number_secrets').select('access_token')
    .eq('wa_number_id', (await supabaseAdmin.from('wa_numbers').select('id').eq('tenant_id', actor.tenantId).limit(1).maybeSingle()).data?.id).maybeSingle()
  if (!sec?.access_token) return NextResponse.json({ templates: [] })

  const res = await fetch(`${GRAPH}/${num.waba_id}/message_templates?fields=name,status,language,category,components&limit=50`, {
    headers: { Authorization: `Bearer ${sec.access_token}` },
  })
  const j = await res.json()
  return NextResponse.json({ templates: j.data || [] })
}

// POST: kirim broadcast pakai template
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const { wa_number_id, template_name, language_code, components, engagedOnly } = b
  if (!wa_number_id || !template_name) return NextResponse.json({ error: 'wa_number_id & template_name wajib' }, { status: 400 })

  const { data: num } = await supabaseAdmin.from('wa_numbers').select('id, phone_number_id').eq('id', wa_number_id).eq('tenant_id', actor.tenantId).maybeSingle()
  if (!num) return NextResponse.json({ error: 'nomor tidak ditemukan' }, { status: 404 })

  const { data: sec } = await supabaseAdmin.from('wa_number_secrets').select('access_token').eq('wa_number_id', num.id).maybeSingle()
  if (!sec?.access_token) return NextResponse.json({ error: 'token tidak ada' }, { status: 400 })

  let q = supabaseAdmin.from('wa_contacts').select('phone').eq('tenant_id', actor.tenantId).eq('opted_out', false)
  if (engagedOnly !== false) {
    const since = new Date(Date.now() - 90 * 86400000).toISOString()
    q = q.gte('last_message_at', since)
  }
  const { data: contacts } = await q.limit(1000)
  const targets = (contacts || []).map((c: any) => c.phone).filter(Boolean)
  if (!targets.length) return NextResponse.json({ error: 'Tidak ada penerima.', total: 0 }, { status: 400 })

  let sent = 0, failed = 0
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

  for (const to of targets) {
    const payload: any = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: template_name,
        language: { code: language_code || 'id' },
      },
    }
    if (components?.length) payload.template.components = components

    const res = await fetch(`${GRAPH}/${num.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sec.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    res.ok ? sent++ : failed++
    await sleep(300)
  }

  return NextResponse.json({ total: targets.length, sent, failed })
}
