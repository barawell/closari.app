import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getNumberAuth, sendText, normalizePhone, downloadAndStoreMedia, type NumberAuth } from '@/lib/wa'
import { generateReply, type AiConfig, type Turn } from '@/lib/ai'
import { hasKnowledge } from '@/lib/halo-ai'

export const dynamic = 'force-dynamic'

const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || ''
const APP_SECRET   = process.env.META_APP_SECRET || ''

const STOP_WORDS  = ['STOP', 'BERHENTI', 'UNSUB', 'UNSUBSCRIBE', 'STOP PROMO', 'BERHENTI PROMO']
const START_WORDS = ['MULAI', 'LANGGANAN', 'START', 'SUBSCRIBE']

// ── GET: verifikasi webhook ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === VERIFY_TOKEN) {
    return new NextResponse(p.get('hub.challenge') || '', { status: 200 })
  }
  return new NextResponse('forbidden', { status: 403 })
}

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
  const sig = req.headers.get('x-hub-signature-256')
  if (!validSignature(raw, sig)) {
    console.error('[closari webhook] DITOLAK: signature tidak cocok. Cek META_APP_SECRET di Vercel. has_secret=' + !!APP_SECRET + ' has_sig=' + !!sig)
    return new NextResponse('bad signature', { status: 401 })
  }

  let body: any
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ ok: true }) }

  try {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {}
        const phoneNumberId: string | undefined = value?.metadata?.phone_number_id
        const nMsg = (value.messages || []).length
        const nStatus = (value.statuses || []).length
        console.log(`[closari webhook] event diterima: phone_number_id=${phoneNumberId} pesan=${nMsg} status=${nStatus}`)
        if (!phoneNumberId) continue

        const auth = await getNumberAuth(phoneNumberId)
        if (!auth) {
          console.error(`[closari webhook] DIABAIKAN: phone_number_id=${phoneNumberId} tidak terdaftar di wa_numbers / token kosong`)
          continue
        }

        const profileName: string | undefined = value?.contacts?.[0]?.profile?.name
        for (const msg of value.messages || []) {
          console.log(`[closari webhook] simpan pesan dari ${msg.from} type=${msg.type}`)
          await handleInbound(auth, phoneNumberId, msg, profileName)
        }
        for (const st of value.statuses || []) {
          await handleStatus(auth, st)
        }
      }
    }
  } catch (e) {
    console.error('[closari webhook] error:', e)
  }

  return NextResponse.json({ ok: true })
}

async function handleStatus(auth: NumberAuth, st: any) {
  const waId: string | undefined = st?.id
  const status: string | undefined = st?.status
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

  const type: string = msg.type || 'text'
  const isForwarded = !!(msg.context?.forwarded || msg.context?.frequently_forwarded)

  // Ekstrak teks + media
  let bodyText = ''
  let mediaUrl: string | null = null
  let mediaMime: string | undefined
  let mediaFilename: string | undefined

  if (type === 'text') {
    bodyText = msg.text?.body || ''
  } else if (type === 'button') {
    bodyText = msg.button?.text || ''
  } else if (type === 'interactive') {
    bodyText = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || ''
  } else if (type === 'image' || type === 'document' || type === 'video' || type === 'audio' || type === 'sticker' || type === 'voice') {
    const node = msg[type] || {}
    bodyText = node.caption || ''
    mediaFilename = node.filename
    if (node.id) {
      const dl = await downloadAndStoreMedia(auth.accessToken, auth.tenantId, node.id, node.mime_type)
      mediaUrl = dl.url
      mediaMime = dl.mime || node.mime_type
    }
  } else if (type === 'location') {
    const loc = msg.location || {}
    bodyText = `📍 Lokasi: ${loc.name || ''} ${loc.address || ''} (${loc.latitude},${loc.longitude})`.trim()
  } else if (type === 'contacts') {
    bodyText = '📇 Kartu kontak'
  } else {
    bodyText = `[${type}]`
  }

  const now = new Date().toISOString()

  // Upsert kontak
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

  // STOP / MULAI
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

  // Simpan pesan masuk (dengan media + flag forwarded)
  await supabaseAdmin.from('wa_messages').insert({
    tenant_id: auth.tenantId,
    conversation_id: conversationId,
    contact_id: contactId,
    wa_message_id: waMessageId,
    direction: 'in',
    type,
    body: bodyText,
    media_url: mediaUrl,
    media_mime: mediaMime,
    media_filename: mediaFilename,
    is_forwarded: isForwarded,
    sender: 'contact',
  })

  // AI auto-reply — skip command opt-out & skip kalau cuma media tanpa teks
  const isOptCmd = STOP_WORDS.includes(kw) || START_WORDS.includes(kw)
  if (!isOptCmd && bodyText.trim()) await maybeAiReply(auth, phoneNumberId, conversationId, contactId, from)
}

async function maybeAiReply(auth: NumberAuth, phoneNumberId: string, conversationId: string | null, contactId: string | undefined, to: string) {
  if (!conversationId) return

  const { data: cfg } = await supabaseAdmin
    .from('ai_configs').select('*').eq('tenant_id', auth.tenantId).maybeSingle()
  if (!cfg?.enabled) return
  // PENGAMAN: walau auto-reply ON, kalau knowledge base masih kosong, JANGAN balas
  // (mencegah AI mengarang). Isi knowledge dulu di menu Aira AI.
  if (!hasKnowledge(cfg as any)) {
    console.log('[closari ai] skip: knowledge base kosong, tenant', auth.tenantId)
    return
  }

  const cd = Number(cfg.cooldown_min) || 0
  if (cd > 0) {
    const since = new Date(Date.now() - cd * 60000).toISOString()
    const { data: recent } = await supabaseAdmin
      .from('wa_messages').select('id')
      .eq('conversation_id', conversationId).eq('sender', 'ai').gte('created_at', since)
      .limit(1).maybeSingle()
    if (recent) return
  }

  const { data: hist } = await supabaseAdmin
    .from('wa_messages').select('direction, body')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true }).limit(14)
  const turns: Turn[] = (hist || [])
    .filter((m: any) => m.body)
    .map((m: any) => ({ role: m.direction === 'in' ? 'user' : 'assistant', content: String(m.body) }))

  const reply = await generateReply(cfg as AiConfig, turns)
  if (!reply) return

  const r = await sendText(phoneNumberId, auth.accessToken, to, reply)
  await supabaseAdmin.from('wa_messages').insert({
    tenant_id: auth.tenantId,
    conversation_id: conversationId,
    contact_id: contactId,
    wa_message_id: r.waMessageId,
    direction: 'out',
    type: 'text',
    body: reply,
    sender: 'ai',
    status: r.ok ? 'sent' : 'failed',
  })
  await supabaseAdmin.from('wa_conversations')
    .update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)
}
