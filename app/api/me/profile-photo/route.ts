import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

// POST — Upload foto profil PERSONAL. Setiap member boleh ganti fotonya sendiri
// (TIDAK perlu admin). Disimpan di tenant-assets/{tenant_id}/avatar-{user_id}.{ext}
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'invalid form data' }, { status: 400 })

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file wajib' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'format tidak didukung. Pakai PNG, JPG, atau WEBP.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'ukuran max 2 MB' }, { status: 400 })
  }

  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${actor.tenantId}/avatar-${actor.userId}-${Date.now()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadErr } = await supabaseAdmin.storage
    .from('tenant-assets')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true })

  if (uploadErr) return NextResponse.json({ error: 'gagal upload: ' + uploadErr.message }, { status: 500 })

  const { data: pub } = supabaseAdmin.storage.from('tenant-assets').getPublicUrl(path)
  const publicUrl = pub.publicUrl

  // Hapus avatar lama user ini (biar storage gak numpuk)
  const { data: existing } = await supabaseAdmin.storage.from('tenant-assets').list(actor.tenantId)
  if (existing) {
    const prefix = `avatar-${actor.userId}-`
    const newName = path.split('/').pop()
    const toDelete = existing
      .filter(f => f.name.startsWith(prefix) && f.name !== newName)
      .map(f => `${actor.tenantId}/${f.name}`)
    if (toDelete.length > 0) await supabaseAdmin.storage.from('tenant-assets').remove(toDelete).catch(() => null)
  }

  // Simpan ke tenant_members.avatar_url
  const { error: updErr } = await supabaseAdmin
    .from('tenant_members')
    .update({ avatar_url: publicUrl })
    .eq('user_id', actor.userId)
    .eq('tenant_id', actor.tenantId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, avatar_url: publicUrl })
}

// DELETE — Hapus foto profil personal
export async function DELETE(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: existing } = await supabaseAdmin.storage.from('tenant-assets').list(actor.tenantId)
  if (existing) {
    const prefix = `avatar-${actor.userId}-`
    const toDelete = existing.filter(f => f.name.startsWith(prefix)).map(f => `${actor.tenantId}/${f.name}`)
    if (toDelete.length > 0) await supabaseAdmin.storage.from('tenant-assets').remove(toDelete).catch(() => null)
  }

  await supabaseAdmin.from('tenant_members')
    .update({ avatar_url: null })
    .eq('user_id', actor.userId).eq('tenant_id', actor.tenantId)

  return NextResponse.json({ ok: true })
}
