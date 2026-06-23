import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendText } from '@/lib/wa'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── Anti-spam config (perketat semua) ───────────────────────
const BROADCAST_COOLDOWN_DAYS = 30   // 1 kontak max 1x broadcast / 30 hari
const ENGAGED_WINDOW_DAYS = 60       // "aktif" = ada pesan masuk 60 hari terakhir
const SEND_DELAY_MS = 600            // ~1.6 pesan/detik (lebih pelan = lebih aman)
const MAX_PER_RUN = 500              // batasi volume sekali jalan

export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const waNumberId = b.wa_number_id as string
  const text = (b.text || '').trim()
  const engagedOnly: boolean = b.engagedOnly !== false
  if (!waNumberId || !text) return NextResponse.json({ error: 'wa_number_id & text wajib' }, { status: 400 })
  if (text.length < 10) return NextResponse.json({ error: 'Pesan terlalu pendek. Min 10 karakter biar tidak terdeteksi spam.' }, { status: 400 })

  // Nomor pengirim + token
  const { data: num } = await supabaseAdmin
    .from('wa_numbers').select('id, phone_number_id').eq('id', waNumberId).eq('tenant_id', actor.tenantId).maybeSingle()
  if (!num) return NextResponse.json({ error: 'nomor tidak ditemukan' }, { status: 404 })
  const { data: sec } = await supabaseAdmin
    .from('wa_number_secrets').select('access_token').eq('wa_number_id', num.id).maybeSingle()
  if (!sec?.access_token) return NextResponse.json({ error: 'token nomor tidak ada' }, { status: 400 })

  // Target: bukan opt-out, (default) engaged, DAN belum di-broadcast dalam cooldown.
  let q = supabaseAdmin.from('wa_contacts')
    .select('id, phone, last_message_at, last_broadcast_at')
    .eq('tenant_id', actor.tenantId).eq('opted_out', false)
  if (engagedOnly) {
    const since = new Date(Date.now() - ENGAGED_WINDOW_DAYS * 86400000).toISOString()
    q = q.gte('last_message_at', since)
  }
  const { data: contacts } = await q.limit(2000)

  // Filter cooldown anti-spam: skip kontak yang baru di-broadcast < 30 hari.
  const cooldownCut = Date.now() - BROADCAST_COOLDOWN_DAYS * 86400000
  const eligible = (contacts || []).filter((c: any) => {
    if (!c.phone) return false
    if (!c.last_broadcast_at) return true
    return new Date(c.last_broadcast_at).getTime() < cooldownCut
  }).slice(0, MAX_PER_RUN)

  const skipped = (contacts || []).length - eligible.length
  if (!eligible.length) {
    return NextResponse.json({ error: 'Tidak ada penerima eligible (opt-out / tidak aktif / masih dalam cooldown 30 hari).', total: 0, skipped }, { status: 400 })
  }

  // Buat campaign record (history)
  const { data: campaign } = await supabaseAdmin.from('broadcast_campaigns').insert({
    tenant_id: actor.tenantId,
    wa_number_id: num.id,
    sent_by: actor.userId,
    kind: 'text',
    body: text,
    engaged_only: engagedOnly,
    total: eligible.length,
    status: 'sending',
  }).select('id').maybeSingle()
  const campaignId = campaign?.id as string | undefined

  let sent = 0, failed = 0
  const nowIso = new Date().toISOString()
  const recipientRows: any[] = []

  for (const c of eligible) {
    const ok = await sendText(num.phone_number_id as string, sec.access_token as string, c.phone, text)
    ok ? sent++ : failed++

    recipientRows.push({
      campaign_id: campaignId,
      tenant_id: actor.tenantId,
      contact_id: c.id,
      phone: c.phone,
      status: ok ? 'sent' : 'failed',
    })
    // Tandai last_broadcast_at hanya kalau berhasil terkirim
    if (ok) {
      await supabaseAdmin.from('wa_contacts')
        .update({ last_broadcast_at: nowIso })
        .eq('id', c.id)
    }
    await sleep(SEND_DELAY_MS)
  }

  // Simpan penerima + update campaign
  if (campaignId && recipientRows.length) {
    await supabaseAdmin.from('broadcast_recipients').insert(recipientRows)
    await supabaseAdmin.from('broadcast_campaigns')
      .update({ sent, failed, status: 'done' })
      .eq('id', campaignId)
  }

  return NextResponse.json({ total: eligible.length, sent, failed, skipped, campaign_id: campaignId })
}
