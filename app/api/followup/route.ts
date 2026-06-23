import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Klasifikasi customer (untuk voucher per kategori — meeting note #4b):
//  loyal      : order_count >= 3
//  lapsed     : pernah order tapi > 60 hari gak order
//  one_time   : baru order 1x, belum repeat
//  new        : belum pernah order tapi sudah kontak
//  prospect   : belum pernah transaksi
function classify(c: any): string {
  const orders = c.order_count || 0
  const lastOrder = c.last_order_at ? new Date(c.last_order_at).getTime() : null
  const daysSince = lastOrder ? (Date.now() - lastOrder) / 86400000 : null
  if (orders >= 3) return 'loyal'
  if (orders >= 1 && daysSince !== null && daysSince > 60) return 'lapsed'
  if (orders === 1) return 'one_time'
  if (c.last_message_at) return 'new'
  return 'prospect'
}

// GET /api/followup                 → daftar "Perlu Follow Up" (status = 'baru')
// GET /api/followup?view=today      → customer yang sudah di-FU hari ini
// GET /api/followup?view=all        → semua kontak + klasifikasi
export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const view = new URL(req.url).searchParams.get('view') || 'pending'

  if (view === 'today') {
    // Aktivitas follow-up hari ini (tarik data customer harian — meeting note #4)
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const { data: acts } = await supabaseAdmin
      .from('followup_activities')
      .select('id, action, note, created_at, contact:wa_contacts(id, name, phone, followup_status)')
      .eq('tenant_id', actor.tenantId)
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: false })
      .limit(500)
    return NextResponse.json({
      activities: (acts || []).map((a: any) => ({
        id: a.id, action: a.action, note: a.note, created_at: a.created_at,
        contact: Array.isArray(a.contact) ? a.contact[0] : a.contact,
      })),
    })
  }

  // pending atau all
  let q = supabaseAdmin.from('wa_contacts')
    .select('id, name, phone, followup_status, last_message_at, last_order_at, order_count, opted_out, tags')
    .eq('tenant_id', actor.tenantId)

  if (view === 'pending') {
    // Hanya yang BELUM di-approach. Yang sudah "terkontak" hilang dari sini
    // biar gak terjadi follow-up ganda (meeting note #5).
    q = q.eq('followup_status', 'baru')
  }

  const { data: contacts } = await q
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(500)

  return NextResponse.json({
    contacts: (contacts || []).map((c: any) => ({ ...c, category: classify(c) })),
  })
}

// POST /api/followup → tandai kontak sudah di-FU + catat aktivitas
// body: { contact_id, action?: 'contacted'|'note', note?, status? }
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const contactId = b.contact_id as string
  if (!contactId) return NextResponse.json({ error: 'contact_id wajib' }, { status: 400 })

  // Pastikan kontak milik tenant ini
  const { data: contact } = await supabaseAdmin
    .from('wa_contacts').select('id').eq('id', contactId).eq('tenant_id', actor.tenantId).maybeSingle()
  if (!contact) return NextResponse.json({ error: 'kontak tidak ditemukan' }, { status: 404 })

  const action = b.action === 'note' ? 'note' : 'contacted'
  const note = (b.note || '').trim().slice(0, 1000) || null
  const now = new Date().toISOString()

  // Kalau action = contacted → ubah status jadi "terkontak" (hilang dari pending)
  if (action === 'contacted') {
    const newStatus = b.status && ['baru', 'terkontak', 'selesai'].includes(b.status) ? b.status : 'terkontak'
    await supabaseAdmin.from('wa_contacts')
      .update({ followup_status: newStatus, followup_contacted_at: now, followup_contacted_by: actor.userId })
      .eq('id', contactId).eq('tenant_id', actor.tenantId)
  }

  // Catat aktivitas (riwayat per customer)
  await supabaseAdmin.from('followup_activities').insert({
    tenant_id: actor.tenantId,
    contact_id: contactId,
    user_id: actor.userId,
    action,
    note,
  })

  return NextResponse.json({ ok: true })
}
