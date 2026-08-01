import { NextResponse } from 'next/server'
import { getApiActor } from '@/lib/api-keys'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendText, sendTemplate, normalizePhone } from '@/lib/wa'

/* /api/external/send — kirim WA dari luar Closari pakai API KEY tenant.

   Ini pintu server-to-server: sistem lain (mis. daracare.id) memanggil endpoint
   ini dengan API key tenant-nya untuk mengirim WhatsApp dari nomor tenant itu.
   Auth-nya API key (bukan login user), jadi bisa dipanggil dari cron/server.

   Body:
     { to: "628xxx", mode: "template"|"text",
       text?: "...",                                  // mode text
       template_name?: "...", language?: "id",        // mode template
       params?: ["Budi","Rp3.100.000"] }              // isi {{1}},{{2}} template

   Kenapa default TEMPLATE untuk kasus seperti abandoned-cart: aturan Meta hanya
   mengizinkan pesan bebas (text) ke nomor yang mengirim pesan dalam 24 jam
   terakhir. Pelanggan yang baru checkout biasanya belum pernah chat, jadi hanya
   template (yang sudah disetujui) yang menembus. Text disediakan untuk kasus
   nomor yang memang sedang dalam window.

   Multi-tenant aman: API key -> tenant -> nomor WA milik tenant itu. Tenant lain
   tidak bisa memakai nomor tenant ini. */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const actor = await getApiActor(req)
  if (!actor?.tenantId) {
    return NextResponse.json({ ok: false, error: 'API key tidak valid atau dicabut.' }, { status: 401 })
  }

  const b = await req.json().catch(() => ({}))
  const toRaw = String(b?.to || '').trim()
  if (!toRaw) return NextResponse.json({ ok: false, error: 'Nomor tujuan (to) wajib.' }, { status: 400 })
  const to = normalizePhone(toRaw)

  const mode: 'text' | 'template' = b?.mode === 'text' ? 'text' : 'template'

  // ── Nomor pengirim milik tenant ────────────────────────────────────────────
  // Pakai wa_number_id yang diminta, atau nomor pertama tenant kalau tidak diisi.
  let waNumberId = String(b?.wa_number_id || '').trim() || null
  let numQuery = supabaseAdmin
    .from('wa_numbers').select('id, phone_number_id').eq('tenant_id', actor.tenantId)
  if (waNumberId) numQuery = numQuery.eq('id', waNumberId)
  const { data: nums } = await numQuery.order('created_at', { ascending: true }).limit(1)
  const num = nums?.[0]
  if (!num) return NextResponse.json({ ok: false, error: 'Tenant belum punya nomor WhatsApp aktif.' }, { status: 400 })

  const { data: sec } = await supabaseAdmin
    .from('wa_number_secrets').select('access_token').eq('wa_number_id', num.id).maybeSingle()
  if (!sec?.access_token) return NextResponse.json({ ok: false, error: 'Token nomor tidak tersedia.' }, { status: 400 })

  // ── Kirim ────────────────────────────────────────────────────────────────────
  let hasil: { ok: boolean; waMessageId?: string; error?: string }
  if (mode === 'text') {
    const text = String(b?.text || '').trim()
    if (!text) return NextResponse.json({ ok: false, error: 'text wajib untuk mode text.' }, { status: 400 })
    hasil = await sendText(num.phone_number_id as string, sec.access_token as string, to, text)
  } else {
    const templateName = String(b?.template_name || '').trim()
    if (!templateName) return NextResponse.json({ ok: false, error: 'template_name wajib untuk mode template.' }, { status: 400 })
    const language = String(b?.language || 'id').trim()
    const params: string[] = Array.isArray(b?.params) ? b.params.map((p: any) => String(p ?? '')) : []
    hasil = await sendTemplate(num.phone_number_id as string, sec.access_token as string, to, templateName, language, params)
  }

  if (!hasil.ok) {
    return NextResponse.json({ ok: false, error: hasil.error || 'Gagal mengirim.' }, { status: 502 })
  }
  return NextResponse.json({ ok: true, message_id: hasil.waMessageId })
}
