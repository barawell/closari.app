// lib/wa-account.ts
// Helper: ambil waba_id + access_token untuk satu tenant (atau nomor spesifik).
// Dipakai endpoint template (list / create / delete).

import { supabaseAdmin } from './supabase-admin'

export type WabaAuth = { waNumberId: string; wabaId: string; phoneNumberId: string; accessToken: string }

// Ambil akun WABA milik tenant. Kalau waNumberId diisi, pakai nomor itu;
// kalau tidak, pakai nomor yang PALING SEHAT.
//
// Kenapa bukan "nomor pertama (created_at)": kalau tenant punya nomor duplikat
// atau nomor lama yang waba_id-nya salah, memilih yang paling lama bisa
// mengembalikan waba_id ngaco -> create template gagal ("Object with ID ...
// does not exist"). Jadi urutan pilih: status 'connected' dulu, baru yang
// terbaru. Nomor yang benar-benar terhubung yang dipakai, bukan yang tertua.
export async function getWabaAuth(tenantId: string, waNumberId?: string): Promise<WabaAuth | null> {
  let q = supabaseAdmin
    .from('wa_numbers')
    .select('id, waba_id, phone_number_id, status, created_at')
    .eq('tenant_id', tenantId)

  if (waNumberId) {
    // Nomor spesifik diminta -> pakai itu apa adanya.
    const { data: num } = await q.eq('id', waNumberId).limit(1).maybeSingle()
    return finalize(num)
  }

  // Tidak ada nomor spesifik: ambil semua, pilih yang paling sehat.
  const { data: rows } = await q.order('created_at', { ascending: false })
  const list = (rows || []).filter((n: any) => n.waba_id) // buang yang tak punya waba_id
  if (list.length === 0) return null

  // Prioritas: connected dulu, lalu terbaru (list sudah descending created_at).
  const pilihan = list.find((n: any) => n.status === 'connected') || list[0]
  return finalize(pilihan)
}

async function finalize(num: any): Promise<WabaAuth | null> {
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
