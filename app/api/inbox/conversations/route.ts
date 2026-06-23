import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // PENTING: JANGAN select `tags` dari wa_conversations — kolom itu TIDAK ADA
  // di tabel. Kalau diminta, PostgREST error & inbox balik kosong walau pesan
  // sebenarnya tersimpan. `tags` yang dipakai UI itu milik CONTACT (wa_contacts).
  // Embed `wa_contacts(...)` sudah left-join default (contact null kalau kosong).
  const { data, error } = await supabaseAdmin
    .from('wa_conversations')
    .select('id, status, last_message_at, contact:wa_contacts(id, phone, name, opted_out, tags, last_order_at)')
    .eq('tenant_id', actor.tenantId)
    .order('last_message_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[inbox/conversations] query error:', error.message)
    // Fallback paling aman: ambil tanpa embed contact, lalu merge manual.
    const { data: convs, error: e2 } = await supabaseAdmin
      .from('wa_conversations')
      .select('id, status, last_message_at, contact_id')
      .eq('tenant_id', actor.tenantId)
      .order('last_message_at', { ascending: false })
      .limit(100)
    if (e2) {
      console.error('[inbox/conversations] fallback error:', e2.message)
      return NextResponse.json({ conversations: [], error: e2.message })
    }
    const ids = Array.from(new Set((convs || []).map((c: any) => c.contact_id).filter(Boolean)))
    let contactsById: Record<string, any> = {}
    if (ids.length) {
      const { data: cts } = await supabaseAdmin
        .from('wa_contacts')
        .select('id, phone, name, opted_out, tags, last_order_at')
        .in('id', ids)
      contactsById = Object.fromEntries((cts || []).map((c: any) => [c.id, c]))
    }
    const merged = (convs || []).map((c: any) => ({
      id: c.id, status: c.status, last_message_at: c.last_message_at,
      contact: c.contact_id ? (contactsById[c.contact_id] || null) : null,
    }))
    return NextResponse.json({ conversations: merged })
  }

  return NextResponse.json({ conversations: data || [] })
}
