import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// POST — Trigger email reset password. User akan terima link untuk set password baru.
// Pakai flow yang sama dengan /forgot-password (recovery email Supabase).
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { data: { user } } = await anon.auth.getUser(token)
  if (!user?.email) return NextResponse.json({ error: 'email user tidak ditemukan' }, { status: 400 })

  const origin = req.headers.get('origin') || 'https://closari-app-ogl6.vercel.app'
  const { error } = await anon.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${origin}/update-password`,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    message: `Link reset password sudah dikirim ke ${user.email}.`
  })
}
