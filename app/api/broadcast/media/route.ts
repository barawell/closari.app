import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB (batas aman gambar WhatsApp)

// POST — upload gambar untuk broadcast, balikin URL publik.
// multipart/form-data: file
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'invalid form data' }, { status: 400 })

  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file wajib' }, { status: 400 })

  const mime = file.type || ''
  if (!mime.startsWith('image/')) {
    return NextResponse.json({ error: 'Hanya gambar (JPG/PNG) yang didukung.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Ukuran gambar maksimal 5 MB.' }, { status: 400 })
  }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${actor.tenantId}/bc-${Date.now()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabaseAdmin.storage
    .from('wa-media').upload(path, buf, { contentType: mime, upsert: true })
  if (upErr) return NextResponse.json({ error: 'gagal upload: ' + upErr.message }, { status: 500 })

  const { data: pub } = supabaseAdmin.storage.from('wa-media').getPublicUrl(path)
  return NextResponse.json({ ok: true, image_url: pub.publicUrl })
}
