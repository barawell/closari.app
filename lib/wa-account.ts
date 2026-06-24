// lib/wa-account.ts
// Helper: ambil waba_id + access_token untuk satu tenant (atau nomor spesifik).
// Dipakai endpoint template (list / create / delete).

import { supabaseAdmin } from './supabase-admin'

export type WabaAuth = { waNumberId: string; wabaId: string; phoneNumberId: string; accessToken: string }

// Ambil akun WABA milik tenant. Kalau waNumberId diisi, pakai nomor itu;
// kalau tidak, pakai nomor pertama tenant.
export async function getWabaAuth(tenantId: string, waNumberId?: string): Promise<WabaAuth | null> {
  let q = supabaseAdmin
    .from('wa_numbers')
    .select('id, waba_id, phone_number_id')
    .eq('tenant_id', tenantId)

  if (waNumberId) q = q.eq('id', waNumberId)
  else q = q.order('created_at', { ascending: true })

  const { data: num } = await q.limit(1).maybeSingle()
  if (!num?.waba_id) return null

  const { data: sec } = await supabaseAdmin
    .from('wa_number_secrets')
    .select('access_token')
    .eq('wa_number_id', num.id)
    .maybeSingle()
  if (!sec?.access_token) return null

  return {
    waNumberId: num.id as string,
    wabaId: num.waba_id as string,
    phoneNumberId: num.phone_number_id as string,
    accessToken: sec.access_token as string,
  }
}
