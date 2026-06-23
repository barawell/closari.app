import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendText } from '@/lib/wa'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const conversationId = body.conversation_id as string
  const text = (body.text || '').trim()
  if (!conversationId || !text) return NextResponse.json({ error: 'conversation_id & text wajib' }, { status: 400 })

  const { data: conv } = await supabaseAdmin
    .from('wa_conversations')
    .select('id, wa_number_id, contact_id, last_message_at, contact:wa_contacts(phone)')
    .eq('tenant_id', actor.tenantId).eq('id', conversationId).maybeSingle()
  const contact: any = conv?.contact
  const to = Array.isArray(contact) ? contact[0]?.phone : contact?.phone
  if (!conv || !to) return NextResponse.json({ error: 'percakapan tidak ditemukan' }, { status: 404 })

  const { data: num } = await supabaseAdmin
    .from('wa_numbers').select('id, phone_number_id').eq('id', conv.wa_number_id).eq('tenant_id', actor.tenantId).maybeSingle()
  if (!num) return NextResponse.json({ error: 'nomor pengirim tidak ada' }, { status: 400 })
  const { data: sec } = await supabaseAdmin
    .from('wa_number_secrets').select('access_token').eq('wa_number_id', num.id).maybeSingle()
  if (!sec?.access_token) return NextResponse.json({ error: 'token nomor tidak ada' }, { status: 400 })

  const r = await sendText(num.phone_number_id as string, sec.access_token as string, to, text)

  await supabaseAdmin.from('wa_messages').insert({
    tenant_id: actor.tenantId,
    conversation_id: conversationId,
    contact_id: conv.contact_id,
    wa_message_id: r.waMessageId,
    direction: 'out',
    type: 'text',
    body: text,
    sender: 'agent',
    status: r.ok ? 'sent' : 'failed',
  })
  await supabaseAdmin.from('wa_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)

  if (!r.ok) {
    // Error 131047 / window = di luar 24 jam → kasih pesan jelas
    const msg = (r.error || '').toLowerCase()
    const friendly = msg.includes('24') || msg.includes('window') || msg.includes('re-engag') || msg.includes('131047')
      ? 'Di luar window 24 jam. Customer harus chat dulu, atau kirim lewat Template resmi di menu Broadcast.'
      : (r.error || 'Gagal kirim. Cek token / nomor.')
    return NextResponse.json({ error: friendly }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
