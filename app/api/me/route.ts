import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor) return NextResponse.json({ authenticated: false }, { status: 401 })

  // Ambil user email dari Supabase auth
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { data: { user } } = await anon.auth.getUser(token)

  // Display name + avatar dari tenant_members
  let displayName: string | null = null
  let avatarUrl: string | null = null
  if (actor.tenantId) {
    const { data: m } = await supabaseAdmin
      .from('tenant_members')
      .select('display_name, avatar_url')
      .eq('user_id', actor.userId)
      .eq('tenant_id', actor.tenantId)
      .maybeSingle()
    displayName = m?.display_name || null
    avatarUrl = m?.avatar_url || null
  }

  let tenant = null
  if (actor.tenantId) {
    const { data } = await supabaseAdmin.from('tenants').select('id, name, slug, plan, logo_url').eq('id', actor.tenantId).maybeSingle()
    tenant = data
  }
  return NextResponse.json({
    authenticated: true,
    userId: actor.userId,
    email: user?.email || '',
    displayName,
    avatarUrl,
    role: actor.role,
    tenant,
  })
}

// PUT — update display name user di tenant ini
export async function PUT(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const displayName = (b.display_name || '').trim().slice(0, 80)

  const { error } = await supabaseAdmin
    .from('tenant_members')
    .update({ display_name: displayName || null })
    .eq('user_id', actor.userId)
    .eq('tenant_id', actor.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
