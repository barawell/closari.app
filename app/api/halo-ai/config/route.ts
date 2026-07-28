import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('ai_configs')
    .select('*')
    .eq('tenant_id', actor.tenantId)
    .maybeSingle()

  return NextResponse.json({
    config: data || {
      tenant_id: actor.tenantId,
      enabled: false,
      persona_name: 'Aira',
      persona_role: null,
      system_prompt: null,
      business_info: null,
      products_info: null,
      faq_info: null,
      policy_info: null,
      repeat_order_mode: false,
      repeat_order_days_threshold: 30,
      repeat_order_message: null,
      cooldown_min: 0,
      model: 'claude-sonnet-5',
    }
  })
}

export async function PUT(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const patch: any = {
    tenant_id: actor.tenantId,
    enabled: !!b.enabled,
    persona_name: b.persona_name || 'Aira',
    persona_role: b.persona_role || null,
    system_prompt: b.system_prompt || null,
    business_info: b.business_info || null,
    products_info: b.products_info || null,
    faq_info: b.faq_info || null,
    policy_info: b.policy_info || null,
    repeat_order_mode: !!b.repeat_order_mode,
    repeat_order_days_threshold: Number.isFinite(+b.repeat_order_days_threshold) ? +b.repeat_order_days_threshold : 30,
    repeat_order_message: b.repeat_order_message || null,
    cooldown_min: Number.isFinite(+b.cooldown_min) ? +b.cooldown_min : 0,
    model: b.model || 'claude-sonnet-5',
    updated_at: new Date().toISOString(),
  }
  if (Number.isFinite(+b.human_takeover_min)) patch.human_takeover_min = +b.human_takeover_min
  let { error } = await supabaseAdmin.from('ai_configs').upsert(patch, { onConflict: 'tenant_id' })
  if (error && 'human_takeover_min' in patch) {
    // Kolom human_takeover_min mungkin belum ada → simpan tanpa itu (setting lain tetap tersimpan).
    delete patch.human_takeover_min
    const retry = await supabaseAdmin.from('ai_configs').upsert(patch, { onConflict: 'tenant_id' })
    error = retry.error
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
