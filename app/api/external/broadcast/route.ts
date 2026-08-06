import { NextResponse } from 'next/server'
import { getApiActor } from '@/lib/api-keys'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizePhone } from '@/lib/wa'

/* /api/external/broadcast — ajukan broadcast dari sistem luar pakai API KEY tenant.

   Bedanya dengan /api/external/send: yang itu satu nomor per panggilan. Yang ini
   menerima DAFTAR penerima sekaligus, jadi sistem luar (mis. barawell.id) bisa
   menyerahkan hasil segmentasinya sendiri tanpa harus memanggil ratusan kali.

   SAMA PERSIS dengan /api/broadcast versi login: campaign masuk sebagai
   pending_approval. Pengiriman baru terjadi setelah admin menyetujui di Closari.
   Sengaja begitu — API key ada di server tenant, dan sebuah bug di sana tidak
   boleh bisa membakar kuota template tanpa ada manusia yang melihat dulu.

   Body:
     { nama?: "Ingatkan stok habis Agustus",
       template_name: "reorder_reminder", language?: "id",
       template_params?: ["{{nama|Kak}}"],
       category?: "MARKETING",
       wa_number_id?: "...",
       recipients: [{ phone: "628xxx", name: "Budi" }, ...] }

   Balasan:
     { ok: true, campaign_id, total, ditolak: [...] }

   Penerima dari daftar eksplisit TIDAK kena cooldown 30 hari otomatis seperti
   penerima dari kontak — pengirimlah yang bertanggung jawab menyaring. Gunakan
   /api/external/riwayat untuk itu. Opt-out tetap selalu dibuang di sini. */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const MAKS_PENERIMA = 2000

export async function POST(req: Request) {
  const actor = await getApiActor(req)
  if (!actor?.tenantId) {
    return NextResponse.json({ ok: false, error: 'API key tidak valid atau dicabut.' }, { status: 401 })
  }

  const b = await req.json().catch(() => ({} as any))

  const templateName = String(b?.template_name || '').trim()
  if (!templateName) {
    return NextResponse.json({ ok: false, error: 'template_name wajib.' }, { status: 400 })
  }
  const language = String(b?.language || 'id').trim()
  const templateParams: string[] = Array.isArray(b?.template_params)
    ? b.template_params.map((p: any) => String(p ?? ''))
    : []
  const category = String(b?.category || 'MARKETING').toUpperCase()
  const nama = String(b?.nama || '').trim()

  // ── Penerima ──────────────────────────────────────────────────────────────
  const mentah: any[] = Array.isArray(b?.recipients) ? b.recipients : []
  if (!mentah.length) {
    return NextResponse.json({ ok: false, error: 'recipients kosong.' }, { status: 400 })
  }
  if (mentah.length > MAKS_PENERIMA) {
    return NextResponse.json(
      { ok: false, error: `Maksimal ${MAKS_PENERIMA} penerima sekali ajukan.` },
      { status: 400 },
    )
  }

  const ditolak: { phone: string; alasan: string }[] = []
  let pairs: { phone: string; name?: string | null }[] = []

  for (const r of mentah) {
    const raw = r && typeof r === 'object' ? String(r.phone || '') : String(r)
    const phone = normalizePhone(raw)
    if (!phone || phone.length < 10) {
      ditolak.push({ phone: raw, alasan: 'nomor tidak valid' })
      continue
    }
    pairs.push({ phone, name: (r && typeof r === 'object' ? r.name : null) ?? null })
  }

  // Dedupe by phone, pertahankan nama pertama yang ada.
  {
    const seen = new Map<string, { phone: string; name?: string | null }>()
    for (const p of pairs) {
      const ex = seen.get(p.phone)
      if (!ex || (!ex.name && p.name)) seen.set(p.phone, p)
    }
    pairs = Array.from(seen.values())
  }

  // Buang opt-out — selalu, tidak bisa dilewati dari luar.
  {
    const phones = pairs.map((p) => p.phone)
    for (let i = 0; i < phones.length; i += 500) {
      const chunk = phones.slice(i, i + 500)
      const { data: opted } = await supabaseAdmin
        .from('wa_contacts').select('phone')
        .eq('tenant_id', actor.tenantId).eq('opted_out', true).in('phone', chunk)
      const set = new Set((opted || []).map((c: any) => c.phone))
      if (set.size) {
        pairs = pairs.filter((p) => {
          if (set.has(p.phone)) { ditolak.push({ phone: p.phone, alasan: 'opt-out' }); return false }
          return true
        })
      }
    }
  }

  const phones = pairs.map((p) => p.phone)
  if (!phones.length) {
    return NextResponse.json(
      { ok: false, error: 'Tidak ada penerima valid (kosong / semua opt-out).', ditolak },
      { status: 400 },
    )
  }

  // ── Nomor pengirim milik tenant ───────────────────────────────────────────
  // Sama seperti /api/external/send: prioritaskan yang statusnya connected.
  const wanted = String(b?.wa_number_id || '').trim() || null
  let num: { id: string } | null = null
  if (wanted) {
    const { data } = await supabaseAdmin
      .from('wa_numbers').select('id')
      .eq('tenant_id', actor.tenantId).eq('id', wanted).maybeSingle()
    num = data as any
  } else {
    const { data: nums } = await supabaseAdmin
      .from('wa_numbers').select('id, status, created_at')
      .eq('tenant_id', actor.tenantId).order('created_at', { ascending: false })
    const list = (nums || []) as any[]
    num = (list.find((n) => n.status === 'connected') || list[0]) || null
  }
  if (!num) {
    return NextResponse.json({ ok: false, error: 'Tenant belum punya nomor WhatsApp aktif.' }, { status: 400 })
  }

  // ── Simpan campaign ───────────────────────────────────────────────────────
  const isi: Record<string, any> = {
    tenant_id: actor.tenantId,
    wa_number_id: num.id,
    kind: 'template',
    body: `[template] ${templateName}${nama ? ` — ${nama}` : ''}`,
    template_name: templateName,
    language,
    template_params: templateParams,
    category,
    engaged_only: false,
    target_phones: phones,
    total: phones.length,
    sent: 0,
    failed: 0,
    status: 'pending_approval',
  }

  let campaignId: string | null = null
  {
    const { data, error } = await supabaseAdmin
      .from('broadcast_campaigns').insert(isi).select('id').maybeSingle()

    if (error && error.code === '23502') {
      // sent_by tidak boleh null di database ini. API key bukan user, jadi
      // pakai pemilik tenant sebagai penanggung jawab supaya tetap terlacak.
      const { data: owner } = await supabaseAdmin
        .from('tenant_members').select('user_id')
        .eq('tenant_id', actor.tenantId)
        .order('created_at', { ascending: true }).limit(1).maybeSingle()
      if (!owner?.user_id) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      }
      const ulang = await supabaseAdmin
        .from('broadcast_campaigns').insert({ ...isi, sent_by: owner.user_id })
        .select('id').maybeSingle()
      if (ulang.error || !ulang.data) {
        return NextResponse.json({ ok: false, error: ulang.error?.message || 'gagal bikin campaign' }, { status: 500 })
      }
      campaignId = ulang.data.id as string
    } else if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message || 'gagal bikin campaign' }, { status: 500 })
    } else {
      campaignId = data.id as string
    }
  }

  // Snapshot nama per-penerima. Toleran: kalau kolom target_contacts belum ada,
  // broadcast tetap jalan dan nama di-lookup dari wa_contacts saat kirim.
  if (pairs.some((p) => p.name)) {
    const { error } = await supabaseAdmin
      .from('broadcast_campaigns')
      .update({ target_contacts: pairs.map((p) => ({ phone: p.phone, name: p.name || null })) })
      .eq('id', campaignId)
    if (error) console.warn('[external/broadcast] target_contacts tidak tersimpan:', error.message)
  }

  return NextResponse.json({
    ok: true,
    pending: true,
    campaign_id: campaignId,
    total: phones.length,
    ditolak,
    message: 'Broadcast diajukan. Menunggu persetujuan admin di Closari sebelum dikirim.',
  })
}
