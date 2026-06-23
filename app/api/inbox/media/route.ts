import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendMediaByUrl } from '@/lib/wa'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_SIZE = 16 * 1024 * 1024 // 16 MB (limit WhatsApp utk dokumen)

function kindFromMime(mime: string): 'image' | 'document' | 'video' | 'audio' {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}

// POST — kirim file (foto / dokumen / invoice / video) ke customer.
// multipart/form-data: file, conversation_id, caption?
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'invalid form data' }, { status: 400 })

  const file = form.get('file') as File | null
  const conversationId = (form.get('conversation_id') as string) || ''
  const caption = ((form.get('caption') as string) || '').trim()
  if (!file) return NextResponse.json({ error: 'file wajib' }, { status: 400 })
  if (!conversationId) return NextResponse.json({ error: 'conversation_id wajib' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'ukuran file maks 16 MB' }, { status: 400 })

  // Percakapan + nomor + token
  const { data: conv } = await supabaseAdmin
    .from('wa_conversations')
    .select('id, wa_number_id, contact_id, contact:wa_contacts(phone)')
    .eq('tenant_id', actor.tenantId).eq('id', conversationId).maybeSingle()
  const contactObj: any = conv?.contact
  const to = Array.isArray(contactObj) ? contactObj[0]?.phone : contactObj?.phone
  if (!conv || !to) return NextResponse.json({ error: 'percakapan tidak ditemukan' }, { status: 404 })

  const { data: num } = await supabaseAdmin
    .from('wa_numbers').select('id, phone_number_id').eq('id', conv.wa_number_id).eq('tenant_id', actor.tenantId).maybeSingle()
  if (!num) return NextResponse.json({ error: 'nomor pengirim tidak ada' }, { status: 400 })
  const { data: sec } = await supabaseAdmin
    .from('wa_number_secrets').select('access_token').eq('wa_number_id', num.id).maybeSingle()
  if (!sec?.access_token) return NextResponse.json({ error: 'token nomor tidak ada' }, { status: 400 })

  // Upload ke Storage (wa-media, public) → dapat URL → kirim via link
  const mime = file.type || 'application/octet-stream'
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const path = `${actor.tenantId}/out-${Date.now()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabaseAdmin.storage
    .from('wa-media').upload(path, buf, { contentType: mime, upsert: true })
  if (upErr) return NextResponse.json({ error: 'gagal upload: ' + upErr.message }, { status: 500 })
  const { data: pub } = supabaseAdmin.storage.from('wa-media').getPublicUrl(path)
  const publicUrl = pub.publicUrl

  const kind = kindFromMime(mime)
  const r = await sendMediaByUrl(num.phone_number_id as string, sec.access_token as string, to, kind, publicUrl, {
    caption: caption || undefined,
    filename: kind === 'document' ? file.name : undefined,
  })

  await supabaseAdmin.from('wa_messages').insert({
    tenant_id: actor.tenantId,
    conversation_id: conversationId,
    contact_id: conv.contact_id,
    wa_message_id: r.waMessageId,
    direction: 'out',
    type: kind,
    body: caption || '',
    media_url: publicUrl,
    media_mime: mime,
    media_filename: file.name,
    sender: 'agent',
    status: r.ok ? 'sent' : 'failed',
  })
  await supabaseAdmin.from('wa_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)

  if (!r.ok) {
    const msg = (r.error || '').toLowerCase()
    const friendly = msg.includes('24') || msg.includes('window') || msg.includes('re-engag')
      ? 'Di luar window 24 jam. Customer harus chat dulu sebelum bisa dikirimi file.'
      : (r.error || 'Gagal kirim file.')
    return NextResponse.json({ error: friendly }, { status: 502 })
  }
  return NextResponse.json({ ok: true, media_url: publicUrl })
}
