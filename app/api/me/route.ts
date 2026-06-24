import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor) return NextResponse.json({ authenticated: false }, { status: 401 })

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { data: { user } } = await anon.auth.getUser(token)
  const email = (user?.email || '').toLowerCase()

  // ── Terima undangan yang pending utk email ini (auto-join workspace) ──
  if (email) {
    const { data: invites } = await supabaseAdmin
      .from('tenant_invites').select('id, tenant_id, role').eq('email', email).is('accepted_at', null)
    for (const inv of invites || []) {
      const { data: exists } = await supabaseAdmin
        .from('tenant_members').select('user_id')
        .eq('user_id', actor.userId).eq('tenant_id', inv.tenant_id).maybeSingle()
      if (!exists) {
        await supabaseAdmin.from('tenant_members').insert({
          user_id: actor.userId, tenant_id: inv.tenant_id, role: inv.role || 'agent', email,
        })
      }
      await supabaseAdmin.from('tenant_invites').update({ accepted_at: new Date().toISOString() }).eq('id', inv.id)
    }
  }

  // Display name + avatar tenant aktif
  let displayName: string | null = null
  let avatarUrl: string | null = null
  if (actor.tenantId) {
    const { data: m } = await supabaseAdmin
      .from('tenant_members').select('display_name, avatar_url')
      .eq('user_id', actor.userId).eq('tenant_id', actor.tenantId).maybeSingle()
    displayName = m?.display_name || null
    avatarUrl = m?.avatar_url || null
  }

  // Tenant aktif
  let tenant = null
  if (actor.tenantId) {
    const { data } = await supabaseAdmin.from('tenants').select('id, name, slug, plan, logo_url').eq('id', actor.tenantId).maybeSingle()
    tenant = data
  }

  // SEMUA workspace user (buat tenant switcher)
  const { data: memberships } = await supabaseAdmin
    .from('tenant_members')
    .select('tenant_id, role, tenants(id, name, logo_url)')
    .eq('user_id', actor.userId)
  const tenants = (memberships || []).map((m: any) => ({
    id: m.tenant_id,
    role: m.role,
    name: m.tenants?.name || 'Workspace',
    logo_url: m.tenants?.logo_url || null,
  }))

  return NextResponse.json({
    authenticated: true,
    userId: actor.userId,
    email: user?.email || '',
    displayName,
    avatarUrl,
    role: actor.role,
    tenant,
    tenants,
  })
}

// PUT — update display name user di tenant aktif
export async function PUT(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const displayName = (b.display_name || '').trim().slice(0, 80)

  const { error } = await supabaseAdmin
    .from('tenant_members')
    .update({ display_name: displayName || null })
    .eq('user_id', actor.userId).eq('tenant_id', actor.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
