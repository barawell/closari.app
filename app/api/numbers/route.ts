import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data } = await supabaseAdmin
    .from('wa_numbers')
    .select('id, waba_id, phone_number_id, display_phone, label, role, status, quality_rating, created_at')
    .eq('tenant_id', actor.tenantId).order('created_at', { ascending: false })
  return NextResponse.json({ numbers: data || [] })
}

// Tambah nomor manual (buat testing sebelum Embedded Signup live).
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  // Rapikan input: copy-paste dari Meta sering kebawa spasi/newline di ujung.
  // Kalau tidak di-trim, Graph API balas "Object with ID '123 ' does not exist".
  const clean = (v: any) => (typeof v === 'string' ? v.trim() : v)
  const phone_number_id = clean(b.phone_number_id)
  const waba_id = clean(b.waba_id)
  const access_token = clean(b.access_token)
  const display_phone = clean(b.display_phone)
  const label = clean(b.label)
  if (!phone_number_id || !waba_id || !access_token) {
    return NextResponse.json({ error: 'phone_number_id, waba_id, access_token wajib' }, { status: 400 })
  }

  const { data: num, error } = await supabaseAdmin.from('wa_numbers')
    .insert({ tenant_id: actor.tenantId, waba_id, phone_number_id, display_phone: display_phone || null, label: label || null })
    .select('id').maybeSingle()
  if (error || !num) return NextResponse.json({ error: error?.message || 'gagal' }, { status: 500 })

  await supabaseAdmin.from('wa_number_secrets').upsert({ wa_number_id: num.id, access_token }, { onConflict: 'wa_number_id' })
  return NextResponse.json({ ok: true, id: num.id })
}

// Hapus nomor (dan token-nya). Dipakai untuk membersihkan nomor duplikat/lama
// yang waba_id-nya salah. Aman per-tenant: hanya menghapus nomor milik tenant
// pemanggil. Secret ikut terhapus lewat FK cascade; dihapus eksplisit juga
// untuk jaga-jaga kalau cascade tidak diset.
export async function DELETE(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (actor.role && !['owner', 'admin'].includes(actor.role)) {
    return NextResponse.json({ error: 'Hanya admin/owner yang bisa menghapus nomor.' }, { status: 403 })
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 })

  // Pastikan nomor ini milik tenant pemanggil sebelum menghapus.
  const { data: num } = await supabaseAdmin
    .from('wa_numbers').select('id').eq('id', id).eq('tenant_id', actor.tenantId).maybeSingle()
  if (!num) return NextResponse.json({ error: 'Nomor tidak ditemukan.' }, { status: 404 })

  await supabaseAdmin.from('wa_number_secrets').delete().eq('wa_number_id', id)
  const { error } = await supabaseAdmin.from('wa_numbers').delete().eq('id', id).eq('tenant_id', actor.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
