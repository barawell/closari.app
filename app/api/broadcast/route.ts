// app/api/broadcast/route.ts
// ALUR BARU (approval):
//   POST  -> TIDAK langsung kirim. Bikin campaign status 'pending_approval'
//            + hitung estimasi penerima. Tunggu approval admin.
//   GET   -> daftar campaign (default semua; ?status=pending_approval utk antrian)

import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { computeEligible } from '@/lib/broadcast-send'

export const dynamic = 'force-dynamic'

// ── POST: ajukan broadcast (masuk antrian approval) ──────────────────
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const waNumberId = b.wa_number_id as string
  const text = (b.text || '').trim()
  const engagedOnly: boolean = b.engagedOnly !== false
  if (!waNumberId || !text) return NextResponse.json({ error: 'wa_number_id & text wajib' }, { status: 400 })
  if (text.length < 10) return NextResponse.json({ error: 'Pesan terlalu pendek. Min 10 karakter biar tidak terdeteksi spam.' }, { status: 400 })

  // Validasi nomor milik tenant ini
  const { data: num } = await supabaseAdmin
    .from('wa_numbers').select('id, phone_number_id').eq('id', waNumberId).eq('tenant_id', actor.tenantId).maybeSingle()
  if (!num) return NextResponse.json({ error: 'nomor tidak ditemukan' }, { status: 404 })

  // Estimasi penerima (buat ditampilkan ke approver, belum dikirim)
  const eligible = await computeEligible(actor.tenantId, engagedOnly)

  const { data: campaign, error } = await supabaseAdmin.from('broadcast_campaigns').insert({
    tenant_id: actor.tenantId,
    wa_number_id: num.id,
    sent_by: actor.userId,
    kind: 'text',
    body: text,
    engaged_only: engagedOnly,
    total: eligible.length,
    sent: 0,
    failed: 0,
    status: 'pending_approval',
  }).select('id').maybeSingle()

  if (error || !campaign) return NextResponse.json({ error: error?.message || 'gagal bikin campaign' }, { status: 500 })

  return NextResponse.json({
    pending: true,
    campaign_id: campaign.id,
    eligible_count: eligible.length,
    message: 'Broadcast diajukan. Menunggu approval admin sebelum dikirim.',
  })
}

// ── GET: daftar campaign ─────────────────────────────────────────────
export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const status = new URL(req.url).searchParams.get('status') // optional filter

  let q = supabaseAdmin
    .from('broadcast_campaigns')
    .select('id, kind, body, total, sent, failed, status, engaged_only, created_at, approved_at, rejected_at, reject_reason, wa_number_id')
    .eq('tenant_id', actor.tenantId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status) q = q.eq('status', status)

  const { data } = await q
  return NextResponse.json({ campaigns: data || [] })
}
