'use client'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'

type Config = {
  enabled: boolean
  persona_name: string
  persona_role: string
  system_prompt: string
  business_info: string
  products_info: string
  faq_info: string
  policy_info: string
  repeat_order_mode: boolean
  repeat_order_days_threshold: number
  repeat_order_message: string
  cooldown_min: number
  model: string
}

const DEFAULT: Config = {
  enabled: false,
  persona_name: 'Halo AI',
  persona_role: 'asisten customer service',
  system_prompt: '',
  business_info: '',
  products_info: '',
  faq_info: '',
  policy_info: '',
  repeat_order_mode: false,
  repeat_order_days_threshold: 30,
  repeat_order_message: '',
  cooldown_min: 0,
  model: 'claude-haiku-4-5',
}

type Tab = 'knowledge' | 'behavior' | 'repeat' | 'playground'

export default function HaloAiPage() {
  const [cfg, setCfg] = useState<Config>(DEFAULT)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('knowledge')
  const [useCustomPrompt, setUseCustomPrompt] = useState(false)

  // Playground state
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    (async () => {
      const res = await authFetch('/api/halo-ai/config')
      const j = await res.json()
      const c = { ...DEFAULT, ...(j.config || {}) }
      setCfg(c)
      setUseCustomPrompt(!!c.system_prompt)
      setLoaded(true)
    })()
  }, [])

  function update<K extends keyof Config>(key: K, val: Config[K]) {
    setCfg(prev => ({ ...prev, [key]: val }))
  }

  async function save() {
    setSaving(true)
    try {
      const payload = { ...cfg, system_prompt: useCustomPrompt ? cfg.system_prompt : '' }
      const res = await authFetch('/api/halo-ai/config', { method: 'PUT', body: JSON.stringify(payload) })
      if (res.ok) setSavedAt(Date.now())
    } finally { setSaving(false) }
  }

  async function sendTest() {
    if (!input.trim() || testing) return
    const userMsg = { role: 'user' as const, content: input.trim() }
    const newChat = [...chat, userMsg]
    setChat(newChat)
    setInput('')
    setTesting(true)
    try {
      const payload = { ...cfg, system_prompt: useCustomPrompt ? cfg.system_prompt : '' }
      const res = await authFetch('/api/halo-ai/test', { method: 'POST', body: JSON.stringify({ messages: newChat, override_config: payload }) })
      const j = await res.json()
      if (res.ok && j.reply) {
        setChat([...newChat, { role: 'assistant', content: j.reply }])
      } else {
        setChat([...newChat, { role: 'assistant', content: `[Error] ${j.error || 'Tidak ada respons'}` }])
      }
    } finally { setTesting(false) }
  }

  function resetChat() { setChat([]) }

  if (!loaded) return <div style={{ padding: 40, fontSize: 13, color: '#9CA3AF' }}>Memuat…</div>

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }
  const helpStyle: React.CSSProperties = { fontSize: 12, color: '#9CA3AF', marginTop: 4, marginBottom: 12, lineHeight: 1.5 }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, color: '#0D0D0D', background: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
  const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: 120, resize: 'vertical' as const, lineHeight: 1.6 }

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      {/* HEADER */}
      <div style={{ padding: '20px 32px', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <svg width="16" height="16" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z" fill="#16A34A"/></svg>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: '#0D0D0D', margin: 0, letterSpacing: '-0.01em' }}>Halo AI</h1>
            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: cfg.enabled ? '#F0FDF4' : '#F7F7F7', color: cfg.enabled ? '#16A34A' : '#6B7280', border: `1px solid ${cfg.enabled ? '#BBF7D0' : '#E5E5E5'}`, fontWeight: 500 }}>
              {cfg.enabled ? 'Auto-reply ON' : 'Auto-reply OFF'}
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>AI yang otomatis balas customer dengan knowledge base bisnis kamu. Cocok untuk handle repeat order & pertanyaan rutin.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
            <div style={{
              width: 36, height: 20, borderRadius: 10, background: cfg.enabled ? '#16A34A' : '#E5E5E5',
              position: 'relative', transition: 'background 0.15s'
            }} onClick={() => update('enabled', !cfg.enabled)}>
              <div style={{
                position: 'absolute', top: 2, left: cfg.enabled ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)', transition: 'left 0.15s'
              }} />
            </div>
            Aktifkan auto-reply
          </label>
          <button onClick={save} disabled={saving}
            style={{ padding: '8px 16px', background: saving ? '#F0F0F0' : '#0D0D0D', color: saving ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
          {savedAt && Date.now() - savedAt < 3000 && (
            <span style={{ fontSize: 12, color: '#16A34A' }}>✓ Tersimpan</span>
          )}
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E5E5E5', padding: '0 32px' }}>
        {([
          { id: 'knowledge', label: 'Knowledge Base' },
          { id: 'behavior', label: 'Persona & Behavior' },
          { id: 'repeat', label: 'Repeat Order Mode' },
          { id: 'playground', label: 'Playground' },
        ] as { id: Tab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '12px 16px', fontSize: 13, fontWeight: 500,
            background: 'none', border: 'none', cursor: 'pointer',
            color: tab === t.id ? '#0D0D0D' : '#9CA3AF',
            borderBottom: tab === t.id ? '2px solid #16A34A' : '2px solid transparent',
            marginBottom: -1, fontFamily: 'inherit',
          }}>{t.label}</button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ padding: '24px 32px', maxWidth: 900 }}>
        {tab === 'knowledge' && (
          <>
            <div style={{ marginBottom: 20, padding: '12px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#15803D', lineHeight: 1.5 }}>
                <strong>Tips:</strong> Semakin spesifik & terstruktur kamu isi knowledge base, semakin akurat jawaban AI. Tulis dalam format daftar atau Q&A — jangan kalimat panjang.
              </div>
            </div>

            <label style={labelStyle}>Tentang Bisnis</label>
            <textarea value={cfg.business_info} onChange={e => update('business_info', e.target.value)}
              placeholder={`Contoh:\nBarawell adalah layanan telemedicine pria — jual obat ED (sildenafil, tadalafil) dengan resep dokter.\nJam operasional: Senin-Sabtu 09:00-21:00 WIB.\nKantor: Jakarta. Pengiriman: seluruh Indonesia via Biteship.`}
              style={textareaStyle} />
            <div style={helpStyle}>Identitas bisnis, jam operasional, alamat, channel utama.</div>

            <label style={labelStyle}>Produk & Harga</label>
            <textarea value={cfg.products_info} onChange={e => update('products_info', e.target.value)}
              placeholder={`Contoh:\n- Sildenafil 50mg (1 strip / 4 tablet): Rp 200,000\n- Sildenafil 100mg (1 strip / 4 tablet): Rp 380,000\n- Tadalafil 20mg (1 strip / 2 tablet): Rp 250,000\n- Combo 50mg + 100mg: Rp 550,000\n- Bundling 2 box Sildenafil 50mg: Rp 380,000 (hemat Rp 20rb)`}
              style={{ ...textareaStyle, minHeight: 160 }} />
            <div style={helpStyle}>Daftar produk + harga + ukuran. Format daftar agar AI gampang nyari.</div>

            <label style={labelStyle}>FAQ — Pertanyaan Sering Ditanya</label>
            <textarea value={cfg.faq_info} onChange={e => update('faq_info', e.target.value)}
              placeholder={`Contoh:\nQ: Apakah perlu resep dokter?\nA: Ya, semua obat ED kami melalui konsultasi dokter berlisensi. Proses cepat via WhatsApp.\n\nQ: Berapa lama pengiriman?\nA: Jakarta 1-2 hari, luar Jakarta 2-4 hari.\n\nQ: Aman untuk usia 50+?\nA: Sebaiknya konsultasi dengan dokter dulu karena ada kondisi medis tertentu yang perlu dipertimbangkan.`}
              style={{ ...textareaStyle, minHeight: 200 }} />
            <div style={helpStyle}>Format Q&amp;A. AI akan match pertanyaan customer dengan FAQ yang relevan.</div>

            <label style={labelStyle}>Kebijakan (Pengiriman, Refund, Privasi)</label>
            <textarea value={cfg.policy_info} onChange={e => update('policy_info', e.target.value)}
              placeholder={`Contoh:\nPengiriman: paket dikemas diskret (tanpa label produk), pakai Biteship.\nRefund: bisa untuk produk rusak/salah kirim, hubungi CS dalam 24 jam.\nPrivasi: data konsultasi dijaga ketat, tidak dibagikan ke pihak ketiga.`}
              style={textareaStyle} />
          </>
        )}

        {tab === 'behavior' && (
          <>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Nama Persona</label>
                <input value={cfg.persona_name} onChange={e => update('persona_name', e.target.value)} placeholder="Halo AI" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Role / Posisi</label>
                <input value={cfg.persona_role} onChange={e => update('persona_role', e.target.value)} placeholder="asisten customer service" style={inputStyle} />
              </div>
            </div>
            <div style={helpStyle}>Customer akan lihat AI ini berinteraksi dengan persona ini.</div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Model AI</label>
                <select value={cfg.model} onChange={e => update('model', e.target.value)} style={inputStyle}>
                  <option value="claude-haiku-4-5">Claude Haiku 4.5 (cepat, hemat)</option>
                  <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (lebih cerdas)</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Cooldown (menit antar reply ke kontak yg sama)</label>
                <input type="number" value={cfg.cooldown_min} onChange={e => update('cooldown_min', +e.target.value)} min={0} max={60} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginTop: 24, padding: '14px', background: '#F7F7F7', border: '1px solid #E5E5E5', borderRadius: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#0D0D0D', marginBottom: 8 }}>
                <input type="checkbox" checked={useCustomPrompt} onChange={e => setUseCustomPrompt(e.target.checked)} />
                Gunakan System Prompt manual (advanced)
              </label>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10, lineHeight: 1.5 }}>
                Defaultnya AI pakai template otomatis dari knowledge base. Centang ini kalau kamu mau full control atas prompt-nya.
              </div>
              {useCustomPrompt && (
                <textarea value={cfg.system_prompt} onChange={e => update('system_prompt', e.target.value)}
                  placeholder="Kamu adalah Halo AI, asisten CS Barawell. Selalu balas dalam Bahasa Indonesia yg ramah..."
                  style={{ ...textareaStyle, minHeight: 200 }} />
              )}
            </div>
          </>
        )}

        {tab === 'repeat' && (
          <>
            <div style={{ marginBottom: 20, padding: '12px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8 }}>
              <div style={{ fontSize: 13, color: '#15803D', lineHeight: 1.5 }}>
                <strong>Repeat Order Mode</strong> — bikin AI proaktif kenali pelanggan lama & tawarin order ulang. Cocok kalau bisnis kamu high-repeat (obat rutin, FMCG, dll).
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 16 }}>
              <div style={{
                width: 36, height: 20, borderRadius: 10, background: cfg.repeat_order_mode ? '#16A34A' : '#E5E5E5',
                position: 'relative', transition: 'background 0.15s', flexShrink: 0
              }} onClick={() => update('repeat_order_mode', !cfg.repeat_order_mode)}>
                <div style={{
                  position: 'absolute', top: 2, left: cfg.repeat_order_mode ? 18 : 2,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)', transition: 'left 0.15s'
                }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D' }}>Aktifkan Repeat Order Mode</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>AI akan deteksi pelanggan lama & dorong pemesanan ulang.</div>
              </div>
            </label>

            <div style={{ opacity: cfg.repeat_order_mode ? 1 : 0.5, pointerEvents: cfg.repeat_order_mode ? 'auto' : 'none' }}>
              <label style={labelStyle}>Threshold hari sejak order terakhir</label>
              <input type="number" value={cfg.repeat_order_days_threshold} onChange={e => update('repeat_order_days_threshold', +e.target.value)} min={1} max={365} style={{ ...inputStyle, maxWidth: 200 }} />
              <div style={helpStyle}>Setelah berapa hari customer dianggap due untuk re-order. Misal 30 hari kalau pelanggan biasa habis stok 1 bulan.</div>

              <label style={labelStyle}>Template Ajakan Repeat Order</label>
              <textarea value={cfg.repeat_order_message} onChange={e => update('repeat_order_message', e.target.value)}
                placeholder={`Contoh:\nHi! Sudah lama nggak ngobrol — sekitar [hari] hari sejak pesanan terakhir. Stok produknya gimana? Kalau mau order ulang, kami ada promo bundling khusus pelanggan setia.`}
                style={{ ...textareaStyle, minHeight: 100 }} />
              <div style={helpStyle}>AI akan natural-ize template ini sesuai konteks percakapan. Boleh kosong, AI akan bikin sendiri.</div>
            </div>
          </>
        )}

        {tab === 'playground' && (
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ flex: 1, border: '1px solid #E5E5E5', borderRadius: 10, display: 'flex', flexDirection: 'column', height: 540, background: '#FAFAFA' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #E5E5E5', background: '#fff', borderRadius: '10px 10px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D' }}>Test {cfg.persona_name}</div>
                <button onClick={resetChat} style={{ fontSize: 11, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Reset chat</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {chat.length === 0 && <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', paddingTop: 60 }}>Ketik pesan untuk test AI dengan setting saat ini.</div>}
                {chat.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      padding: '8px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.55, maxWidth: '78%', whiteSpace: 'pre-wrap',
                      background: m.role === 'user' ? '#0D0D0D' : '#fff', color: m.role === 'user' ? '#fff' : '#0D0D0D',
                      border: m.role === 'user' ? 'none' : '1px solid #E5E5E5',
                    }}>{m.content}</div>
                  </div>
                ))}
                {testing && <div style={{ fontSize: 12, color: '#9CA3AF', padding: 4 }}>{cfg.persona_name} mengetik…</div>}
              </div>
              <div style={{ padding: 10, borderTop: '1px solid #E5E5E5', background: '#fff', borderRadius: '0 0 10px 10px', display: 'flex', gap: 8 }}>
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendTest()}
                  placeholder="Pura-pura kamu customer…"
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 13, outline: 'none', background: '#F7F7F7', fontFamily: 'inherit' }} />
                <button onClick={sendTest} disabled={!input.trim() || testing}
                  style={{ padding: '8px 14px', background: !input.trim() || testing ? '#F0F0F0' : '#0D0D0D', color: !input.trim() || testing ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: !input.trim() || testing ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  Kirim
                </button>
              </div>
            </div>
            <div style={{ width: 260, padding: 14, border: '1px solid #E5E5E5', borderRadius: 10, background: '#F7F7F7', alignSelf: 'flex-start' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0D0D0D', marginBottom: 10 }}>Setting yang sedang aktif</div>
              <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.7 }}>
                <div>Persona: <strong style={{ color: '#0D0D0D' }}>{cfg.persona_name}</strong></div>
                <div>Role: {cfg.persona_role || '—'}</div>
                <div>Model: {cfg.model}</div>
                <div>Custom prompt: {useCustomPrompt ? 'Ya' : 'Tidak'}</div>
                <div>Repeat order: {cfg.repeat_order_mode ? `ON (${cfg.repeat_order_days_threshold} hari)` : 'OFF'}</div>
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #E5E5E5' }}>
                  Knowledge base:
                  <div style={{ marginLeft: 8 }}>
                    {cfg.business_info && '✓ Bisnis '}
                    {cfg.products_info && '✓ Produk '}
                    {cfg.faq_info && '✓ FAQ '}
                    {cfg.policy_info && '✓ Kebijakan'}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 12, lineHeight: 1.5 }}>
                Setiap perubahan langsung kepake di playground. Klik <strong>Simpan</strong> di atas untuk apply ke auto-reply.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
