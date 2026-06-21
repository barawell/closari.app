import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Copilot: dari transkrip percakapan, keluarkan (1) maksud asli customer +
// (2) saran balasan utk agen. TIDAK mengirim apa pun — murni bantu agen.
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { conversation_id } = await req.json().catch(() => ({}))
  if (!conversation_id) return NextResponse.json({ error: 'conversation_id wajib' }, { status: 400 })

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return NextResponse.json({ error: 'ANTHROPIC_API_KEY belum di-set' }, { status: 503 })

  const { data: cfg } = await supabaseAdmin
    .from('ai_configs').select('persona_name, system_prompt, model').eq('tenant_id', actor.tenantId).maybeSingle()

  const { data: hist } = await supabaseAdmin
    .from('wa_messages').select('direction, body')
    .eq('tenant_id', actor.tenantId).eq('conversation_id', conversation_id)
    .order('created_at', { ascending: true }).limit(20)
  const msgs = (hist || []).filter((m: any) => m.body)
  if (!msgs.length) return NextResponse.json({ intent: '', suggestion: '' })

  const transcript = msgs.map((m: any) => `${m.direction === 'in' ? 'Customer' : 'CS'}: ${m.body}`).join('\n')

  const system =
    `Kamu copilot untuk agen CS WhatsApp${cfg?.persona_name ? ` (${cfg.persona_name})` : ''}. ` +
    `${cfg?.system_prompt || ''}\n\n` +
    `Tugasmu BUKAN membalas customer langsung, tapi MEMBANTU agen manusia. Dari transkrip, keluarkan:\n` +
    `1) "intent": 1-2 kalimat — apa SEBENARNYA yang customer mau/butuhkan (baca di balik kata-katanya).\n` +
    `2) "suggestion": draft balasan siap pakai/edit (1-3 kalimat, Bahasa Indonesia, ramah, jelas).\n` +
    `Balas HANYA JSON valid: {"intent":"...","suggestion":"..."} tanpa teks lain.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: cfg?.model || 'claude-haiku-4-5',
        max_tokens: 600,
        system,
        messages: [{ role: 'user', content: `Transkrip:\n${transcript}\n\nKeluarkan JSON-nya.` }],
      }),
    })
    if (!res.ok) return NextResponse.json({ error: 'AI gagal: ' + res.status }, { status: 502 })
    const data: any = await res.json()
    const text = (data?.content || []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('').trim()
    let parsed: { intent?: string; suggestion?: string } = {}
    try { parsed = JSON.parse(text.replace(/```json|```/g, '').trim()) } catch { parsed = { intent: '', suggestion: text } }
    return NextResponse.json({ intent: parsed.intent || '', suggestion: parsed.suggestion || '' })
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 })
  }
}
