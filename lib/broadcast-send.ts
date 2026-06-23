// lib/broadcast-send.ts
// Pengirim broadcast bersama (dipakai endpoint approve).
// FIX BUG: sendText() mengembalikan OBJECT { ok, waMessageId, error },
// bukan boolean. Kode lama `const ok = await sendText(...)` selalu truthy,
// jadi `failed` selalu 0 & recipient ditandai 'sent' walau gagal.

import { supabaseAdmin } from './supabase-admin'
import { sendText } from './wa'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const BROADCAST_COOLDOWN_DAYS = 30
const ENGAGED_WINDOW_DAYS = 60
const SEND_DELAY_MS = 600
const MAX_PER_RUN = 500

export type EligibleContact = { id: string; phone: string; last_broadcast_at: string | null }

// Hitung kontak yang boleh dikirimi (opt-out / engaged / cooldown).
export async function computeEligible(
  tenantId: string,
  engagedOnly: boolean,
): Promise<EligibleContact[]> {
  let q = supabaseAdmin.from('wa_contacts')
    .select('id, phone, last_message_at, last_broadcast_at')
    .eq('tenant_id', tenantId).eq('opted_out', false)

  if (engagedOnly) {
    const since = new Date(Date.now() - ENGAGED_WINDOW_DAYS * 86400000).toISOString()
    q = q.gte('last_message_at', since)
  }
  const { data: contacts } = await q.limit(2000)

  const cooldownCut = Date.now() - BROADCAST_COOLDOWN_DAYS * 86400000
  return (contacts || []).filter((c: any) => {
    if (!c.phone) return false
    if (!c.last_broadcast_at) return true
    return new Date(c.last_broadcast_at).getTime() < cooldownCut
  }).slice(0, MAX_PER_RUN)
}

// Eksekusi kirim untuk satu campaign yang sudah di-approve.
export async function runCampaign(opts: {
  campaignId: string
  tenantId: string
  phoneNumberId: string
  accessToken: string
  text: string
  engagedOnly: boolean
}): Promise<{ total: number; sent: number; failed: number }> {
  const { campaignId, tenantId, phoneNumberId, accessToken, text, engagedOnly } = opts

  const eligible = await computeEligible(tenantId, engagedOnly)

  await supabaseAdmin.from('broadcast_campaigns')
    .update({ status: 'sending', total: eligible.length })
    .eq('id', campaignId)

  let sent = 0, failed = 0
  const nowIso = new Date().toISOString()
  const recipientRows: any[] = []

  for (const c of eligible) {
    const r = await sendText(phoneNumberId, accessToken, c.phone, text)
    const ok = r.ok // <-- FIX: baca .ok dari object, bukan object-nya

    if (ok) sent++; else failed++

    recipientRows.push({
      campaign_id: campaignId,
      tenant_id: tenantId,
      contact_id: c.id,
      phone: c.phone,
      status: ok ? 'sent' : 'failed',
    })

    // Cooldown hanya untuk yang BENAR terkirim
    if (ok) {
      await supabaseAdmin.from('wa_contacts')
        .update({ last_broadcast_at: nowIso })
        .eq('id', c.id)
    }
    await sleep(SEND_DELAY_MS)
  }

  if (recipientRows.length) {
    await supabaseAdmin.from('broadcast_recipients').insert(recipientRows)
  }
  await supabaseAdmin.from('broadcast_campaigns')
    .update({ sent, failed, status: 'done' })
    .eq('id', campaignId)

  return { total: eligible.length, sent, failed }
}
