import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (actor.tenantId) return NextResponse.json({ error: 'sudah punya tenant', tenantId: actor.tenantId }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const name = (body.name || '').trim()
  if (!name) return NextResponse.json({ error: 'nama bisnis wajib diisi' }, { status: 400 })

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + Math.random().toString(36).slice(2, 6)

  const { data: tenant, error } = await supabaseAdmin
    .from('tenants').insert({ name, slug }).select('id').maybeSingle()
  if (error || !tenant) return NextResponse.json({ error: error?.message || 'gagal buat tenant' }, { status: 500 })

  await supabaseAdmin.from('tenant_members').insert({ tenant_id: tenant.id, user_id: actor.userId, role: 'owner' })
  await supabaseAdmin.from('ai_configs').insert({ tenant_id: tenant.id, enabled: false }).select().maybeSingle()

  return NextResponse.json({ ok: true, tenantId: tenant.id })
}
