import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// POST — Ganti email user. Pakai user-scoped client (updateUser) supaya Supabase
// mengirim email verifikasi ke alamat BARU (dan lama, kalau "Secure email change" ON).
// Email baru aktif setelah user klik link konfirmasi.
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const newEmail = (b.email || '').trim().toLowerCase()
  if (!newEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 })
  }

  const origin = req.headers.get('origin') || 'https://closari-app-ogl6.vercel.app'

  // Client yang membawa session user (bukan admin) → trigger email verifikasi.
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  // Set session dari access token user
  const { data: { user }, error: userErr } = await supa.auth.getUser(token)
  if (userErr || !user) return NextResponse.json({ error: 'sesi tidak valid, login ulang' }, { status: 401 })

  // updateUser butuh session aktif → pakai setSession dgn access token
  await supa.auth.setSession({ access_token: token, refresh_token: token })

  const { error } = await supa.auth.updateUser(
    { email: newEmail },
    { emailRedirectTo: `${origin}/inbox` },
  )

  if (error) {
    // Kalau gagal karena SMTP belum diset, kasih pesan jelas
    const msg = error.message || ''
    if (/smtp|email.*not|sender|provider/i.test(msg)) {
      return NextResponse.json({ error: 'Email server belum dikonfigurasi di Supabase. Set SMTP dulu di Auth → Email.' }, { status: 500 })
    }
    return NextResponse.json({ error: msg || 'Gagal request perubahan email' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    message: 'Link verifikasi sudah dikirim ke email baru. Buka email tersebut & klik link untuk menyelesaikan perubahan.',
  })
}
