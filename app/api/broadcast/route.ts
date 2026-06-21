import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendText } from '@/lib/wa'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const waNumberId = b.wa_number_id as string
  const text = (b.text || '').trim()
  const engagedOnly: boolean = b.engagedOnly !== false
  if (!waNumberId || !text) return NextResponse.json({ error: 'wa_number_id & text wajib' }, { status: 400 })

  // Nomor pengirim + token
  const { data: num } = await supabaseAdmin
    .from('wa_numbers').select('id, phone_number_id').eq('id', waNumberId).eq('tenant_id', actor.tenantId).maybeSingle()
  if (!num) return NextResponse.json({ error: 'nomor tidak ditemukan' }, { status: 404 })
  const { data: sec } = await supabaseAdmin
    .from('wa_number_secrets').select('access_token').eq('wa_number_id', num.id).maybeSingle()
  if (!sec?.access_token) return NextResponse.json({ error: 'token nomor tidak ada' }, { status: 400 })

  // Kontak tenant: WAJIB bukan opt-out; default cuma yang engaged (aktif 60 hari).
  let q = supabaseAdmin.from('wa_contacts')
    .select('phone, last_message_at')
    .eq('tenant_id', actor.tenantId).eq('opted_out', false)
  if (engagedOnly) {
    const since = new Date(Date.now() - 60 * 86400000).toISOString()
    q = q.gte('last_message_at', since)
  }
  const { data: contacts } = await q.limit(1000)
  const targets = (contacts || []).map((c: any) => c.phone).filter(Boolean)
  if (!targets.length) return NextResponse.json({ error: 'Tidak ada penerima (opt-out / tidak aktif semua).', total: 0 }, { status: 400 })

  let sent = 0, failed = 0
  for (const to of targets) {
    const ok = await sendText(num.phone_number_id as string, sec.access_token as string, to, text)
    ok ? sent++ : failed++
    await sleep(250) // ~4/detik
  }
  return NextResponse.json({ total: targets.length, sent, failed })
}
