import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

// POST — Upload logo workspace ke Supabase Storage.
// Path: tenant-assets/{tenant_id}/logo-{timestamp}.{ext}
// Returns: public URL
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: 'hanya admin yang bisa upload logo' }, { status: 403 })

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'invalid form data' }, { status: 400 })

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file wajib' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'format tidak didukung. Pakai PNG, JPG, WEBP, atau SVG.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'ukuran max 2 MB' }, { status: 400 })
  }

  const ext = file.type === 'image/svg+xml' ? 'svg' : (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${actor.tenantId}/logo-${Date.now()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadErr } = await supabaseAdmin.storage
    .from('tenant-assets')
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadErr) return NextResponse.json({ error: 'gagal upload: ' + uploadErr.message }, { status: 500 })

  const { data: pub } = supabaseAdmin.storage.from('tenant-assets').getPublicUrl(path)
  const publicUrl = pub.publicUrl

  // Hapus logo lama (kalau ada) — list semua file di folder tenant_id selain yang baru
  const { data: existing } = await supabaseAdmin.storage.from('tenant-assets').list(actor.tenantId)
  if (existing) {
    const toDelete = existing
      .filter(f => f.name.startsWith('logo-') && f.name !== path.split('/').pop())
      .map(f => `${actor.tenantId}/${f.name}`)
    if (toDelete.length > 0) {
      await supabaseAdmin.storage.from('tenant-assets').remove(toDelete).catch(() => null)
    }
  }

  // Update tenants.logo_url
  await supabaseAdmin
    .from('tenants')
    .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', actor.tenantId)

  return NextResponse.json({ ok: true, logo_url: publicUrl })
}

// DELETE — Hapus logo workspace
export async function DELETE(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: 'hanya admin' }, { status: 403 })

  const { data: existing } = await supabaseAdmin.storage.from('tenant-assets').list(actor.tenantId)
  if (existing) {
    const toDelete = existing.filter(f => f.name.startsWith('logo-')).map(f => `${actor.tenantId}/${f.name}`)
    if (toDelete.length > 0) await supabaseAdmin.storage.from('tenant-assets').remove(toDelete).catch(() => null)
  }

  await supabaseAdmin.from('tenants').update({ logo_url: null, updated_at: new Date().toISOString() }).eq('id', actor.tenantId)
  return NextResponse.json({ ok: true })
}
