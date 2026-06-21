import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('conversation_id')
  if (!id) return NextResponse.json({ error: 'conversation_id wajib' }, { status: 400 })

  const { data } = await supabaseAdmin
    .from('wa_messages')
    .select('id, direction, type, body, media_url, sender, status, created_at')
    .eq('tenant_id', actor.tenantId)
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(200)

  return NextResponse.json({ messages: data || [] })
}
