// lib/ai.ts — AI auto-reply per-tenant via Anthropic (Claude).
// v6: pakai buildSystemPrompt() yang merangkai knowledge base.
import { buildSystemPrompt, type HaloAiConfig } from './halo-ai'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

export type AiConfig = HaloAiConfig & {
  enabled?: boolean | null
  model?: string | null
  cooldown_min?: number | null
}

export type Turn = { role: 'user' | 'assistant'; content: string }

// Normalisasi riwayat: buang kosong, gabung turn berurutan role sama,
// buang assistant di awal (Anthropic butuh mulai dari user & selang-seling).
function normalize(turns: Turn[]): Turn[] {
  const out: Turn[] = []
  for (const t of turns) {
    const c = (t.content || '').trim()
    if (!c) continue
    const last = out[out.length - 1]
    if (last && last.role === t.role) last.content += '\n' + c
    else out.push({ role: t.role, content: c })
  }
  while (out.length && out[0].role !== 'user') out.shift()
  return out
}

export async function generateReply(
  config: AiConfig,
  turns: Turn[],
  context?: { customer_name?: string; is_returning?: boolean; last_order_days_ago?: number }
): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null

  const messages = normalize(turns)
  if (!messages.length || messages[messages.length - 1].role !== 'user') return null

  const system = buildSystemPrompt(config, context)

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model || 'claude-haiku-4-5',
        max_tokens: 500,
        system,
        messages,
      }),
    })
    if (!res.ok) {
      console.error('[closari ai] gagal:', res.status, await res.text().catch(() => ''))
      return null
    }
    const data: any = await res.json()
    const text = (data?.content || [])
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text)
      .join('')
      .trim()
    return text || null
  } catch (e) {
    console.error('[closari ai] error:', e)
    return null
  }
}
