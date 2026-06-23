import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildSystemPrompt } from '@/lib/halo-ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// POST { messages: Turn[], override_config?: Partial<AiConfig> }
// Test Halo AI dengan riwayat pesan + opsional override config (buat preview perubahan)
export async function POST(req: Request) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return NextResponse.json({ error: 'ANTHROPIC_API_KEY belum di-set' }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const messages: { role: 'user' | 'assistant'; content: string }[] = body.messages || []
  const override = body.override_config || {}

  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'messages harus diakhiri role=user' }, { status: 400 })
  }

  // Ambil config saat ini (atau pakai override)
  const { data: cfg } = await supabaseAdmin
    .from('ai_configs')
    .select('*')
    .eq('tenant_id', actor.tenantId)
    .maybeSingle()
  const finalConfig = { ...(cfg || {}), ...override }

  const system = buildSystemPrompt(finalConfig)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: finalConfig.model || 'claude-haiku-4-5',
        max_tokens: 600,
        system,
        messages,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return NextResponse.json({ error: `AI gagal (${res.status}): ${errText.slice(0, 200)}` }, { status: 502 })
    }
    const data: any = await res.json()
    const text = (data?.content || []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('').trim()
    return NextResponse.json({ reply: text, system_prompt_used: system })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
