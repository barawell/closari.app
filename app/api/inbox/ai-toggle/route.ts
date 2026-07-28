import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// POST { conversation_id, paused }  — ambil alih (true) / kembalikan ke AI (false)
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const conversationId = (b.conversation_id || '').trim()
  const paused = !!b.paused
  if (!conversationId) return NextResponse.json({ error: 'conversation_id wajib' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('wa_conversations')
    .update({ ai_paused: paused })
    .eq('id', conversationId).eq('tenant_id', actor.tenantId)

  if (error) {
    return NextResponse.json({
      error: 'Kolom ai_paused belum ada. Jalankan SQL ai_takeover dulu.',
    }, { status: 500 })
  }
  return NextResponse.json({ ok: true, paused })
}
