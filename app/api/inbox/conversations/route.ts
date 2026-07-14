import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const PAGE = 50

// GET /api/inbox/conversations?offset=0&q=
//   q kosong → daftar percakapan terbaru (paginated → bisa "muat lebih banyak")
//   q ada    → cari di NAMA, NOMOR, dan ISI PESAN (seluruh riwayat)
export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  const offset = Math.max(0, Number(url.searchParams.get('offset') || 0))
  const t = actor.tenantId

  // PENTING: jangan select `tags` dari wa_conversations (kolom itu tidak ada).
  const SELECT = 'id, status, last_message_at, contact:wa_contacts(id, phone, name, opted_out, tags, last_order_at)'

  // ── Mode CARI ────────────────────────────────────────────────
  if (q) {
    const like = `%${q}%`
    const digits = q.replace(/[^\d]/g, '')
    const convIds = new Set<string>()

    // 1) Cocokkan ke kontak: nama atau nomor
    const orParts = [`name.ilike.${like}`, `phone.ilike.${like}`]
    if (digits && digits !== q) orParts.push(`phone.ilike.%${digits}%`)
    const { data: cts } = await supabaseAdmin
      .from('wa_contacts').select('id').eq('tenant_id', t).or(orParts.join(',')).limit(300)
    const contactIds = (cts || []).map((c: any) => c.id)
    if (contactIds.length) {
      const { data: cvs } = await supabaseAdmin
        .from('wa_conversations').select('id').eq('tenant_id', t).in('contact_id', contactIds).limit(300)
      for (const c of cvs || []) convIds.add(c.id)
    }

    // 2) Cocokkan ke ISI PESAN (seluruh riwayat, bukan cuma yang ter-load)
    const { data: msgs } = await supabaseAdmin
      .from('wa_messages').select('conversation_id')
      .eq('tenant_id', t).ilike('body', like)
      .order('created_at', { ascending: false }).limit(500)
    for (const m of msgs || []) if (m.conversation_id) convIds.add(m.conversation_id)

    if (!convIds.size) return NextResponse.json({ conversations: [], has_more: false })

    const { data, error } = await supabaseAdmin
      .from('wa_conversations').select(SELECT)
      .eq('tenant_id', t).in('id', Array.from(convIds))
      .order('last_message_at', { ascending: false }).limit(200)
    if (error) return NextResponse.json({ conversations: [], has_more: false, error: error.message })
    return NextResponse.json({ conversations: data || [], has_more: false })
  }

  // ── Mode DAFTAR (paginated) ──────────────────────────────────
  const { data, error } = await supabaseAdmin
    .from('wa_conversations').select(SELECT)
    .eq('tenant_id', t)
    .order('last_message_at', { ascending: false })
    .range(offset, offset + PAGE - 1)

  if (error) {
    console.error('[inbox/conversations] query error:', error.message)
    const { data: convs, error: e2 } = await supabaseAdmin
      .from('wa_conversations').select('id, status, last_message_at, contact_id')
      .eq('tenant_id', t)
      .order('last_message_at', { ascending: false })
      .range(offset, offset + PAGE - 1)
    if (e2) return NextResponse.json({ conversations: [], has_more: false, error: e2.message })
    const ids = Array.from(new Set((convs || []).map((c: any) => c.contact_id).filter(Boolean)))
    let byId: Record<string, any> = {}
    if (ids.length) {
      const { data: cts } = await supabaseAdmin
        .from('wa_contacts').select('id, phone, name, opted_out, tags, last_order_at').in('id', ids)
      byId = Object.fromEntries((cts || []).map((c: any) => [c.id, c]))
    }
    const merged = (convs || []).map((c: any) => ({
      id: c.id, status: c.status, last_message_at: c.last_message_at,
      contact: c.contact_id ? (byId[c.contact_id] || null) : null,
    }))
    return NextResponse.json({ conversations: merged, has_more: merged.length === PAGE })
  }

  const rows = data || []
  return NextResponse.json({ conversations: rows, has_more: rows.length === PAGE })
}
