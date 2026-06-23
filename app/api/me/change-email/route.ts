import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// POST — Ganti email user. Supabase akan kirim verifikasi ke email BARU.
// Setelah user klik link konfirmasi di email baru, email-nya baru bener-bener ganti.
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const newEmail = (b.email || '').trim().toLowerCase()
  if (!newEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(actor.userId, { email: newEmail })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    message: 'Link verifikasi sudah dikirim ke email baru. Klik link tersebut untuk menyelesaikan perubahan email.'
  })
}
