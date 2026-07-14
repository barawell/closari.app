import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const PAGE = 100

// GET /api/inbox/messages?conversation_id=...&before=<iso>
//   Ambil PESAN TERBARU dulu (bukan yang paling lama), lalu bisa muat pesan lama
//   lewat cursor `before` → riwayat chat lengkap, tidak terpotong.
export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const id = url.searchParams.get('conversation_id')
  const before = url.searchParams.get('before')
  if (!id) return NextResponse.json({ error: 'conversation_id wajib' }, { status: 400 })

  let qy = supabaseAdmin
    .from('wa_messages')
    .select('id, direction, type, body, media_url, media_mime, media_filename, is_forwarded, sender, status, created_at')
    .eq('tenant_id', actor.tenantId)
    .eq('conversation_id', id)
    .order('created_at', { ascending: false })   // terbaru dulu
    .limit(PAGE)

  if (before) qy = qy.lt('created_at', before)   // muat yang lebih lama dari cursor

  const { data } = await qy
  const rows = data || []
  const hasMore = rows.length === PAGE

  // Balik ke urutan kronologis (lama → baru) untuk ditampilkan
  return NextResponse.json({
    messages: rows.slice().reverse(),
    has_more: hasMore,
    oldest: rows.length ? rows[rows.length - 1].created_at : null,
  })
}
