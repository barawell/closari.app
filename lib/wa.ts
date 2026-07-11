import { supabaseAdmin } from './supabase-admin'

const GRAPH = 'https://graph.facebook.com/v21.0'

// Normalisasi nomor ke format 62xxxxxxxxxx.
export function normalizePhone(input: string): string {
  let s = (input || '').replace(/\D/g, '')
  if (s.startsWith('0')) s = '62' + s.slice(1)
  else if (s.startsWith('8')) s = '62' + s
  return s
}

export type NumberAuth = { tenantId: string; waNumberId: string; accessToken: string }

// Cari tenant + access token dari phone_number_id.
export async function getNumberAuth(phoneNumberId: string): Promise<NumberAuth | null> {
  const { data: num } = await supabaseAdmin
    .from('wa_numbers')
    .select('id, tenant_id')
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle()
  if (!num) return null

  const { data: sec } = await supabaseAdmin
    .from('wa_number_secrets')
    .select('access_token')
    .eq('wa_number_id', num.id)
    .maybeSingle()
  if (!sec?.access_token) return null

  return { tenantId: num.tenant_id as string, waNumberId: num.id as string, accessToken: sec.access_token as string }
}

// ── Kirim pesan teks ────────────────────────────────────────
export async function sendText(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  body: string,
): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
  return sendRaw(phoneNumberId, accessToken, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body, preview_url: true },
  })
}

// ── Kirim media (image / document / video / audio) via URL ──
export async function sendMediaByUrl(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  kind: 'image' | 'document' | 'video' | 'audio',
  link: string,
  opts?: { caption?: string; filename?: string },
): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
  const media: any = { link }
  if (opts?.caption && (kind === 'image' || kind === 'video' || kind === 'document')) media.caption = opts.caption
  if (opts?.filename && kind === 'document') media.filename = opts.filename
  return sendRaw(phoneNumberId, accessToken, {
    messaging_product: 'whatsapp',
    to,
    type: kind,
    [kind]: media,
  })
}

// Kirim pin lokasi ke customer (WhatsApp Cloud API type: location).
export async function sendLocation(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  loc: { latitude: number; longitude: number; name?: string; address?: string },
): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
  const location: any = { latitude: loc.latitude, longitude: loc.longitude }
  if (loc.name) location.name = loc.name
  if (loc.address) location.address = loc.address
  return sendRaw(phoneNumberId, accessToken, {
    messaging_product: 'whatsapp',
    to,
    type: 'location',
    location,
  })
}

// ── Core sender ─────────────────────────────────────────────
async function sendRaw(
  phoneNumberId: string,
  accessToken: string,
  payload: any,
): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
  try {
    const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      const errMsg = j?.error?.message || `HTTP ${res.status}`
      console.error('[closari send] gagal:', res.status, JSON.stringify(j))
      return { ok: false, error: errMsg }
    }
    return { ok: true, waMessageId: j?.messages?.[0]?.id }
  } catch (e: any) {
    console.error('[closari send] error:', e)
    return { ok: false, error: e?.message || 'network error' }
  }
}

// ── Download media masuk dari WhatsApp → simpan ke Supabase Storage ──
// Return public URL, atau null kalau gagal.
export async function downloadAndStoreMedia(
  accessToken: string,
  tenantId: string,
  mediaId: string,
  mimeHint?: string,
): Promise<{ url: string | null; mime?: string }> {
  try {
    // 1) Ambil URL media (URL ini butuh Bearer token, valid sebentar)
    const metaRes = await fetch(`${GRAPH}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!metaRes.ok) return { url: null }
    const meta = await metaRes.json()
    const mediaUrl: string | undefined = meta?.url
    const mime: string = meta?.mime_type || mimeHint || 'application/octet-stream'
    if (!mediaUrl) return { url: null }

    // 2) Download bytes-nya (juga butuh Bearer)
    const fileRes = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!fileRes.ok) return { url: null }
    const buf = Buffer.from(await fileRes.arrayBuffer())

    // 3) Upload ke Supabase Storage (bucket wa-media, public read)
    const ext = mimeToExt(mime)
    const path = `${tenantId}/${mediaId}.${ext}`
    const { error } = await supabaseAdmin.storage
      .from('wa-media')
      .upload(path, buf, { contentType: mime, upsert: true })
    if (error) {
      console.error('[closari media] upload gagal:', error.message)
      return { url: null }
    }
    const { data: pub } = supabaseAdmin.storage.from('wa-media').getPublicUrl(path)
    return { url: pub.publicUrl, mime }
  } catch (e) {
    console.error('[closari media] error:', e)
    return { url: null }
  }
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'video/mp4': 'mp4', 'video/3gpp': '3gp',
    'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/amr': 'amr', 'audio/aac': 'aac',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/msword': 'doc', 'application/vnd.ms-excel': 'xls',
  }
  return map[mime] || (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'bin'
}
