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

  // Ambil percakapan + kontak + nomor (tenant-scoped)
  const { data: conv } = await supabaseAdmin
    .from('wa_conversations')
    .select('id, wa_number_id, contact:wa_contacts(phone)')
    .eq('tenant_id', actor.tenantId).eq('id', conversationId).maybeSingle()
  const contact: any = conv?.contact
  const to = Array.isArray(contact) ? contact[0]?.phone : contact?.phone
  if (!conv || !to) return NextResponse.json({ error: 'percakapan tidak ditemukan' }, { status: 404 })

  // Ambil nomor pengirim + token
  const { data: num } = await supabaseAdmin
    .from('wa_numbers').select('id, phone_number_id').eq('id', conv.wa_number_id).eq('tenant_id', actor.tenantId).maybeSingle()
  if (!num) return NextResponse.json({ error: 'nomor pengirim tidak ada' }, { status: 400 })
  const { data: sec } = await supabaseAdmin
    .from('wa_number_secrets').select('access_token').eq('wa_number_id', num.id).maybeSingle()
  if (!sec?.access_token) return NextResponse.json({ error: 'token nomor tidak ada' }, { status: 400 })

  const ok = await sendText(num.phone_number_id as string, sec.access_token as string, to, text)

  await supabaseAdmin.from('wa_messages').insert({
    tenant_id: actor.tenantId,
    conversation_id: conversationId,
    direction: 'out',
    type: 'text',
    body: text,
    sender: 'agent',
    status: ok ? 'sent' : 'failed',
  })
  await supabaseAdmin.from('wa_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)

  if (!ok) return NextResponse.json({ error: 'Gagal kirim (cek window 24 jam / token).' }, { status: 502 })
  return NextResponse.json({ ok: true })
}
