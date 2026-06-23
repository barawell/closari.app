import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Catatan: di PostgREST/Supabase, embed `wa_contacts(...)` SUDAH left join
  // secara default (contact = null kalau tidak ada). Tidak perlu `!left`.
  const { data, error } = await supabaseAdmin
    .from('wa_conversations')
    .select('id, status, last_message_at, tags, contact:wa_contacts(id, phone, name, opted_out, tags, last_order_at)')
    .eq('tenant_id', actor.tenantId)
    .order('last_message_at', { ascending: false })
    .limit(100)

  // Jangan telan error diam-diam: log + tetap balikan array kosong yg aman.
  if (error) {
    console.error('[inbox/conversations] query error:', error.message)
    return NextResponse.json({ conversations: [], error: error.message })
  }

  return NextResponse.json({ conversations: data || [] })
}
