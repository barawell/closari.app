import { createHash, randomBytes } from 'crypto'
import { supabaseAdmin } from './supabase-admin'

/* lib/api-keys.ts — pembuatan & validasi API key tenant.

   Key berbentuk:  clsr_live_<32 hex acak>
   Yang disimpan di DB cuma SHA-256 hash-nya + prefix pendek untuk tampilan.
   Key asli tidak pernah disimpan; ditunjukkan sekali saat dibuat. */

export type ApiActor = { tenantId: string; apiKeyId: string }

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/* Buat key baru untuk tenant. Mengembalikan key ASLI (sekali ini saja) + baris DB. */
export async function buatApiKey(tenantId: string, nama: string, dibuatOleh?: string) {
  const acak = randomBytes(24).toString('hex') // 48 char
  const key = `clsr_live_${acak}`
  const key_prefix = key.slice(0, 16) // "clsr_live_xxxxxx" untuk dikenali di UI
  const key_hash = hashKey(key)

  const { data, error } = await supabaseAdmin
    .from('tenant_api_keys')
    .insert({ tenant_id: tenantId, nama: nama.slice(0, 80) || 'API key', key_prefix, key_hash, dibuat_oleh: dibuatOleh ?? null })
    .select('id, nama, key_prefix, created_at')
    .single()

  if (error) throw new Error(error.message)
  return { key, row: data } // `key` HANYA dikembalikan di sini, tidak pernah lagi
}

/* Resolve API key -> tenant. Dipakai endpoint eksternal. Mengembalikan null kalau
   key tidak dikenal / dicabut. Memperbarui terakhir_dipakai (best-effort). */
export async function resolveApiKey(key: string): Promise<ApiActor | null> {
  if (!key || !key.startsWith('clsr_')) return null
  const key_hash = hashKey(key)

  const { data } = await supabaseAdmin
    .from('tenant_api_keys')
    .select('id, tenant_id, dicabut')
    .eq('key_hash', key_hash)
    .maybeSingle()

  if (!data || data.dicabut) return null

  // Catat pemakaian tanpa memblokir (abaikan error).
  supabaseAdmin.from('tenant_api_keys').update({ terakhir_dipakai: new Date().toISOString() }).eq('id', data.id).then(() => {}, () => {})

  return { tenantId: data.tenant_id as string, apiKeyId: data.id as string }
}

/* Ambil actor dari header Authorization: Bearer <api key>. */
export async function getApiActor(req: Request): Promise<ApiActor | null> {
  const key = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!key) return null
  return resolveApiKey(key)
}
