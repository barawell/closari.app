// lib/broadcast-send.ts  (v2)
// - Resolve penerima: dari kontak (engaged + segment) ATAU daftar eksplisit (CSV/manual)
// - Kirim TEKS atau TEMPLATE
// - FIX: baca r.ok (bukan object) — bug lama yg bikin failed selalu 0.

import { supabaseAdmin } from './supabase-admin'
import { sendText, normalizePhone } from './wa'

const GRAPH = 'https://graph.facebook.com/v21.0'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const BROADCAST_COOLDOWN_DAYS = 30
const ENGAGED_WINDOW_DAYS = 60
const SEND_DELAY_MS = 600
const MAX_PER_RUN = 2000

export type Segment = 'all' | 'loyal' | 'new'

// Kontak eligible (tidak opt-out, engaged opsional, lewat cooldown, filter segmen).
export async function computeEligible(
  tenantId: string,
  engagedOnly: boolean,
  segment: Segment = 'all',
): Promise<{ id: string; phone: string }[]> {
  let q = supabaseAdmin.from('wa_contacts')
    .select('id, phone, last_message_at, last_broadcast_at, last_order_at, order_count')
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
  }).slice(0, MAX_PER_RUN).map((c: any) => ({ id: c.id, phone: c.phone }))
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

  // Tentukan penerima: snapshot target_phones kalau ada, kalau tidak hitung engaged.
  let recipients: { id?: string; phone: string }[] = []
  if (Array.isArray(camp.target_phones) && camp.target_phones.length) {
    recipients = camp.target_phones.map((p: string) => ({ phone: normalizePhone(p) })).filter((r) => r.phone)
  } else {
    recipients = await computeEligible(tenantId, camp.engaged_only !== false)
  }

  await supabaseAdmin.from('broadcast_campaigns')
    .update({ status: 'sending', total: recipients.length }).eq('id', campaignId)

  const isTemplate = camp.kind === 'template' && !!camp.template_name
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
    const r = isTemplate
      ? await sendTemplate(phoneNumberId, accessToken, c.phone, camp.template_name as string, camp.language as string, Array.isArray(camp.template_params) ? camp.template_params : [])
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
