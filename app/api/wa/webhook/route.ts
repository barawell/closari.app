import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getNumberAuth, sendText, normalizePhone, type NumberAuth } from '@/lib/wa'
import { generateReply, type AiConfig, type Turn } from '@/lib/ai'

export const dynamic = 'force-dynamic'

const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || ''
const APP_SECRET   = process.env.META_APP_SECRET || ''

const STOP_WORDS  = ['STOP', 'BERHENTI', 'UNSUB', 'UNSUBSCRIBE', 'STOP PROMO', 'BERHENTI PROMO']
const START_WORDS = ['MULAI', 'LANGGANAN', 'START', 'SUBSCRIBE']

// ── GET: verifikasi webhook saat dipasang di Meta ──────────────────────────
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === VERIFY_TOKEN) {
    return new NextResponse(p.get('hub.challenge') || '', { status: 200 })
  }
  return new NextResponse('forbidden', { status: 403 })
}

// Verifikasi signature X-Hub-Signature-256 (HMAC-SHA256 body pakai App Secret).
function validSignature(raw: string, sig: string | null): boolean {
  if (!APP_SECRET) return true // dev: skip kalau App Secret belum di-set
  if (!sig) return false
  const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(raw).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}

// ── POST: event masuk (multi-tenant) ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const raw = await req.text()
  if (!validSignature(raw, req.headers.get('x-hub-signature-256'))) {
    return new NextResponse('bad signature', { status: 401 })
  }

  let body: any
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ ok: true }) }

  try {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {}
        const phoneNumberId: string | undefined = value?.metadata?.phone_number_id
        if (!phoneNumberId) continue

        // ROUTING: phone_number_id → tenant + token
        const auth = await getNumberAuth(phoneNumberId)
        if (!auth) continue // nomor belum terdaftar di tenant manapun → abaikan

        const profileName: string | undefined = value?.contacts?.[0]?.profile?.name
        for (const msg of value.messages || []) {
          await handleInbound(auth, phoneNumberId, msg, profileName)
        }
        // Update status delivered/read/failed utk pesan keluar.
        for (const st of value.statuses || []) {
          await handleStatus(auth, st)
        }
      }
    }
  } catch (e) {
    console.error('[closari webhook] error:', e)
  }

  // Meta wajib dapat 200 cepat.
  return NextResponse.json({ ok: true })
}

// Update status pesan keluar (sent → delivered → read, atau failed).
async function handleStatus(auth: NumberAuth, st: any) {
  const waId: string | undefined = st?.id
  const status: string | undefined = st?.status // 'sent'|'delivered'|'read'|'failed'
  if (!waId || !status) return
  await supabaseAdmin
    .from('wa_messages')
    .update({ status })
    .eq('tenant_id', auth.tenantId)
    .eq('wa_message_id', waId)
}

async function handleInbound(auth: NumberAuth, phoneNumberId: string, msg: any, profileName?: string) {
  const from = normalizePhone(msg.from)
  if (!from) return
  const waMessageId: string | undefined = msg.id

  // Dedup
  if (waMessageId) {
    const { data: dup } = await supabaseAdmin
      .from('wa_messages').select('id').eq('wa_message_id', waMessageId).maybeSingle()
    if (dup) return
  }

  // Ekstrak isi
  const type: string = msg.type || 'text'
  let bodyText = ''
  if (type === 'text') bodyText = msg.text?.body || ''
  else if (type === 'button') bodyText = msg.button?.text || ''
  else if (type === 'interactive') bodyText = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || ''
  else bodyText = `[${type}]`

  const now = new Date().toISOString()

  // Upsert kontak (per tenant). Customer yang balas = otomatis "terkontak"
  // (hilang dari daftar Perlu Follow Up biar gak dobel di-FU).
  const { data: contact } = await supabaseAdmin
    .from('wa_contacts')
    .upsert(
      {
        tenant_id: auth.tenantId,
        phone: from,
        name: profileName || undefined,
        last_message_at: now,
        followup_status: 'terkontak',
        followup_contacted_at: now,
      },
      { onConflict: 'tenant_id,phone' },
    )
    .select('id')
    .maybeSingle()
  const contactId = contact?.id as string | undefined

  // STOP / MULAI (opt-out per tenant)
  const kw = bodyText.trim().toUpperCase().replace(/[.!,\s]+$/g, '')
  if (STOP_WORDS.includes(kw)) {
    await supabaseAdmin.from('wa_contacts')
      .update({ opted_out: true, opted_out_at: now })
      .eq('tenant_id', auth.tenantId).eq('phone', from)
    await sendText(phoneNumberId, auth.accessToken, from, 'Kamu sudah berhenti dari broadcast. Balas MULAI untuk berlangganan lagi.')
  } else if (START_WORDS.includes(kw)) {
    await supabaseAdmin.from('wa_contacts')
      .update({ opted_out: false, opted_out_at: null })
      .eq('tenant_id', auth.tenantId).eq('phone', from)
    await sendText(phoneNumberId, auth.accessToken, from, 'Sip! Kamu berlangganan lagi. Balas STOP kapan aja untuk berhenti.')
  }

  // Get/create percakapan
  let conversationId: string | null = null
  const { data: conv } = await supabaseAdmin
    .from('wa_conversations')
    .select('id')
    .eq('tenant_id', auth.tenantId).eq('contact_id', contactId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (conv) {
    conversationId = conv.id as string
    await supabaseAdmin.from('wa_conversations')
      .update({ last_message_at: now, status: 'open' }).eq('id', conversationId)
  } else {
    const { data: nc } = await supabaseAdmin
      .from('wa_conversations')
      .insert({ tenant_id: auth.tenantId, wa_number_id: auth.waNumberId, contact_id: contactId, status: 'open', last_message_at: now })
      .select('id').maybeSingle()
    conversationId = (nc?.id as string) || null
  }

  // Simpan pesan masuk — FIX: sertakan contact_id (sebelumnya hilang → stats 0)
  await supabaseAdmin.from('wa_messages').insert({
    tenant_id: auth.tenantId,
    conversation_id: conversationId,
    contact_id: contactId,
    wa_message_id: waMessageId,
    direction: 'in',
    type,
    body: bodyText,
    sender: 'contact',
  })

  // AI auto-reply per-tenant — skip kalau pesan ini command opt-out (STOP/MULAI).
  const isOptCmd = STOP_WORDS.includes(kw) || START_WORDS.includes(kw)
  if (!isOptCmd) await maybeAiReply(auth, phoneNumberId, conversationId, contactId, from)
}

// Balas otomatis pakai AI kalau tenant mengaktifkannya di ai_configs.
async function maybeAiReply(auth: NumberAuth, phoneNumberId: string, conversationId: string | null, contactId: string | undefined, to: string) {
  if (!conversationId) return

  const { data: cfg } = await supabaseAdmin
    .from('ai_configs').select('*').eq('tenant_id', auth.tenantId).maybeSingle()
  if (!cfg?.enabled) return

  // Cooldown: jangan balas kalau AI baru aja balas di percakapan ini.
  const cd = Number(cfg.cooldown_min) || 0
  if (cd > 0) {
    const since = new Date(Date.now() - cd * 60000).toISOString()
    const { data: recent } = await supabaseAdmin
      .from('wa_messages').select('id')
      .eq('conversation_id', conversationId).eq('sender', 'ai').gte('created_at', since)
      .limit(1).maybeSingle()
    if (recent) return
  }

  // Ambil riwayat percakapan utk konteks (pesan masuk td udah termasuk).
  const { data: hist } = await supabaseAdmin
    .from('wa_messages').select('direction, body')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true }).limit(14)
  const turns: Turn[] = (hist || [])
    .filter((m: any) => m.body)
    .map((m: any) => ({ role: m.direction === 'in' ? 'user' : 'assistant', content: String(m.body) }))

  const reply = await generateReply(cfg as AiConfig, turns)
  if (!reply) return

  const ok = await sendText(phoneNumberId, auth.accessToken, to, reply)
  await supabaseAdmin.from('wa_messages').insert({
    tenant_id: auth.tenantId,
    conversation_id: conversationId,
    contact_id: contactId,
    direction: 'out',
    type: 'text',
    body: reply,
    sender: 'ai',
    status: ok ? 'sent' : 'failed',
  })
  await supabaseAdmin.from('wa_conversations')
    .update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)
}
