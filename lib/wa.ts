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
// Token diambil dari wa_number_secrets (RLS deny-all → cuma service role yang bisa).
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

// Kirim pesan teks via Cloud API pakai token tenant ybs.
export async function sendText(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  body: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
    })
    if (!res.ok) console.error('[closari sendText] gagal:', res.status, await res.text().catch(() => ''))
    return res.ok
  } catch (e) {
    console.error('[closari sendText] error:', e)
    return false
  }
}
