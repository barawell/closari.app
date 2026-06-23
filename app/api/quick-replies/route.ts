import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('quick_replies')
    .select('*')
    .eq('tenant_id', actor.tenantId)
    .order('shortcut', { ascending: true })

  return NextResponse.json({ quick_replies: data || [] })
}

export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const shortcut = (b.shortcut || '').toLowerCase().replace(/[^a-z0-9-]/g, '').trim()
  const title = (b.title || '').trim()
  const body = (b.body || '').trim()
  if (!shortcut || !title || !body) return NextResponse.json({ error: 'shortcut, title, body wajib' }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('quick_replies').insert({
    tenant_id: actor.tenantId, shortcut, title, body,
  }).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quick_reply: data })
}

export async function PUT(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const id = b.id
  if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 })

  const patch: any = { updated_at: new Date().toISOString() }
  if (b.shortcut) patch.shortcut = (b.shortcut || '').toLowerCase().replace(/[^a-z0-9-]/g, '').trim()
  if (b.title) patch.title = b.title.trim()
  if (b.body) patch.body = b.body.trim()

  const { error } = await supabaseAdmin.from('quick_replies').update(patch).eq('id', id).eq('tenant_id', actor.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 })

  const { error } = await supabaseAdmin.from('quick_replies').delete().eq('id', id).eq('tenant_id', actor.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
