import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// GET — Validate invite token, return info workspace
// Bisa diakses tanpa login (untuk preview sebelum signup/login).
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params

  const { data: invite } = await supabaseAdmin
    .from('tenant_invites')
    .select('id, tenant_id, email, role, status, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: 'Invite tidak ditemukan' }, { status: 404 })
  if (invite.status !== 'pending') return NextResponse.json({ error: 'Invite ini sudah ' + invite.status, status: invite.status }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) {
    await supabaseAdmin.from('tenant_invites').update({ status: 'expired' }).eq('id', invite.id)
    return NextResponse.json({ error: 'Invite sudah kedaluwarsa' }, { status: 410 })
  }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, name, logo_url')
    .eq('id', invite.tenant_id)
    .maybeSingle()

  return NextResponse.json({
    invite: { email: invite.email, role: invite.role, expires_at: invite.expires_at },
    tenant,
  })
}

// POST — Accept invite. User harus sudah login.
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params

  const authHeader = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!authHeader) return NextResponse.json({ error: 'login dulu untuk terima invite' }, { status: 401 })

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { data: { user } } = await anon.auth.getUser(authHeader)
  if (!user?.email) return NextResponse.json({ error: 'sesi tidak valid' }, { status: 401 })

  const { data: invite } = await supabaseAdmin
    .from('tenant_invites')
    .select('id, tenant_id, email, role, status, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: 'Invite tidak ditemukan' }, { status: 404 })
  if (invite.status !== 'pending') return NextResponse.json({ error: 'Invite ini sudah ' + invite.status }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) {
    await supabaseAdmin.from('tenant_invites').update({ status: 'expired' }).eq('id', invite.id)
    return NextResponse.json({ error: 'Invite sudah kedaluwarsa' }, { status: 410 })
  }
  if (invite.email !== user.email.toLowerCase()) {
    return NextResponse.json({ error: `Invite ini untuk email ${invite.email}. Login dengan email yang sesuai.` }, { status: 403 })
  }

  // Cek udah jadi member?
  const { data: existing } = await supabaseAdmin
    .from('tenant_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('tenant_id', invite.tenant_id)
    .maybeSingle()

  if (existing) {
    await supabaseAdmin.from('tenant_invites').update({ status: 'accepted', accepted_at: new Date().toISOString(), accepted_by: user.id }).eq('id', invite.id)
    return NextResponse.json({ ok: true, tenant_id: invite.tenant_id, already_member: true })
  }

  // Add as member
  const { error: insertErr } = await supabaseAdmin.from('tenant_members').insert({
    tenant_id: invite.tenant_id,
    user_id: user.id,
    role: invite.role,
  })
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Mark invite as accepted
  await supabaseAdmin.from('tenant_invites').update({
    status: 'accepted',
    accepted_at: new Date().toISOString(),
    accepted_by: user.id,
  }).eq('id', invite.id)

  return NextResponse.json({ ok: true, tenant_id: invite.tenant_id })
}
