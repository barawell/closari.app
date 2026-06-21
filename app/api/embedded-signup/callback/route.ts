import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const GRAPH = 'https://graph.facebook.com/v21.0'
const FB_APP_ID = process.env.FB_APP_ID || ''
const FB_APP_SECRET = process.env.FB_APP_SECRET || ''

// Dipanggil frontend setelah Embedded Signup sukses (bawa code + phone_number_id + waba_id).
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!FB_APP_ID || !FB_APP_SECRET) {
    return NextResponse.json({ error: 'FB_APP_ID / FB_APP_SECRET belum di-set. Embedded Signup belum aktif.' }, { status: 503 })
  }

  const b = await req.json().catch(() => ({}))
  const { code, phone_number_id, waba_id } = b
  if (!code || !phone_number_id || !waba_id) {
    return NextResponse.json({ error: 'code, phone_number_id, waba_id wajib' }, { status: 400 })
  }

  // 1) Tukar code → business token
  const tokenUrl = `${GRAPH}/oauth/access_token?client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&code=${encodeURIComponent(code)}`
  const tokenRes = await fetch(tokenUrl)
  const tokenData: any = await tokenRes.json().catch(() => ({}))
  const accessToken = tokenData?.access_token
  if (!tokenRes.ok || !accessToken) {
    return NextResponse.json({ error: 'gagal tukar code', detail: tokenData }, { status: 502 })
  }

  // 2) Subscribe app ke WABA klien → webhook kita mulai nerima pesannya
  await fetch(`${GRAPH}/${waba_id}/subscribed_apps`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {})

  // 3) Ambil display phone (best-effort)
  let displayPhone: string | null = null
  try {
    const r = await fetch(`${GRAPH}/${phone_number_id}?fields=display_phone_number`, { headers: { Authorization: `Bearer ${accessToken}` } })
    const j: any = await r.json()
    displayPhone = j?.display_phone_number || null
  } catch { /* ignore */ }

  // 4) Simpan nomor + token (token di tabel secret)
  const { data: num, error } = await supabaseAdmin.from('wa_numbers')
    .upsert(
      { tenant_id: actor.tenantId, waba_id, phone_number_id, display_phone: displayPhone, status: 'connected' },
      { onConflict: 'phone_number_id' },
    )
    .select('id').maybeSingle()
  if (error || !num) return NextResponse.json({ error: error?.message || 'gagal simpan nomor' }, { status: 500 })

  await supabaseAdmin.from('wa_number_secrets').upsert({ wa_number_id: num.id, access_token: accessToken }, { onConflict: 'wa_number_id' })

  return NextResponse.json({ ok: true, id: num.id, display_phone: displayPhone })
}
