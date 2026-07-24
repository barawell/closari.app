// app/api/templates/upload-header/route.ts
// Upload gambar header untuk PENGAJUAN TEMPLATE.
//
// Meta tidak menerima URL biasa untuk contoh header template. Wajib pakai
// "Resumable Upload API" yang menghasilkan `header_handle`:
//   1) POST /{app_id}/uploads?file_name&file_length&file_type   -> { id: "upload:..." }
//   2) POST /{upload_id}  (header: Authorization: OAuth <token>, file_offset: 0)
//                                                              -> { h: "<handle>" }
// Handle itu dipakai di components[HEADER].example.header_handle saat create template.
//
// Gambar yang sama JUGA disimpan ke Supabase Storage supaya punya URL publik —
// URL ini dibutuhkan nanti waktu MENGIRIM template (parameter header image).

import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { getWabaAuth } from '@/lib/wa-account'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GRAPH = 'https://graph.facebook.com/v21.0'
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png']

// App ID diambil otomatis dari token (tidak perlu env var baru).
async function resolveAppId(token: string): Promise<string | null> {
  if (process.env.FB_APP_ID) return process.env.FB_APP_ID
  try {
    const res = await fetch(
      `${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`,
    )
    const j = await res.json().catch(() => ({}))
    const appId = j?.data?.app_id
    return appId ? String(appId) : null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'invalid form data' }, { status: 400 })

  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file wajib' }, { status: 400 })

  const mime = (file.type || '').toLowerCase()
  if (!ALLOWED.includes(mime)) {
    return NextResponse.json({ error: 'Header template hanya menerima JPG atau PNG.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Ukuran gambar maksimal 5 MB.' }, { status: 400 })
  }

  const auth = await getWabaAuth(actor.tenantId)
  if (!auth) return NextResponse.json({ error: 'WABA / token tidak ada. Hubungkan nomor dulu.' }, { status: 400 })

  const appId = await resolveAppId(auth.accessToken)
  if (!appId) {
    return NextResponse.json({
      error: 'Tidak bisa mendeteksi App ID dari token. Set FB_APP_ID di environment Vercel.',
    }, { status: 500 })
  }

  const buf = Buffer.from(await file.arrayBuffer())

  // ── 1) Simpan ke Supabase Storage (untuk dipakai saat KIRIM template) ──
  const ext = mime.includes('png') ? 'png' : 'jpg'
  const path = `${actor.tenantId}/tpl-${Date.now()}.${ext}`
  let imageUrl = ''
  const { error: upErr } = await supabaseAdmin.storage
    .from('wa-media').upload(path, buf, { contentType: mime, upsert: true })
  if (!upErr) {
    const { data: pub } = supabaseAdmin.storage.from('wa-media').getPublicUrl(path)
    imageUrl = pub.publicUrl
  }

  // ── 2) Resumable Upload ke Meta: minta sesi upload ──
  const startUrl = `${GRAPH}/${appId}/uploads`
    + `?file_name=${encodeURIComponent(file.name || `header.${ext}`)}`
    + `&file_length=${buf.length}`
    + `&file_type=${encodeURIComponent(mime)}`
  const startRes = await fetch(startUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  })
  const startJson = await startRes.json().catch(() => ({}))
  if (!startRes.ok || !startJson?.id) {
    return NextResponse.json({
      error: startJson?.error?.message || `Gagal memulai upload ke Meta (${startRes.status})`,
    }, { status: 502 })
  }

  // ── 3) Kirim isi file → dapat handle ──
  const putRes = await fetch(`${GRAPH}/${startJson.id}`, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${auth.accessToken}`, // WAJIB "OAuth", bukan "Bearer"
      file_offset: '0',
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(buf) as any,
  })
  const putJson = await putRes.json().catch(() => ({}))
  if (!putRes.ok || !putJson?.h) {
    return NextResponse.json({
      error: putJson?.error?.message || `Gagal mengunggah gambar ke Meta (${putRes.status})`,
    }, { status: 502 })
  }

  return NextResponse.json({ ok: true, header_handle: putJson.h, image_url: imageUrl })
}
