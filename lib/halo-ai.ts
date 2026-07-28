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
const CORE_RULES = `# Aturan respon
- Jawab dalam Bahasa Indonesia yang ramah, jelas, dan singkat (max 3-4 kalimat per balasan).
- Jawab HANYA berdasarkan KNOWLEDGE BASE di bawah. DILARANG mengarang harga, stok, jam, dosis, atau fakta apa pun yang tidak tertulis.
- PENTING — JANGAN cuma menyapa: kalau pesan customer berisi pertanyaan atau maksud (mis. tanya harga, mau order/repeat order, tanya produk, komplain), LANGSUNG JAWAB maksud itu dari knowledge base. Sapaan singkat HANYA jika pesan benar-benar murni sapaan tanpa maksud lain (mis. cuma "halo", "min", "p"). Contoh: "halo saya mau repeat order" → langsung bantu proses repeat order, jangan balas sekadar salam.
- Kalau customer mengirim beberapa pesan beruntun, baca semuanya sebagai satu maksud lalu jawab sekaligus.
- Kalau pertanyaan tidak bisa dijawab dari knowledge base, JANGAN menebak dan JANGAN membuat customer menunggu tanpa kepastian. Akui pertanyaannya secara spesifik, beri kepastian akan dibantu, lalu arahkan ke admin. Contoh: "Untuk pertanyaan soal [topik yang ditanya], akan kami arahkan ke admin kami dan segera dibantu ya 🙏". Sebut ulang inti pertanyaannya supaya customer merasa didengar.
- Selalu beri respon yang tepat, cepat, dan jelas. Hindari jawaban menggantung.
- Jangan gunakan emoji berlebihan (max 1-2 per pesan). Langsung ke point, tidak berbelit.`

export function buildSystemPrompt(cfg: HaloAiConfig & Record<string, any>, context?: { customer_name?: string; is_returning?: boolean; last_order_days_ago?: number }): string {
  const persona = cfg.persona_name || 'Aira'
  const role = cfg.persona_role || 'asisten customer service'

  // Aturan inti SELALU dipakai. Custom prompt bersifat TAMBAHAN (gaya/persona),
  // tidak menggantikan aturan inti — supaya AI tidak berhenti menjawab dari KB.
  let prompt = `Kamu adalah ${persona}, ${role} via WhatsApp.\n\n${CORE_RULES}`

  if (cfg.system_prompt && cfg.system_prompt.trim()) {
    prompt += `\n\n# Gaya & instruksi tambahan dari admin\n${cfg.system_prompt.trim()}`
  }

  const kb = formatKnowledgeBase(cfg)
  if (kb) prompt += `\n\n--- KNOWLEDGE BASE ---\n${kb}`
  else prompt += `\n\n(Knowledge base kosong — jangan menjawab detail apa pun, arahkan ke admin.)`

  if (cfg.repeat_order_mode) {
    const threshold = cfg.repeat_order_days_threshold || 30
    prompt += `\n\n# Mode Repeat Order AKTIF
- Kalau customer minta repeat order / pesan ulang, bantu langsung: sebutkan produk & harga dari knowledge base lalu arahkan ke cara pesan yang tertulis di knowledge base.
- Kalau customer pelanggan lama, prioritaskan tawarkan ulang produk yang pernah mereka beli.
- Setelah ${threshold} hari sejak pesanan terakhir, ajak pesan ulang dengan halus & apresiasi kesetiaan mereka.`
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

// True kalau ada minimal 1 sumber knowledge (atau system_prompt manual).
// Dipakai webhook: kalau kosong, auto-reply DILEWATI biar AI tidak ngarang.
export function hasKnowledge(cfg: HaloAiConfig & Record<string, any>): boolean {
  if (cfg?.system_prompt && String(cfg.system_prompt).trim()) return true
  return !!(
    cfg?.business_info?.trim() ||
    cfg?.products_info?.trim() ||
    cfg?.faq_info?.trim() ||
    cfg?.policy_info?.trim()
  )
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
