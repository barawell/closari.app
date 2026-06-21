import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data } = await supabaseAdmin.from('ai_configs').select('*').eq('tenant_id', actor.tenantId).maybeSingle()
  return NextResponse.json({ config: data || { tenant_id: actor.tenantId, enabled: false } })
}

export async function PUT(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const patch = {
    tenant_id: actor.tenantId,
    enabled: !!b.enabled,
    persona_name: b.persona_name || null,
    system_prompt: b.system_prompt || null,
    model: b.model || 'claude-haiku-4-5',
    cooldown_min: Number.isFinite(+b.cooldown_min) ? +b.cooldown_min : 0,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabaseAdmin.from('ai_configs').upsert(patch, { onConflict: 'tenant_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
