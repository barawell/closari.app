// lib/broadcast-send.ts  (v2)
// - Resolve penerima: dari kontak (engaged + segment) ATAU daftar eksplisit (CSV/manual)
// - Kirim TEKS atau TEMPLATE
// - FIX: baca r.ok (bukan object) — bug lama yg bikin failed selalu 0.

import { supabaseAdmin } from './supabase-admin'
import { sendText, sendMediaByUrl, normalizePhone } from './wa'

const GRAPH = 'https://graph.facebook.com/v21.0'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const BROADCAST_COOLDOWN_DAYS = 30
const ENGAGED_WINDOW_DAYS = 60
const SEND_DELAY_MS = 600
const MAX_PER_RUN = 2000

export type Segment = 'all' | 'loyal' | 'new'

// ── Variabel otomatis "nama kontak" ────────────────────────────────
// Token yang ditulis broadcast UI: "{{nama}}" atau "{{nama|Fallback}}".
// Saat kirim, token ini di-resolve jadi NAMA DEPAN tiap penerima (per-orang).
const AUTO_NAME_RE = /^\s*\{\{\s*nama\s*(?:\|([^}]*))?\}\}\s*$/i

function firstNameOf(name?: string | null): string {
  const n = (name || '').trim()
  return n ? n.split(/\s+/)[0] : ''
}
// Apakah ada minimal 1 variabel pakai token otomatis-nama?
function paramsUseAutoName(params: any[]): boolean {
  return (params || []).some((p) => AUTO_NAME_RE.test(String(p ?? '')))
}
// Bangun params final buat 1 penerima: token "{{nama|fb}}" → nama depan, sisanya apa adanya.
function resolveParamsFor(params: any[], recipientName?: string | null): string[] {
  const fn = firstNameOf(recipientName)
  return (params || []).map((p) => {
    const s = String(p ?? '')
    const m = AUTO_NAME_RE.exec(s)
    if (!m) return s
    const fallback = (m[1] || '').trim() || 'Kak'
    return fn || fallback
  })
}

// Kontak eligible (tidak opt-out, engaged opsional, lewat cooldown, filter segmen).
export async function computeEligible(
  tenantId: string,
  engagedOnly: boolean,
  segment: Segment = 'all',
): Promise<{ id: string; phone: string; name?: string | null }[]> {
  let q = supabaseAdmin.from('wa_contacts')
    .select('id, phone, name, last_message_at, last_broadcast_at, last_order_at, order_count')
    .eq('tenant_id', tenantId).eq('opted_out', false)

  if (engagedOnly) {
    const since = new Date(Date.now() - ENGAGED_WINDOW_DAYS * 86400000).toISOString()
    q = q.gte('last_message_at', since)
  }
  const { data } = await q.limit(5000)

  const cooldownCut = Date.now() - BROADCAST_COOLDOWN_DAYS * 86400000
  return (data || []).filter((c: any) => {
    if (!c.phone) return false
    // segmen
    const isLoyal = (c.order_count && c.order_count > 0) || !!c.last_order_at
    if (segment === 'loyal' && !isLoyal) return false
    if (segment === 'new' && isLoyal) return false
    // cooldown
    if (!c.last_broadcast_at) return true
    return new Date(c.last_broadcast_at).getTime() < cooldownCut
  }).slice(0, MAX_PER_RUN).map((c: any) => ({ id: c.id, phone: c.phone, name: c.name }))
}

// Kirim 1 template ke 1 nomor.
async function sendTemplate(
  phoneNumberId: string, accessToken: string, to: string,
  templateName: string, language: string, params: string[] = [],
): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
  try {
    const template: any = { name: templateName, language: { code: language || 'id' } }
    // Kalau template punya variabel {{1}}, {{2}}, dst → kirim sebagai body parameters
    if (params && params.length > 0) {
      template.components = [{
        type: 'body',
        parameters: params.map((p) => ({ type: 'text', text: String(p ?? '') })),
      }]
    }
    const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: j?.error?.message || `HTTP ${res.status}` }
    return { ok: true, waMessageId: j?.messages?.[0]?.id }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network error' }
  }
}

// Eksekusi campaign yang sudah di-approve.
export async function runCampaign(opts: {
  campaignId: string
  tenantId: string
  phoneNumberId: string
  accessToken: string
}): Promise<{ total: number; sent: number; failed: number }> {
  const { campaignId, tenantId, phoneNumberId, accessToken } = opts

  // Ambil snapshot campaign
  const { data: camp } = await supabaseAdmin
    .from('broadcast_campaigns')
    .select('body, kind, template_name, language, target_phones, engaged_only, template_params')
    .eq('id', campaignId).maybeSingle()
  if (!camp) return { total: 0, sent: 0, failed: 0 }

  // Snapshot nama per-penerima (kolom `target_contacts`, opsional).
  // Di-select terpisah & toleran: kalau kolom belum ada, data null → fallback ke target_phones.
  let snapNames: { phone: string; name?: string | null }[] = []
  {
    const { data: tc } = await supabaseAdmin
      .from('broadcast_campaigns').select('target_contacts').eq('id', campaignId).maybeSingle()
    const arr = (tc as any)?.target_contacts
    if (Array.isArray(arr)) snapNames = arr
  }

  // Tentukan penerima: snapshot bernama → snapshot nomor → hitung engaged.
  let recipients: { id?: string; phone: string; name?: string | null }[] = []
  if (snapNames.length) {
    recipients = snapNames
      .map((s) => ({ phone: normalizePhone(String(s.phone || '')), name: s.name ?? null }))
      .filter((r) => r.phone)
  } else if (Array.isArray(camp.target_phones) && camp.target_phones.length) {
    recipients = camp.target_phones.map((p: string) => ({ phone: normalizePhone(p) })).filter((r) => r.phone)
  } else {
    recipients = await computeEligible(tenantId, camp.engaged_only !== false)
  }

  await supabaseAdmin.from('broadcast_campaigns')
    .update({ status: 'sending', total: recipients.length }).eq('id', campaignId)

  const isTemplate = camp.kind === 'template' && !!camp.template_name

  // Lampiran gambar (opsional, hanya mode teks). Dibaca terpisah supaya kalau kolom
  // `image_url` belum ada di DB, broadcast biasa TETAP jalan.
  let imageUrl: string | null = null
  if (!isTemplate) {
    const { data: img } = await supabaseAdmin
      .from('broadcast_campaigns').select('image_url').eq('id', campaignId).maybeSingle()
    imageUrl = ((img as any)?.image_url as string) || null
  }
  const tplParams: any[] = Array.isArray(camp.template_params) ? camp.template_params : []

  // Kalau template pakai variabel otomatis-nama, siapkan map phone → nama.
  // (jalur snapshot target_phones gak bawa nama, jadi lookup dari wa_contacts)
  const nameByPhone = new Map<string, string>()
  if (isTemplate && paramsUseAutoName(tplParams)) {
    for (const r of recipients) if (r.name) nameByPhone.set(r.phone, r.name as string)
    const missing = recipients.filter((r) => !nameByPhone.has(r.phone)).map((r) => r.phone)
    for (let i = 0; i < missing.length; i += 400) {
      const chunk = missing.slice(i, i + 400)
      const { data: rows } = await supabaseAdmin.from('wa_contacts')
        .select('phone, name').eq('tenant_id', tenantId).in('phone', chunk)
      for (const row of rows || []) if (row?.name) nameByPhone.set(row.phone, row.name)
    }
  }

  let sent = 0, failed = 0
  const nowIso = new Date().toISOString()

  // Batas aman waktu eksekusi: stop sebelum Vercel timeout, sisanya bisa di-resume
  const startedAt = Date.now()
  const MAX_RUN_MS = 250000 // 250 detik (di bawah maxDuration 300)
  let lastErr: string | null = null

  for (let i = 0; i < recipients.length; i++) {
    // Kalau mendekati batas waktu, berhenti & tandai partial (bukan stuck)
    if (Date.now() - startedAt > MAX_RUN_MS) {
      await supabaseAdmin.from('broadcast_campaigns')
        .update({ sent, failed, status: 'partial' }).eq('id', campaignId)
      return { total: recipients.length, sent, failed }
    }

    const c = recipients[i]
    const perParams = resolveParamsFor(tplParams, nameByPhone.get(c.phone) ?? c.name)
    const r = isTemplate
      ? await sendTemplate(phoneNumberId, accessToken, c.phone, camp.template_name as string, camp.language as string, perParams)
      : imageUrl
        ? await sendMediaByUrl(phoneNumberId, accessToken, c.phone, 'image', imageUrl, { caption: camp.body as string })
        : await sendText(phoneNumberId, accessToken, c.phone, camp.body as string)
    const ok = r.ok
    if (ok) sent++; else { failed++; lastErr = r.error || lastErr }

    // Insert per-recipient langsung (biar gak hilang kalau function ke-kill)
    await supabaseAdmin.from('broadcast_recipients').insert({
      campaign_id: campaignId, tenant_id: tenantId, contact_id: c.id || null,
      phone: c.phone, status: ok ? 'sent' : 'failed', wa_message_id: r.waMessageId || null,
      error: ok ? null : (r.error || null),
    })

    if (ok && c.phone) {
      await supabaseAdmin.from('wa_contacts')
        .update({ last_broadcast_at: nowIso }).eq('tenant_id', tenantId).eq('phone', c.phone)
    }

    // Update progress tiap 10 pesan (biar status gak nyangkut kalau timeout)
    if (i % 10 === 0) {
      await supabaseAdmin.from('broadcast_campaigns')
        .update({ sent, failed }).eq('id', campaignId)
    }

    await sleep(SEND_DELAY_MS)
  }

  await supabaseAdmin.from('broadcast_campaigns')
    .update({ sent, failed, status: 'done', last_error: lastErr }).eq('id', campaignId)

  return { total: recipients.length, sent, failed }
}
