// app/api/contacts/import/route.ts
// Import kontak massal dari CSV/Excel (sudah di-parse di client jadi array).
// body: { contacts: [{ phone, name? }] }
// Upsert by (tenant_id, phone). Nomor dinormalisasi ke 62xxxx.

import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizePhone } from '@/lib/wa'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const rows: any[] = Array.isArray(b.contacts) ? b.contacts : []
  if (!rows.length) return NextResponse.json({ error: 'Data kosong.' }, { status: 400 })

  // Bersihkan + dedupe by phone
  const byPhone = new Map<string, { tenant_id: string; phone: string; name?: string }>()
  let invalid = 0
  for (const r of rows) {
    const phone = normalizePhone(String(r.phone ?? r.nomor ?? r.no ?? r.hp ?? ''))
    if (!phone || phone.length < 9) { invalid++; continue }
    const name = String(r.name ?? r.nama ?? '').trim() || undefined
    byPhone.set(phone, { tenant_id: actor.tenantId, phone, name })
  }
  const payload = Array.from(byPhone.values())
  if (!payload.length) return NextResponse.json({ error: 'Tidak ada nomor valid.', invalid }, { status: 400 })

  // Upsert bertahap (batch 500) biar aman.
  let imported = 0
  for (let i = 0; i < payload.length; i += 500) {
    const chunk = payload.slice(i, i + 500).map((c) => ({
      ...c,
      last_message_at: c.name ? undefined : undefined, // jangan timpa last_message_at
      followup_status: 'baru',
    }))
    const { error } = await supabaseAdmin
      .from('wa_contacts')
      .upsert(chunk, { onConflict: 'tenant_id,phone', ignoreDuplicates: false })
    if (error) return NextResponse.json({ error: error.message, imported }, { status: 500 })
    imported += chunk.length
  }

  return NextResponse.json({ ok: true, imported, invalid, total: rows.length })
}
