import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Ambil SEMUA baris (paginate, karena Supabase batasi 1000/permintaan).
async function fetchAll(table: string, tenantId: string, columns = '*'): Promise<any[]> {
  const out: any[] = []
  const size = 1000
  let from = 0
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from(table).select(columns).eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }).range(from, from + size - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < size) break
    from += size
  }
  return out
}

function toCsv(rows: any[]): string {
  if (!rows.length) return '\ufeff(tidak ada data)'
  const headerSet = new Set<string>()
  for (const r of rows) Object.keys(r).forEach(k => headerSet.add(k))
  const headers = Array.from(headerSet)
  const esc = (v: any) => {
    if (v === null || v === undefined) return ''
    let s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  const lines = [headers.join(',')]
  for (const r of rows) lines.push(headers.map(h => esc(r[h])).join(','))
  return '\ufeff' + lines.join('\n')
}

// Kontak diperkaya untuk segmentasi: aktivitas chat + performa broadcast per kontak.
async function buildSegmentation(t: string): Promise<any[]> {
  const contacts = await fetchAll('wa_contacts', t, 'id, phone, name, tags, opted_out, order_count, last_order_at, last_message_at, followup_status, created_at')
  const msgs = await fetchAll('wa_messages', t, 'contact_id, direction, created_at')
  const recs = await fetchAll('broadcast_recipients', t, 'contact_id, status')

  const agg = new Map<string, { masuk: number; keluar: number; lastIn: string | null }>()
  for (const m of msgs) {
    if (!m.contact_id) continue
    const a = agg.get(m.contact_id) || { masuk: 0, keluar: 0, lastIn: null }
    if (m.direction === 'in') { a.masuk++; if (!a.lastIn || (m.created_at && m.created_at > a.lastIn)) a.lastIn = m.created_at }
    else a.keluar++
    agg.set(m.contact_id, a)
  }

  const bagg = new Map<string, { dikirim: number; dibaca: number; gagal: number }>()
  for (const r of recs) {
    if (!r.contact_id) continue
    const b = bagg.get(r.contact_id) || { dikirim: 0, dibaca: 0, gagal: 0 }
    if (r.status === 'failed') b.gagal++; else b.dikirim++
    if (r.status === 'read') b.dibaca++
    bagg.set(r.contact_id, b)
  }

  return contacts.map((c: any) => {
    const a = agg.get(c.id) || { masuk: 0, keluar: 0, lastIn: null }
    const b = bagg.get(c.id) || { dikirim: 0, dibaca: 0, gagal: 0 }
    return {
      nama: c.name || '',
      nomor: c.phone || '',
      tags: Array.isArray(c.tags) ? c.tags.join('; ') : (c.tags || ''),
      opted_out: c.opted_out ? 'ya' : 'tidak',
      jumlah_order: c.order_count ?? 0,
      terakhir_order: c.last_order_at || '',
      pesan_masuk: a.masuk,
      pesan_keluar: a.keluar,
      terakhir_chat_masuk: a.lastIn || '',
      terakhir_aktivitas: c.last_message_at || '',
      broadcast_dikirim: b.dikirim,
      broadcast_dibaca: b.dibaca,
      broadcast_gagal: b.gagal,
      followup_status: c.followup_status || '',
      terdaftar: c.created_at || '',
    }
  })
}

const TABLES: Record<string, { table: string; file: string }> = {
  contacts: { table: 'wa_contacts', file: 'kontak.csv' },
  messages: { table: 'wa_messages', file: 'pesan.csv' },
  conversations: { table: 'wa_conversations', file: 'percakapan.csv' },
  campaigns: { table: 'broadcast_campaigns', file: 'campaign_broadcast.csv' },
  recipients: { table: 'broadcast_recipients', file: 'broadcast_penerima.csv' },
}

// GET /api/export?type=segmentation|contacts|messages|conversations|campaigns|recipients
export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (actor.role !== 'admin' && actor.role !== 'owner') {
    return Response.json({ error: 'Export hanya untuk admin/owner workspace.' }, { status: 403 })
  }

  const type = new URL(req.url).searchParams.get('type') || 'segmentation'
  const t = actor.tenantId

  try {
    let rows: any[]
    let file: string
    if (type === 'segmentation') {
      rows = await buildSegmentation(t)
      file = 'segmentasi_customer.csv'
    } else if (TABLES[type]) {
      rows = await fetchAll(TABLES[type].table, t)
      file = TABLES[type].file
    } else {
      return Response.json({ error: 'type tidak dikenal' }, { status: 400 })
    }

    const csv = toCsv(rows)
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${file}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'gagal export' }, { status: 500 })
  }
}
