import { NextResponse } from 'next/server'
import { getApiActor } from '@/lib/api-keys'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizePhone } from '@/lib/wa'

/* /api/external/riwayat — riwayat kirim broadcast per nomor, untuk tenant pemilik
   API key.

   Dipakai sistem luar untuk menjawab "nomor ini sudah berapa kali kita kirimi,
   terakhir kapan" SEBELUM menyusun daftar penerima berikutnya. Tanpa ini, sistem
   luar tidak punya cara tahu siapa yang sudah dispam, karena riwayatnya ada di
   Closari, bukan di sistem mereka.

   GET /api/external/riwayat
     ?sejak=90        (opsional, hari ke belakang — default 180)
     ?phones=62811,62812   (opsional, batasi ke nomor tertentu)

   Balasan:
     { ok: true, sejak_hari: 180, rows: [
         { phone, jumlah, terakhir, gagal }, ... ] }

   Hanya menghitung penerima yang BENAR-BENAR terkirim (sent/delivered/read).
   Campaign yang masih menunggu persetujuan atau ditolak tidak dihitung — kalau
   ikut dihitung, orang bisa tersaring padahal belum pernah menerima apa pun. */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const TERKIRIM = ['sent', 'delivered', 'read']
const HALAMAN = 1000

export async function GET(req: Request) {
  const actor = await getApiActor(req)
  if (!actor?.tenantId) {
    return NextResponse.json({ ok: false, error: 'API key tidak valid atau dicabut.' }, { status: 401 })
  }

  const u = new URL(req.url)
  const sejakHari = Math.max(1, Math.min(730, Number(u.searchParams.get('sejak')) || 180))
  const sejakIso = new Date(Date.now() - sejakHari * 86400000).toISOString()

  const filterPhones = (u.searchParams.get('phones') || '')
    .split(',').map((s) => normalizePhone(s.trim())).filter(Boolean)

  type Baris = { phone: string; status: string; created_at: string }
  const semua: Baris[] = []

  // Kalau pemanggil menyebut nomor tertentu, saring di SQL supaya tidak menarik
  // seluruh riwayat tenant. Batas 500 per potong: 'in' yang terlalu panjang
  // bikin URL query PostgREST ditolak.
  const potongan: (string[] | null)[] = filterPhones.length
    ? Array.from({ length: Math.ceil(filterPhones.length / 500) }, (_, i) =>
        filterPhones.slice(i * 500, i * 500 + 500))
    : [null]

  for (const chunk of potongan) {
    for (let dari = 0; ; dari += HALAMAN) {
      let q = supabaseAdmin
        .from('broadcast_recipients')
        .select('phone, status, created_at')
        .eq('tenant_id', actor.tenantId)
        .gte('created_at', sejakIso)
        .range(dari, dari + HALAMAN - 1)
      if (chunk) q = q.in('phone', chunk)

      const { data, error } = await q
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      if (!data?.length) break
      semua.push(...(data as Baris[]))
      if (data.length < HALAMAN) break
    }
  }

  const peta = new Map<string, { phone: string; jumlah: number; terakhir: string | null; gagal: number }>()
  for (const r of semua) {
    const p = normalizePhone(r.phone)
    if (!p) continue
    let baris = peta.get(p)
    if (!baris) { baris = { phone: p, jumlah: 0, terakhir: null, gagal: 0 }; peta.set(p, baris) }

    if (TERKIRIM.includes(r.status)) {
      baris.jumlah++
      if (!baris.terakhir || r.created_at > baris.terakhir) baris.terakhir = r.created_at
    } else if (r.status === 'failed') {
      baris.gagal++
    }
  }

  // Nomor yang semua kirimannya gagal tetap dikembalikan dengan jumlah 0 —
  // itu justru berguna: nomor mati sebaiknya tidak terus dicoba.
  const rows = Array.from(peta.values()).sort((a, b) => (b.terakhir || '').localeCompare(a.terakhir || ''))

  return NextResponse.json({ ok: true, sejak_hari: sejakHari, total_nomor: rows.length, rows })
}
