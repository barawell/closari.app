import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getWabaAuth } from '@/lib/wa-account'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const tid = actor.tenantId
  const now = new Date()
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // ── Pesan masuk/keluar 7 hari terakhir ──────────────────────────────
  const { data: msgs7 } = await supabaseAdmin
    .from('wa_messages')
    .select('direction, created_at')
    .eq('tenant_id', tid)
    .gte('created_at', day7)

  // Group by date + direction
  const msgByDate: Record<string, { in: number; out: number }> = {}
  for (const m of msgs7 || []) {
    const d = m.created_at.slice(0, 10)
    if (!msgByDate[d]) msgByDate[d] = { in: 0, out: 0 }
    if (m.direction === 'in') msgByDate[d].in++
    else msgByDate[d].out++
  }
  const msgChart = Object.entries(msgByDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }))

  // ── Broadcast campaigns 30 hari terakhir ────────────────────────────
  const { data: camps } = await supabaseAdmin
    .from('broadcast_campaigns')
    .select('id, body, status, sent, failed, total, created_at')
    .eq('tenant_id', tid)
    .gte('created_at', day30)
    .order('created_at', { ascending: false })
    .limit(20)

  // ── Delivery stats dari broadcast_recipients ─────────────────────────
  const { data: recipStats } = await supabaseAdmin
    .from('broadcast_recipients')
    .select('status')
    .eq('tenant_id', tid)
    .gte('created_at', day30)

  const delivery = { sent: 0, failed: 0, delivered: 0, read: 0 }
  for (const r of recipStats || []) {
    const s = (r.status || '').toLowerCase()
    if (s === 'sent') delivery.sent++
    else if (s === 'failed') delivery.failed++
    else if (s === 'delivered') delivery.delivered++
    else if (s === 'read') delivery.read++
  }
  const totalSent = delivery.sent + delivery.delivered + delivery.read
  const deliveryRate = totalSent > 0 ? Math.round((delivery.delivered + delivery.read) / totalSent * 100) : 0
  const readRate = totalSent > 0 ? Math.round(delivery.read / totalSent * 100) : 0

  // ── Kontak stats ────────────────────────────────────────────────────
  const { count: totalContacts } = await supabaseAdmin
    .from('wa_contacts').select('id', { count: 'exact', head: true }).eq('tenant_id', tid)
  const { count: optoutContacts } = await supabaseAdmin
    .from('wa_contacts').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('opted_out', true)
  const { count: newContacts7 } = await supabaseAdmin
    .from('wa_contacts').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).gte('created_at', day7)

  // ── Webhook health ──────────────────────────────────────────────────
  const auth = await getWabaAuth(tid)
  const { data: waNum } = auth ? await supabaseAdmin
    .from('wa_numbers').select('last_webhook_at, last_message_at, display_phone, label')
    .eq('id', auth.waNumberId).maybeSingle() : { data: null }

  const lastWebhookAt = waNum?.last_webhook_at || null
  const webhookHealthy = lastWebhookAt
    ? (now.getTime() - new Date(lastWebhookAt).getTime()) < 24 * 60 * 60 * 1000
    : false

  return NextResponse.json({
    msgChart,
    campaigns: camps || [],
    delivery: { ...delivery, totalSent, deliveryRate, readRate },
    contacts: { total: totalContacts || 0, optout: optoutContacts || 0, new7d: newContacts7 || 0 },
    webhook: { lastWebhookAt, healthy: webhookHealthy, phone: waNum?.display_phone || null, label: waNum?.label || null },
  })
}
