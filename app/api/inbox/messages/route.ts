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
    .select('id, direction, type, body, media_url, media_mime, media_filename, is_forwarded, reply_to, wa_message_id, sender, status, created_at')
    .eq('tenant_id', actor.tenantId)
    .eq('conversation_id', id)
    .order('created_at', { ascending: false })   // terbaru dulu
    .limit(PAGE)

  if (before) qy = qy.lt('created_at', before)   // muat yang lebih lama dari cursor

  const { data, error } = await qy
  // Kalau kolom reply_to belum ada di DB, ulangi tanpa kolom itu (biar tetap jalan).
  let rows: any[] = data || []
  if (error) {
    const retry = await supabaseAdmin
      .from('wa_messages')
      .select('id, direction, type, body, media_url, media_mime, media_filename, is_forwarded, sender, status, created_at')
      .eq('tenant_id', actor.tenantId).eq('conversation_id', id)
      .order('created_at', { ascending: false }).limit(PAGE)
      .lt('created_at', before || '9999-12-31')
    rows = retry.data || []
  }
  const hasMore = rows.length === PAGE

  // Resolusi pesan yang di-reply: cocokkan reply_to (wa_message_id) → isi pesan aslinya.
  const replyIds = Array.from(new Set(rows.map((r: any) => r.reply_to).filter(Boolean)))
  const quotedById: Record<string, any> = {}
  if (replyIds.length) {
    const { data: quoted } = await supabaseAdmin
      .from('wa_messages')
      .select('wa_message_id, direction, type, body, media_mime')
      .eq('tenant_id', actor.tenantId).in('wa_message_id', replyIds)
    for (const q of quoted || []) {
      if (!q.wa_message_id) continue
      quotedById[q.wa_message_id] = {
        direction: q.direction,
        type: q.type,
        body: q.body,
        is_media: !!q.media_mime,
      }
    }
  }

  const enriched = rows.map((r: any) => ({
    ...r,
    quoted: r.reply_to ? (quotedById[r.reply_to] || null) : null,
  }))

  // Balik ke urutan kronologis (lama → baru) untuk ditampilkan
  return NextResponse.json({
    messages: enriched.slice().reverse(),
    has_more: hasMore,
    oldest: rows.length ? rows[rows.length - 1].created_at : null,
  })
}
