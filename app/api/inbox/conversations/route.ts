import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('wa_conversations')
    .select('id, status, last_message_at, contact:wa_contacts(id, phone, name, opted_out)')
    .eq('tenant_id', actor.tenantId)
    .order('last_message_at', { ascending: false })
    .limit(100)

  return NextResponse.json({ conversations: data || [] })
}
