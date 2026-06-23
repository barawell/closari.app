import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'workspace'
}

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

// POST — Buat workspace baru. Pembuat otomatis jadi ADMIN.
export async function POST(req: Request) {
  // Validasi token → user (tanpa butuh tenant, karena ini lagi bikin tenant pertama)
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { data: { user } } = await anon.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const name = (b.name || '').trim().slice(0, 80)
  if (!name) return NextResponse.json({ error: 'nama workspace wajib diisi' }, { status: 400 })

  // Slug unik
  let slug = slugify(name)
  const { data: existsSlug } = await supabaseAdmin.from('tenants').select('id').eq('slug', slug).maybeSingle()
  if (existsSlug) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`

  // Buat tenant
  const { data: tenant, error: tErr } = await supabaseAdmin
    .from('tenants')
    .insert({ name, slug, plan: 'free' })
    .select('id')
    .maybeSingle()
  if (tErr || !tenant) return NextResponse.json({ error: tErr?.message || 'gagal buat workspace' }, { status: 500 })

  // Pembuat = ADMIN (ini yang sebelumnya hilang → bikin role kebaca "agent")
  const { error: mErr } = await supabaseAdmin
    .from('tenant_members')
    .insert({ tenant_id: tenant.id, user_id: user.id, role: 'admin' })
  if (mErr) {
    // rollback tenant biar gak ada workspace yatim
    await supabaseAdmin.from('tenants').delete().eq('id', tenant.id)
    return NextResponse.json({ error: mErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, tenant_id: tenant.id })
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
