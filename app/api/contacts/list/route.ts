// app/api/contacts/list/route.ts
// Daftar kontak untuk pemilihan penerima broadcast.
// Query: ?segment=all|loyal|new & ?q=cari & ?engaged=1
// Balikan: { contacts: [{id, phone, name, segment, opted_out}], total }

import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
const ENGAGED_WINDOW_DAYS = 60

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const u = new URL(req.url)
  const segment = (u.searchParams.get('segment') || 'all').toLowerCase()
  const q = (u.searchParams.get('q') || '').trim()
  const engaged = u.searchParams.get('engaged') === '1'

  let query = supabaseAdmin.from('wa_contacts')
    .select('id, phone, name, opted_out, last_message_at, last_order_at, order_count')
    .eq('tenant_id', actor.tenantId)
    .order('last_message_at', { ascending: false })
    .limit(5000)

  if (engaged) {
    const since = new Date(Date.now() - ENGAGED_WINDOW_DAYS * 86400000).toISOString()
    query = query.gte('last_message_at', since)
  }
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)

  const { data } = await query

  const mapped = (data || []).map((c: any) => {
    const isLoyal = (c.order_count && c.order_count > 0) || !!c.last_order_at
    return { id: c.id, phone: c.phone, name: c.name, opted_out: c.opted_out, segment: isLoyal ? 'loyal' : 'new' }
  }).filter((c: any) => {
    if (segment === 'loyal') return c.segment === 'loyal'
    if (segment === 'new') return c.segment === 'new'
    return true
  })

  return NextResponse.json({ contacts: mapped, total: mapped.length })
}
