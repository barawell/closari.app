import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const GRAPH = 'https://graph.facebook.com/v21.0'

// GET /api/numbers/diagnose?id=<wa_number_id>
// Cek kesehatan koneksi nomor: token valid? sudah subscribe webhook ke WABA?
export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 })

  const { data: num } = await supabaseAdmin
    .from('wa_numbers')
    .select('id, waba_id, phone_number_id, display_phone')
    .eq('id', id).eq('tenant_id', actor.tenantId).maybeSingle()
  if (!num) return NextResponse.json({ error: 'nomor tidak ditemukan' }, { status: 404 })

  const { data: sec } = await supabaseAdmin
    .from('wa_number_secrets').select('access_token').eq('wa_number_id', num.id).maybeSingle()
  const token = sec?.access_token

  const checks: any = {
    phone_number_id: num.phone_number_id,
    waba_id: num.waba_id,
    has_token: !!token,
    token_valid: false,
    webhook_subscribed: false,
    phone_info: null,
    errors: [] as string[],
  }

  if (!token) {
    checks.errors.push('Access token kosong. Tambah ulang nomor dengan token yang benar.')
    return NextResponse.json({ checks })
  }

  // 1) Token valid? Cek dengan ambil info phone number.
  try {
    const r = await fetch(`${GRAPH}/${num.phone_number_id}?fields=display_phone_number,verified_name,quality_rating,platform_type`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const j = await r.json()
    if (r.ok) {
      checks.token_valid = true
      checks.phone_info = j
    } else {
      checks.errors.push(`Token/phone_number_id bermasalah: ${j?.error?.message || r.status}`)
    }
  } catch (e: any) {
    checks.errors.push('Gagal cek token: ' + (e?.message || 'network'))
  }

  // 2) Webhook subscribed ke WABA?
  try {
    const r = await fetch(`${GRAPH}/${num.waba_id}/subscribed_apps`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const j = await r.json()
    if (r.ok) {
      const apps = j?.data || []
      checks.webhook_subscribed = apps.length > 0
      checks.subscribed_apps = apps
      if (apps.length === 0) {
        checks.errors.push('App BELUM subscribe ke WABA ini. Klik "Aktifkan terima pesan" untuk subscribe.')
      }
    } else {
      checks.errors.push(`Gagal cek subscription: ${j?.error?.message || r.status}`)
    }
  } catch (e: any) {
    checks.errors.push('Gagal cek subscription: ' + (e?.message || 'network'))
  }

  return NextResponse.json({ checks })
}

// POST /api/numbers/diagnose  body: { id }
// Subscribe app ke WABA → webhook mulai nerima pesan untuk nomor ini.
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const id = b.id as string
  if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 })

  const { data: num } = await supabaseAdmin
    .from('wa_numbers').select('id, waba_id, phone_number_id').eq('id', id).eq('tenant_id', actor.tenantId).maybeSingle()
  if (!num) return NextResponse.json({ error: 'nomor tidak ditemukan' }, { status: 404 })

  const { data: sec } = await supabaseAdmin
    .from('wa_number_secrets').select('access_token').eq('wa_number_id', num.id).maybeSingle()
  if (!sec?.access_token) return NextResponse.json({ error: 'token nomor kosong' }, { status: 400 })

  // Subscribe app ke WABA
  const r = await fetch(`${GRAPH}/${num.waba_id}/subscribed_apps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sec.access_token}` },
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) {
    return NextResponse.json({ error: j?.error?.message || `gagal subscribe (${r.status})` }, { status: 502 })
  }

  await supabaseAdmin.from('wa_numbers').update({ status: 'connected' }).eq('id', num.id)
  return NextResponse.json({ ok: true, result: j })
}
