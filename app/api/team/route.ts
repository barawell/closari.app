import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
const ADMIN_ROLES = ['admin', 'owner']

// App URL untuk redirect link invite (set di env atau fallback)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://closari-app-ogl6.vercel.app'

// GET: daftar anggota + undangan pending di tenant aktif
export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: members } = await supabaseAdmin
    .from('tenant_members')
    .select('user_id, email, role, display_name, created_at')
    .eq('tenant_id', actor.tenantId)
    .order('created_at', { ascending: true })

  const { data: invites } = await supabaseAdmin
    .from('tenant_invites')
    .select('id, email, role, created_at')
    .eq('tenant_id', actor.tenantId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    members: members || [],
    invites: invites || [],
    me: { userId: actor.userId, role: actor.role },
    can_manage: ADMIN_ROLES.includes(actor.role || ''),
  })
}

// POST: undang anggota baru (admin only). body { email, role }
// Kirim email invite via Supabase Auth → invitee dapat magic link → set password → join workspace.
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!ADMIN_ROLES.includes(actor.role || '')) {
    return NextResponse.json({ error: 'Hanya admin yang bisa mengundang.' }, { status: 403 })
  }

  const b = await req.json().catch(() => ({}))
  const email = String(b.email || '').trim().toLowerCase()
  const role = ['admin', 'agent'].includes(b.role) ? b.role : 'agent'
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email tidak valid.' }, { status: 400 })
  }

  // Sudah jadi anggota?
  const { data: already } = await supabaseAdmin
    .from('tenant_members').select('user_id')
    .eq('tenant_id', actor.tenantId).eq('email', email).maybeSingle()
  if (already) return NextResponse.json({ error: 'Email ini sudah jadi anggota.' }, { status: 409 })

  // Ambil nama workspace untuk tampil di email
  const { data: tenant } = await supabaseAdmin
    .from('tenants').select('name').eq('id', actor.tenantId).maybeSingle()
  const tenantName = tenant?.name || 'Closari Workspace'

  // Simpan invite row dulu (upsert: kalau udah ada pending, update role-nya)
  const { error: invErr } = await supabaseAdmin
    .from('tenant_invites')
    .upsert(
      { tenant_id: actor.tenantId, email, role, invited_by: actor.userId, accepted_at: null },
      { onConflict: 'tenant_id,email' },
    )
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })

  // Kirim email via Supabase Auth inviteUserByEmail.
  // - Kalau user belum ada: dibuatkan akun + link set-password dikirim.
  // - Kalau sudah ada: dikirim magic link login langsung.
  // - redirectTo: halaman terima invite (sudah ada di /accept-invite).
  const redirectTo = `${APP_URL}/accept-invite?tenant_id=${actor.tenantId}&role=${role}`

  const { error: authErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      tenant_id: actor.tenantId,
      role,
      tenant_name: tenantName,
    },
  })

  if (authErr) {
    // Kalau gagal kirim email (mis. rate limit Supabase), invite row tetap ada.
    // Beritahu caller tapi jangan rollback — bisa kirim ulang.
    return NextResponse.json({
      ok: false,
      email,
      role,
      warning: 'Invite tersimpan, tapi email gagal dikirim: ' + authErr.message,
      hint: 'Coba undang ulang, atau minta invitee daftar manual di ' + APP_URL,
    }, { status: 207 })
  }

  return NextResponse.json({
    ok: true,
    email,
    role,
    note: `Email undangan dikirim ke ${email}. Mereka akan dapat link untuk set password & langsung masuk ke ${tenantName}.`,
  })
}
