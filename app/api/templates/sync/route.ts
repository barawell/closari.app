import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { getWabaAuth } from '@/lib/wa-account'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
const GRAPH = 'https://graph.facebook.com/v21.0'

// POST /api/templates/sync → tarik status terbaru dari Meta & simpan lokal
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const auth = await getWabaAuth(actor.tenantId)
  if (!auth) return NextResponse.json({ error: 'WABA tidak terhubung' }, { status: 400 })

  const res = await fetch(
    `${GRAPH}/${auth.wabaId}/message_templates?fields=name,status,language,category,components,id&limit=100`,
    { headers: { Authorization: `Bearer ${auth.accessToken}` } },
  )
  const j = await res.json()
  if (!res.ok) return NextResponse.json({ error: j?.error?.message || 'Gagal ambil template dari Meta' }, { status: 502 })

  const templates: any[] = j.data || []
  let synced = 0

  for (const t of templates) {
    await supabaseAdmin.from('wa_templates').upsert({
      tenant_id: actor.tenantId,
      template_id: String(t.id || ''),
      name: t.name,
      language: t.language || 'id',
      category: t.category,
      status: t.status,
      components: t.components || [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,name,language' })
    synced++
  }

  return NextResponse.json({ ok: true, synced, templates })
}

// GET /api/templates/sync → ambil dari DB lokal (cepat, no Meta call)
export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('wa_templates')
    .select('*')
    .eq('tenant_id', actor.tenantId)
    .order('updated_at', { ascending: false })

  return NextResponse.json({ templates: data || [] })
}
