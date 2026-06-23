import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// GET — list semua member workspace + list pending invites
export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: members } = await supabaseAdmin
    .from('v_tenant_members')
    .select('user_id, email, display_name, role, created_at, last_sign_in_at')
    .eq('tenant_id', actor.tenantId)
    .order('created_at', { ascending: true })

  const { data: invites } = await supabaseAdmin
    .from('tenant_invites')
    .select('id, email, role, status, expires_at, created_at, token')
    .eq('tenant_id', actor.tenantId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  return NextResponse.json({
    members: members || [],
    invites: invites || [],
    current_user_id: actor.userId,
    current_role: actor.role,
  })
}

// POST — bikin invite baru
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: 'hanya admin yang bisa undang member' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const email = (b.email || '').trim().toLowerCase()
  const role = b.role === 'admin' ? 'admin' : 'agent'

  if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 })
  }

  // Cek apakah email udah jadi member
  const { data: existingMember } = await supabaseAdmin
    .from('v_tenant_members')
    .select('email')
    .eq('tenant_id', actor.tenantId)
    .eq('email', email)
    .maybeSingle()

  if (existingMember) {
    return NextResponse.json({ error: 'Email ini sudah jadi member workspace.' }, { status: 400 })
  }

  // Revoke pending invite yang udah ada
  await supabaseAdmin
    .from('tenant_invites')
    .update({ status: 'revoked' })
    .eq('tenant_id', actor.tenantId)
    .eq('email', email)
    .eq('status', 'pending')

  const token = crypto.randomBytes(24).toString('hex')

  const { data: invite, error } = await supabaseAdmin.from('tenant_invites').insert({
    tenant_id: actor.tenantId,
    email,
    role,
    token,
    invited_by: actor.userId,
    status: 'pending',
  }).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const origin = req.headers.get('origin') || 'https://closari-app-ogl6.vercel.app'
  const inviteLink = `${origin}/accept-invite?token=${token}`

  return NextResponse.json({ ok: true, invite, invite_link: inviteLink })
}
