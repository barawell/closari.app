// app/api/templates/manage/route.ts
// AJUKAN / KELOLA template WhatsApp langsung dari website — tanpa buka Meta.
//   GET    -> list semua template (status PENDING/APPROVED/REJECTED) dari Meta
//   POST   -> buat & ajukan template baru ke Meta (masuk review otomatis)
//   DELETE -> hapus template (?name=...)
//
// Catatan Meta:
// - Endpoint create: POST /{waba-id}/message_templates
// - Template baru selalu mulai status PENDING, lalu Meta review (biasanya
//   beberapa menit s/d 24 jam) jadi APPROVED / REJECTED.
// - Kalau body pakai variabel {{1}} {{2}}, WAJIB sertakan contoh (example).

import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { getWabaAuth } from '@/lib/wa-account'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
const GRAPH = 'https://graph.facebook.com/v21.0'

// ── GET: list template ───────────────────────────────────────────────
export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const auth = await getWabaAuth(actor.tenantId)
  if (!auth) return NextResponse.json({ templates: [] })

  const res = await fetch(
    `${GRAPH}/${auth.wabaId}/message_templates?fields=name,status,language,category,components,id&limit=100`,
    { headers: { Authorization: `Bearer ${auth.accessToken}` } },
  )
  const j = await res.json()
  if (!res.ok) return NextResponse.json({ error: j?.error?.message || 'gagal ambil template', templates: [] }, { status: 502 })
  return NextResponse.json({ templates: j.data || [] })
}

// ── POST: buat template baru ─────────────────────────────────────────
// body: {
//   wa_number_id?, name, language, category,
//   body_text, body_examples?: string[],     // contoh utk {{1}}, {{2}}, ...
//   header_text?, footer_text?,
//   buttons?: { type: 'QUICK_REPLY'|'URL'|'PHONE_NUMBER', text, url?, phone? }[]
// }
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const name = String(b.name || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
  const language = String(b.language || 'id').trim()
  const category = String(b.category || 'MARKETING').trim().toUpperCase()
  const bodyText = String(b.body_text || '').trim()
  const headerText = String(b.header_text || '').trim()
  const footerText = String(b.footer_text || '').trim()
  const bodyExamples: string[] = Array.isArray(b.body_examples) ? b.body_examples.filter(Boolean) : []
  const buttons: any[] = Array.isArray(b.buttons) ? b.buttons : []
  // Khusus AUTHENTICATION
  const otpButtonText = String(b.otp_button_text || 'Salin Kode').trim() || 'Salin Kode'
  const codeExpiryMin = Math.max(0, Math.min(90, parseInt(String(b.code_expiration_minutes ?? ''), 10) || 0))
  const isAuth = category === 'AUTHENTICATION'

  if (!name) return NextResponse.json({ error: 'Nama template wajib.' }, { status: 400 })
  if (!isAuth && !bodyText) return NextResponse.json({ error: 'Isi body wajib.' }, { status: 400 })
  if (!['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(category)) {
    return NextResponse.json({ error: 'Kategori harus MARKETING / UTILITY / AUTHENTICATION.' }, { status: 400 })
  }

  // Hitung jumlah variabel {{n}} di body (tidak berlaku utk AUTHENTICATION)
  const varCount = isAuth ? 0 : (bodyText.match(/\{\{\s*\d+\s*\}\}/g) || []).length
  if (varCount > 0 && bodyExamples.length < varCount) {
    return NextResponse.json({
      error: `Body punya ${varCount} variabel ({{1}}..). Isi ${varCount} contoh nilai dulu (untuk review Meta).`,
    }, { status: 400 })
  }

  const auth = await getWabaAuth(actor.tenantId, b.wa_number_id)
  if (!auth) return NextResponse.json({ error: 'WABA / token tidak ada. Hubungkan nomor dulu.' }, { status: 400 })

  // Susun components sesuai format Meta
  const components: any[] = []

  if (isAuth) {
    // Template AUTHENTICATION punya format BAKU dari Meta:
    // - BODY tanpa teks custom (Meta auto-generate "{{1}} adalah kode verifikasi Anda")
    // - FOOTER opsional dgn masa berlaku kode
    // - BUTTONS wajib: 1 tombol OTP (COPY_CODE)
    // Header/body/footer/tombol custom diabaikan — kalau dikirim, Meta menolak.
    components.push({ type: 'BODY', add_security_recommendation: true })
    if (codeExpiryMin > 0) components.push({ type: 'FOOTER', code_expiration_minutes: codeExpiryMin })
    components.push({ type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: otpButtonText }] })
  } else {
    if (headerText) {
      components.push({ type: 'HEADER', format: 'TEXT', text: headerText })
    }

    const bodyComp: any = { type: 'BODY', text: bodyText }
    if (varCount > 0) {
      bodyComp.example = { body_text: [bodyExamples.slice(0, varCount)] }
    }
    components.push(bodyComp)

    if (footerText) {
      components.push({ type: 'FOOTER', text: footerText })
    }

    if (buttons.length) {
      const btns = buttons.map((bt: any) => {
        const t = String(bt.type || 'QUICK_REPLY').toUpperCase()
        if (t === 'URL') return { type: 'URL', text: bt.text, url: bt.url }
        if (t === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: bt.text, phone_number: bt.phone }
        return { type: 'QUICK_REPLY', text: bt.text }
      }).filter((x: any) => x.text)
      if (btns.length) components.push({ type: 'BUTTONS', buttons: btns })
    }
  }

  // AUTHENTICATION wajib pakai message_send_ttl_seconds? tidak — cukup components di atas.
  const payload: any = { name, language, category, components }

  const res = await fetch(`${GRAPH}/${auth.wabaId}/message_templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) {
    return NextResponse.json({ error: j?.error?.error_user_msg || j?.error?.message || `gagal (${res.status})` }, { status: 502 })
  }

  return NextResponse.json({ ok: true, id: j?.id, status: j?.status || 'PENDING', name })
}

// ── DELETE: hapus template ───────────────────────────────────────────
export async function DELETE(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const name = new URL(req.url).searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'name wajib' }, { status: 400 })

  const auth = await getWabaAuth(actor.tenantId)
  if (!auth) return NextResponse.json({ error: 'WABA / token tidak ada' }, { status: 400 })

  const res = await fetch(`${GRAPH}/${auth.wabaId}/message_templates?name=${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  })
  const j = await res.json().catch(() => ({}))

  // Meta kadang balas error "not found" kalau template sudah hilang di sisi mereka,
  // tapi baris lokal masih ada → tetap bersihkan lokal supaya tidak jadi "ghost".
  const notFound = res.status === 404 || /not.*found|does not exist|tidak ditemukan/i.test(j?.error?.message || '')
  if (!res.ok && !notFound) {
    return NextResponse.json({ error: j?.error?.message || `gagal (${res.status})` }, { status: 502 })
  }

  // Hapus salinan lokal (semua bahasa dengan nama ini) biar tidak muncul lagi setelah sync.
  await supabaseAdmin.from('wa_templates')
    .delete().eq('tenant_id', actor.tenantId).eq('name', name)

  return NextResponse.json({ ok: true })
}
