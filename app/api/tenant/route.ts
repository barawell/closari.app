import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('tenants')
    .select('id, name, slug, plan, logo_url, created_at')
    .eq('id', actor.tenantId)
    .maybeSingle()

  return NextResponse.json({ tenant: data })
}

// PUT — Update nama workspace / logo URL. Hanya admin yang boleh.
export async function PUT(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: 'hanya admin yang bisa edit workspace' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const patch: any = { updated_at: new Date().toISOString() }
  if (typeof b.name === 'string') {
    const name = b.name.trim().slice(0, 80)
    if (!name) return NextResponse.json({ error: 'nama workspace wajib diisi' }, { status: 400 })
    patch.name = name
  }
  if (typeof b.logo_url === 'string') {
    patch.logo_url = b.logo_url.trim() || null
  }

  const { error } = await supabaseAdmin
    .from('tenants')
    .update(patch)
    .eq('id', actor.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
