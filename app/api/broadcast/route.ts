// app/api/broadcast/route.ts  (v2)
//   POST -> ajukan broadcast (pending_approval) + SNAPSHOT penerima.
//           mendukung mode teks / template, penerima dari kontak / CSV / manual.
//   GET  -> daftar campaign (?status=pending_approval untuk antrian).

import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { computeEligible, type Segment } from '@/lib/broadcast-send'
import { normalizePhone } from '@/lib/wa'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const mode: 'text' | 'template' = b.mode === 'template' ? 'template' : 'text'
  const waNumberId = b.wa_number_id as string
  const category = String(b.category || 'MARKETING').toUpperCase()

  if (!waNumberId) return NextResponse.json({ error: 'wa_number_id wajib' }, { status: 400 })

  // Validasi konten per mode
  const text = (b.text || '').trim()
  const templateName = (b.template_name || '').trim()
  const language = (b.language || 'id').trim()
  const templateParams: string[] = Array.isArray(b.template_params) ? b.template_params.map((p: any) => String(p ?? '')) : []
  if (mode === 'text' && text.length < 10) {
    return NextResponse.json({ error: 'Pesan teks minimal 10 karakter.' }, { status: 400 })
  }
  if (mode === 'template' && !templateName) {
    return NextResponse.json({ error: 'Pilih template dulu.' }, { status: 400 })
  }

  // Validasi nomor pengirim milik tenant
  const { data: num } = await supabaseAdmin
    .from('wa_numbers').select('id, phone_number_id').eq('id', waNumberId).eq('tenant_id', actor.tenantId).maybeSingle()
  if (!num) return NextResponse.json({ error: 'nomor tidak ditemukan' }, { status: 404 })

  // ── Resolusi penerima → SNAPSHOT ke target_phones ──────────────────
  const recipientMode: 'contacts' | 'csv' | 'manual' = b.recipient_mode || 'contacts'
  let phones: string[] = []

  if (recipientMode === 'contacts') {
    const segment: Segment = (b.segment as Segment) || 'all'
    const engagedOnly: boolean = b.engagedOnly !== false
    const eligible = await computeEligible(actor.tenantId, engagedOnly, segment)
    phones = eligible.map((e) => e.phone)
  } else {
    // CSV / manual: daftar nomor dikirim dari client
    const raw: string[] = Array.isArray(b.recipients) ? b.recipients : []
    phones = raw.map((p) => normalizePhone(String(p))).filter(Boolean)
  }

  // Dedupe + buang opt-out (keamanan, walau dari CSV)
  phones = Array.from(new Set(phones))
  if (phones.length) {
    const { data: opted } = await supabaseAdmin
      .from('wa_contacts').select('phone')
      .eq('tenant_id', actor.tenantId).eq('opted_out', true).in('phone', phones)
    const optedSet = new Set((opted || []).map((c: any) => c.phone))
    phones = phones.filter((p) => !optedSet.has(p))
  }

  if (!phones.length) {
    return NextResponse.json({ error: 'Tidak ada penerima valid (kosong / semua opt-out / dalam cooldown).' }, { status: 400 })
  }

  const { data: campaign, error } = await supabaseAdmin.from('broadcast_campaigns').insert({
    tenant_id: actor.tenantId,
    wa_number_id: num.id,
    sent_by: actor.userId,
    kind: mode,
    body: mode === 'text' ? text : `[template] ${templateName}`,
    template_name: mode === 'template' ? templateName : null,
    language: mode === 'template' ? language : null,
    template_params: mode === 'template' ? templateParams : null,
    category,
    engaged_only: recipientMode === 'contacts' ? (b.engagedOnly !== false) : false,
    target_phones: phones,
    total: phones.length,
    sent: 0, failed: 0,
    status: 'pending_approval',
  }).select('id').maybeSingle()

  if (error || !campaign) return NextResponse.json({ error: error?.message || 'gagal bikin campaign' }, { status: 500 })

  return NextResponse.json({
    pending: true,
    campaign_id: campaign.id,
    eligible_count: phones.length,
    message: 'Broadcast diajukan. Menunggu approval admin sebelum dikirim.',
  })
}

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const status = new URL(req.url).searchParams.get('status')

  let q = supabaseAdmin
    .from('broadcast_campaigns')
    .select('id, kind, body, template_name, category, total, sent, failed, status, engaged_only, created_at, approved_at, rejected_at, reject_reason')
    .eq('tenant_id', actor.tenantId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (status) q = q.eq('status', status)

  const { data } = await q
  return NextResponse.json({ campaigns: data || [] })
}
