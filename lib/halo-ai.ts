// lib/halo-ai.ts — Builder system prompt yang merangkai knowledge base ke struktur konsisten.
// Dipakai di Halo AI test playground & auto-reply runtime.

export type HaloAiConfig = {
  persona_name?: string | null
  persona_role?: string | null
  system_prompt?: string | null         // optional override manual
  business_info?: string | null
  products_info?: string | null
  faq_info?: string | null
  policy_info?: string | null
  repeat_order_mode?: boolean | null
  repeat_order_days_threshold?: number | null
  repeat_order_message?: string | null
}

/**
 * Build full system prompt dari knowledge base.
 * Kalau user override `system_prompt` manual, itu yg dipake.
 * Kalau tidak, kita rakit otomatis dari business/products/faq/policy.
 */
export function buildSystemPrompt(cfg: HaloAiConfig & Record<string, any>, context?: { customer_name?: string; is_returning?: boolean; last_order_days_ago?: number }): string {
  // Override manual → respect itu
  if (cfg.system_prompt && cfg.system_prompt.trim()) {
    let prompt = cfg.system_prompt.trim()
    // Inject knowledge base sebagai context tambahan kalau ada
    const kb = formatKnowledgeBase(cfg)
    if (kb) prompt += `\n\n--- KNOWLEDGE BASE ---\n${kb}`
    return appendContext(prompt, context)
  }

  // Build dari template terstruktur
  const persona = cfg.persona_name || 'Aira'
  const role = cfg.persona_role || 'asisten customer service'

  let prompt = `Kamu adalah ${persona}, ${role} via WhatsApp.

# Aturan respon
- Jawab dalam Bahasa Indonesia yang ramah, jelas, dan singkat (max 3-4 kalimat per balasan).
- Jangan mengarang info yang tidak ada di knowledge base di bawah.
- Kalau pertanyaan di luar kemampuanmu, arahkan dengan sopan ke admin manusia.
- Jangan gunakan emoji berlebihan, max 1-2 per pesan.
- Hindari kalimat berbelit-belit. Customer suka jawaban yg langsung ke point.`

  const kb = formatKnowledgeBase(cfg)
  if (kb) prompt += `\n\n--- KNOWLEDGE BASE ---\n${kb}`

  if (cfg.repeat_order_mode) {
    const threshold = cfg.repeat_order_days_threshold || 30
    prompt += `\n\n# Mode Repeat Order AKTIF
- Kalau customer adalah pelanggan lama (pernah pesan sebelumnya), prioritaskan tawarkan ulang produk yang pernah mereka beli.
- Setelah ${threshold} hari sejak pesanan terakhir, mulai promosikan pemesanan ulang dengan halus.
- Tunjukkan apresiasi bahwa mereka pelanggan setia.`
    if (cfg.repeat_order_message) {
      prompt += `\n- Template ajakan repeat order: "${cfg.repeat_order_message}"`
    }
  }

  return appendContext(prompt, context)
}

function formatKnowledgeBase(cfg: HaloAiConfig): string {
  const sections: string[] = []
  if (cfg.business_info?.trim()) sections.push(`## Tentang Bisnis\n${cfg.business_info.trim()}`)
  if (cfg.products_info?.trim()) sections.push(`## Produk & Harga\n${cfg.products_info.trim()}`)
  if (cfg.faq_info?.trim()) sections.push(`## FAQ (Pertanyaan Sering Ditanya)\n${cfg.faq_info.trim()}`)
  if (cfg.policy_info?.trim()) sections.push(`## Kebijakan (Pengiriman, Refund, dll)\n${cfg.policy_info.trim()}`)
  return sections.join('\n\n')
}

function appendContext(prompt: string, context?: { customer_name?: string; is_returning?: boolean; last_order_days_ago?: number }): string {
  if (!context) return prompt
  const lines: string[] = []
  if (context.customer_name) lines.push(`- Nama customer: ${context.customer_name}`)
  if (context.is_returning) lines.push(`- Status: PELANGGAN LAMA (pernah berinteraksi/beli sebelumnya)`)
  if (typeof context.last_order_days_ago === 'number') lines.push(`- Terakhir order: ${context.last_order_days_ago} hari yang lalu`)
  if (lines.length === 0) return prompt
  return prompt + `\n\n# Context Customer\n${lines.join('\n')}`
}
