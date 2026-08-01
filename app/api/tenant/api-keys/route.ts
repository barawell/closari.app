import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buatApiKey } from '@/lib/api-keys'

/* /api/tenant/api-keys — kelola API key tenant (untuk integrasi eksternal).

   GET    -> daftar key milik tenant (prefix saja, bukan key penuh)
   POST   -> buat key baru; mengembalikan key PENUH sekali ini saja
   DELETE -> cabut key (?id=)

   Auth: getActor (login user). Hanya owner/admin tenant yang boleh. Key penuh
   TIDAK pernah bisa dibaca ulang setelah dibuat — hanya hash yang tersimpan. */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('tenant_api_keys')
    .select('id, nama, key_prefix, terakhir_dipakai, dicabut, created_at')
    .eq('tenant_id', actor.tenantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ keys: data || [] })
}

export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (actor.role && !['owner', 'admin'].includes(actor.role)) {
    return NextResponse.json({ error: 'Hanya admin/owner yang bisa membuat API key.' }, { status: 403 })
  }

  const b = await req.json().catch(() => ({}))
  const nama = String(b?.nama || '').trim() || 'API key'
  try {
    const { key, row } = await buatApiKey(actor.tenantId, nama, actor.userId)
    // key dikembalikan SEKALI ini saja — klien wajib menyalinnya sekarang.
    return NextResponse.json({ ok: true, key, info: row })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (actor.role && !['owner', 'admin'].includes(actor.role)) {
    return NextResponse.json({ error: 'Hanya admin/owner yang bisa mencabut API key.' }, { status: 403 })
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 })

  // Pastikan key milik tenant ini sebelum mencabut.
  const { error } = await supabaseAdmin
    .from('tenant_api_keys').update({ dicabut: true }).eq('id', id).eq('tenant_id', actor.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
