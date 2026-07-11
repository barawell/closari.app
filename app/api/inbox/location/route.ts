import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendLocation } from '@/lib/wa'

export const dynamic = 'force-dynamic'

// POST — kirim pin lokasi ke customer.
// body: { conversation_id, latitude, longitude, name?, address? }
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const conversationId = (b.conversation_id || '').trim()
  const latitude = Number(b.latitude)
  const longitude = Number(b.longitude)
  const name = (b.name || '').trim()
  const address = (b.address || '').trim()

  if (!conversationId) return NextResponse.json({ error: 'conversation_id wajib' }, { status: 400 })
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return NextResponse.json({ error: 'latitude tidak valid' }, { status: 400 })
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: 'longitude tidak valid' }, { status: 400 })
  }

  const { data: conv } = await supabaseAdmin
    .from('wa_conversations')
    .select('id, wa_number_id, contact_id, contact:wa_contacts(phone)')
    .eq('tenant_id', actor.tenantId).eq('id', conversationId).maybeSingle()
  const contactObj: any = conv?.contact
  const to = Array.isArray(contactObj) ? contactObj[0]?.phone : contactObj?.phone
  if (!conv || !to) return NextResponse.json({ error: 'percakapan tidak ditemukan' }, { status: 404 })

  const { data: num } = await supabaseAdmin
    .from('wa_numbers').select('id, phone_number_id')
    .eq('id', conv.wa_number_id).eq('tenant_id', actor.tenantId).maybeSingle()
  if (!num) return NextResponse.json({ error: 'nomor pengirim tidak ada' }, { status: 400 })

  const { data: sec } = await supabaseAdmin
    .from('wa_number_secrets').select('access_token').eq('wa_number_id', num.id).maybeSingle()
  if (!sec?.access_token) return NextResponse.json({ error: 'token nomor tidak ada' }, { status: 400 })

  const r = await sendLocation(num.phone_number_id as string, sec.access_token as string, to, {
    latitude, longitude, name: name || undefined, address: address || undefined,
  })

  const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`
  const label = [name, address].filter(Boolean).join(' — ')

  await supabaseAdmin.from('wa_messages').insert({
    tenant_id: actor.tenantId,
    conversation_id: conversationId,
    contact_id: conv.contact_id,
    wa_message_id: r.waMessageId,
    direction: 'out',
    type: 'location',
    body: label || `${latitude},${longitude}`,
    media_url: mapUrl,
    media_mime: 'geo/location',
    sender: 'agent',
    status: r.ok ? 'sent' : 'failed',
  })
  await supabaseAdmin.from('wa_conversations')
    .update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)

  if (!r.ok) {
    const msg = (r.error || '').toLowerCase()
    const friendly = msg.includes('24') || msg.includes('window') || msg.includes('re-engag')
      ? 'Di luar window 24 jam. Customer harus chat dulu sebelum bisa dikirimi lokasi.'
      : (r.error || 'Gagal kirim lokasi.')
    return NextResponse.json({ error: friendly }, { status: 502 })
  }
  return NextResponse.json({ ok: true, map_url: mapUrl })
}
