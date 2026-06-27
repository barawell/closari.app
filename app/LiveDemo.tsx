'use client'
import { useState, useRef, useEffect } from 'react'

type DemoMsg = { id: number; from: 'user' | 'ai' | 'agent'; text: string; time: string }
type Resp = { intent: string; reply: string; suggestion: string }

const PERSONAS = [
  { name: 'Budi Santoso', phone: '0812-3456-7890', avatar: 'B', tag: 'Repeat order', unread: 0 },
  { name: 'Rina Dewi', phone: '0856-7890-1234', avatar: 'R', tag: 'Baru', unread: 2 },
  { name: 'Andi Pratama', phone: '0813-2233-4455', avatar: 'A', tag: 'Prospek', unread: 0 },
]

const R: Record<string, Resp> = {
  harga: {
    intent: 'Menanyakan harga / paket',
    reply: 'Untuk harga, Closari punya beberapa paket kak — mulai dari paket basic buat tim kecil sampai paket yang lebih lengkap untuk tim besar. Boleh tahu dulu kira-kira berapa agen CS dan berapa nomor WA yang mau dipakai? Biar aku rekomendasikan paket yang paling pas 😊',
    suggestion: 'Mau saya kirimkan rincian paket + harga lengkapnya sekarang, kak? Saya bantu hitung yang paling hemat untuk kebutuhan tim kakak.',
  },
  banned: {
    intent: 'Khawatir nomor kena banned / restrict',
    reply: 'Tenang kak, justru itu yang Closari jaga 🙏 Kami pakai filter kontak aktif, cooldown otomatis per kontak, dan rate kirim yang aman supaya quality rating nomor tetap hijau. Jadi broadcast tetap jalan tanpa bikin nomor kena restrict.',
    suggestion: 'Boleh saya jelaskan singkat cara kerja proteksi anti-banned-nya, atau langsung bantu kakak setup nomor biar aman dari awal?',
  },
  fitur: {
    intent: 'Menanyakan fitur produk',
    reply: 'Closari lengkapnya ada: shared inbox untuk seluruh tim, Aira AI yang balas otomatis 24 jam sekaligus kasih saran ke agen, broadcast aman anti-banned, kirim/terima foto & dokumen, sampai follow-up tracking biar gak ada customer kelewat. Fitur mana yang paling kakak butuhkan?',
    suggestion: 'Mau saya tunjukkan fitur yang paling relevan untuk bisnis kakak? Atau saya bantu aktifkan Aira AI biar langsung bisa balas otomatis.',
  },
  daftar: {
    intent: 'Ingin mencoba / daftar',
    reply: 'Gratis dicoba kok kak, tanpa kartu kredit 🎉 Tinggal daftar, connect nomor WA Business resmi lewat Embedded Signup, dan setup-nya cuma sekitar 10 menit. Langsung bisa dipakai tim CS hari itu juga.',
    suggestion: 'Mau saya pandu daftarnya sekarang step-by-step, kak? Saya temani sampai nomor pertama kakak terhubung.',
  },
  komplain: {
    intent: 'Komplain / kendala pesanan',
    reply: 'Mohon maaf banget atas kendalanya kak 🙏 Biar cepat saya bantu, boleh dibagikan nomor order atau detail kendalanya? Saya cek langsung dan pastikan beres secepatnya.',
    suggestion: 'Saya eskalasi ke tim terkait sekarang dan update progresnya ke kakak lewat chat ini. Mau saya kabari begitu ada perkembangan?',
  },
  sapa: {
    intent: 'Sapaan / pertanyaan umum',
    reply: 'Halo kak! 👋 Terima kasih sudah menghubungi Closari. Ada yang bisa saya bantu hari ini — soal fitur, harga, atau cara mulainya?',
    suggestion: 'Saya bantu arahkan ke info yang kakak butuhkan. Lagi cari solusi untuk shared inbox, broadcast, atau auto-reply WhatsApp?',
  },
  default: {
    intent: 'Pertanyaan umum dari customer',
    reply: 'Terima kasih atas pesannya kak 🙏 Boleh dijelaskan sedikit lebih detail kebutuhannya? Biar saya bantu dengan info yang paling tepat.',
    suggestion: 'Saya bisa bantu soal fitur, harga, keamanan nomor, atau cara mulai pakai Closari. Mana yang mau kakak tahu duluan?',
  },
}

function getResponse(text: string): Resp {
  const t = text.toLowerCase()
  if (/(banned|ban\b|restrict|blokir|diblokir|suspend|aman|keamanan|quality|rating)/.test(t)) return R.banned
  if (/(harga|biaya|paket|bayar|tarif|berapa|mahal|murah|langganan|subscribe|diskon|promo)/.test(t)) return R.harga
  if (/(coba|trial|daftar|mulai|gabung|sign\s?up|onboard|setup|cara pakai|registrasi)/.test(t)) return R.daftar
  if (/(komplain|refund|lambat|error|rusak|gak bisa|nggak bisa|tidak bisa|kecewa|telat|salah|retur|order|pesanan|invoice|tagihan|belum sampai)/.test(t)) return R.komplain
  if (/(fitur|bisa apa|fungsi|kelebihan|broadcast|inbox|auto.?reply|balas otomatis|dokumen|foto|integrasi)/.test(t)) return R.fitur
  if (/(halo|hai|hi\b|pagi|siang|sore|malam|permisi|assalam|min\b|kak|mas|mbak|info)/.test(t)) return R.sapa
  return R.default
}

function now() { return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }

export default function LiveDemo() {
  const [activePerson, setActivePerson] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [messages, setMessages] = useState<Record<number, DemoMsg[]>>({
    0: [
      { id: 1, from: 'user', text: 'Halo kak, mau order lagi yang kemarin. Sekalian nanya, kalau langganan bulanan ada paket hemat gak?', time: '10:23' },
      { id: 2, from: 'ai', text: R.harga.reply, time: '10:23' },
    ],
    1: [
      { id: 1, from: 'user', text: 'Nomor WA toko saya sering kena banned. Di Closari aman gak?', time: '10:31' },
      { id: 2, from: 'ai', text: R.banned.reply, time: '10:31' },
    ],
    2: [
      { id: 1, from: 'user', text: 'Boleh minta daftar fitur lengkapnya?', time: '10:40' },
      { id: 2, from: 'ai', text: R.fitur.reply, time: '10:40' },
    ],
  })
  const [input, setInput] = useState('')
  const [copilot, setCopilot] = useState<Resp | null>(null)
  const [copilotLoading, setCopilotLoading] = useState(false)
  const [airaTyping, setAiraTyping] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const currentMsgs = messages[activePerson] || []

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const el = messagesContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [currentMsgs, airaTyping])

  // Saat ganti percakapan: tampilkan analisis Aira untuk pesan customer terakhir.
  useEffect(() => {
    const msgs = messages[activePerson] || []
    const lastUser = [...msgs].reverse().find(m => m.from === 'user')
    setAiraTyping(false)
    if (!lastUser) { setCopilot(null); setCopilotLoading(false); return }
    setCopilotLoading(true); setCopilot(null)
    const t = setTimeout(() => { setCopilot(getResponse(lastUser.text)); setCopilotLoading(false) }, 450)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePerson])

  function sendUser() {
    if (!input.trim() || sending) return
    const txt = input.trim()
    const resp = getResponse(txt)
    const pid = activePerson
    setInput('')
    setSending(true)
    setMessages(prev => ({ ...prev, [pid]: [...(prev[pid] || []), { id: Date.now(), from: 'user', text: txt, time: now() }] }))
    setCopilot(null); setCopilotLoading(true); setAiraTyping(true)
    setTimeout(() => { setCopilot(resp); setCopilotLoading(false) }, 700)
    setTimeout(() => {
      setMessages(prev => ({ ...prev, [pid]: [...(prev[pid] || []), { id: Date.now() + 1, from: 'ai', text: resp.reply, time: now() }] }))
      setAiraTyping(false)
      setSending(false)
    }, 1500)
  }

  function useSuggestion() {
    if (!copilot) return
    const pid = activePerson
    setMessages(prev => ({ ...prev, [pid]: [...(prev[pid] || []), { id: Date.now(), from: 'agent', text: copilot.suggestion, time: now() }] }))
    setCopilot(null)
  }

  // ── Pemilih percakapan untuk MOBILE (pill horizontal) ──
  const personaPills = (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '12px', borderBottom: '1px solid #F0F0F0', background: '#FAFAFA', WebkitOverflowScrolling: 'touch' }}>
      {PERSONAS.map((p, i) => (
        <button key={i} onClick={() => setActivePerson(i)} style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px 5px 6px', borderRadius: 999,
          border: `1px solid ${activePerson === i ? '#16A34A' : '#E5E5E5'}`,
          background: activePerson === i ? '#F0FDF4' : '#fff', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
        }}>
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#fff', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, border: '1px solid #BBF7D0', flexShrink: 0 }}>{p.avatar}</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0D0D0D', whiteSpace: 'nowrap' }}>{p.name.split(' ')[0]}</span>
          {p.unread > 0 && <span style={{ background: '#16A34A', color: '#fff', fontSize: 9, fontWeight: 700, padding: '0 5px', borderRadius: 999, lineHeight: '15px' }}>{p.unread}</span>}
        </button>
      ))}
    </div>
  )

  // ── Daftar percakapan untuk DESKTOP (sidebar) ──
  const conversationList = (
    <div style={{ borderRight: '1px solid #F0F0F0', display: 'flex', flexDirection: 'column', background: '#FAFAFA' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #F0F0F0' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#0D0D0D' }}>Percakapan</div>
        <div style={{ fontSize: 10, color: '#16A34A', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} /> Realtime aktif
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {PERSONAS.map((p, i) => (
          <div key={i} onClick={() => setActivePerson(i)} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #F4F4F4', background: activePerson === i ? '#fff' : 'transparent', borderLeft: `2px solid ${activePerson === i ? '#16A34A' : 'transparent'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, border: '1px solid #BBF7D0', flexShrink: 0 }}>{p.avatar}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0D0D0D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF' }}>{p.phone}</div>
              </div>
              {p.unread > 0 && <span style={{ background: '#16A34A', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 999, flexShrink: 0 }}>{p.unread}</span>}
            </div>
            <span style={{ fontSize: 9, padding: '1px 6px', background: '#F0FDF4', color: '#15803D', borderRadius: 3, border: '1px solid #BBF7D0', fontWeight: 600, marginTop: 6, display: 'inline-block', marginLeft: 38 }}>{p.tag}</span>
          </div>
        ))}
      </div>
    </div>
  )

  // ── Panel chat (desktop & mobile) ──
  const chatPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', borderRight: isMobile ? 'none' : '1px solid #F0F0F0', minWidth: 0 }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, border: '1px solid #BBF7D0', flexShrink: 0 }}>{PERSONAS[activePerson].avatar}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D' }}>{PERSONAS[activePerson].name}</div>
          <div style={{ fontSize: 10, color: '#9CA3AF' }}>{PERSONAS[activePerson].phone}</div>
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '2px 7px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 3 }}>
          <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z" fill="#16A34A"/></svg>
          AIRA ON
        </span>
      </div>
      <div ref={messagesContainerRef} style={{ ...(isMobile ? { height: 260 } : { flex: 1 }), overflowY: 'auto', padding: 14, background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {currentMsgs.map(m => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-start' : 'flex-end' }}>
            <div style={{ maxWidth: '82%', padding: '8px 11px', borderRadius: 9, fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: m.from === 'user' ? '#fff' : m.from === 'ai' ? '#F0FDF4' : '#0D0D0D',
              color: m.from === 'user' ? '#0D0D0D' : m.from === 'ai' ? '#14532D' : '#fff',
              border: m.from === 'user' ? '1px solid #E5E5E5' : m.from === 'ai' ? '1px solid #BBF7D0' : 'none' }}>
              {m.from === 'ai' && (
                <div style={{ fontSize: 9, fontWeight: 700, color: '#16A34A', marginBottom: 2, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z" fill="#16A34A"/></svg>
                  AIRA AI · balas otomatis
                </div>
              )}
              {m.from === 'agent' && (
                <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', marginBottom: 2, letterSpacing: '0.05em' }}>AGEN</div>
              )}
              {m.text}
            </div>
          </div>
        ))}
        {airaTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ padding: '7px 11px', borderRadius: 9, fontSize: 11, background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z" fill="#16A34A"/></svg>
              Aira mengetik…
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '10px 12px', borderTop: '1px solid #F0F0F0', display: 'flex', gap: 7, background: '#fff' }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendUser()}
          placeholder="Ketik sebagai customer…"
          style={{ flex: 1, minWidth: 0, padding: '9px 11px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#F7F7F7', color: '#0D0D0D' }} />
        <button onClick={sendUser} disabled={sending} style={{ padding: '9px 16px', background: '#0D0D0D', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1, fontFamily: 'inherit', flexShrink: 0 }}>Kirim</button>
      </div>
    </div>
  )

  // ── Panel Aira AI copilot (desktop & mobile) ──
  const copilotPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', minHeight: isMobile ? 150 : undefined }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 6, background: isMobile ? '#F0FDF4' : '#fff' }}>
        <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z" fill="#16A34A"/></svg>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#0D0D0D' }}>Aira AI Copilot</span>
      </div>
      <div style={{ flex: 1, padding: 14, overflowY: 'auto' }}>
        {copilotLoading ? (
          <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', padding: '30px 0' }}>
            <div style={{ marginBottom: 8 }}>Aira membaca percakapan…</div>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ margin: '0 auto', display: 'block' }}><circle cx="10" cy="10" r="7" stroke="#E5E5E5" strokeWidth="2.5"/><path d="M10 3a7 7 0 017 7" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"><animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="0.8s" repeatCount="indefinite"/></path></svg>
          </div>
        ) : copilot ? (
          <>
            <div style={{ fontSize: 10, fontWeight: 600, color: airaTyping ? '#9CA3AF' : '#16A34A', background: airaTyping ? '#F7F7F7' : '#F0FDF4', border: `1px solid ${airaTyping ? '#E5E5E5' : '#BBF7D0'}`, borderRadius: 6, padding: '6px 9px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 5 }}>
              {airaTyping ? '⏳ Aira sedang membalas otomatis…' : '✓ Aira sudah balas otomatis di chat'}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', marginBottom: 5 }}>MAKSUD CUSTOMER</div>
            <div style={{ fontSize: 11.5, color: '#374151', background: '#F7F7F7', border: '1px solid #E5E5E5', borderRadius: 6, padding: '7px 9px', lineHeight: 1.5, marginBottom: 14 }}>{copilot.intent}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', marginBottom: 5 }}>SARAN TINDAKAN AGEN</div>
            <div style={{ fontSize: 11.5, color: '#14532D', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, padding: '7px 9px', lineHeight: 1.55, marginBottom: 9 }}>{copilot.suggestion}</div>
            <button onClick={useSuggestion} style={{ width: '100%', padding: '8px 0', background: '#0D0D0D', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit' }}>Kirim sebagai agen →</button>
          </>
        ) : (
          <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', padding: '24px 8px', lineHeight: 1.6 }}>Kirim pesan sebagai customer — Aira akan balas otomatis di chat & kasih saran tindakan untuk agen di sini.</div>
        )}
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.06)', maxWidth: 480, margin: '0 auto' }}>
        {personaPills}
        {chatPanel}
        <div style={{ borderTop: '1px solid #F0F0F0' }}>{copilotPanel}</div>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.06)', display: 'grid', gridTemplateColumns: '210px 1fr 260px', height: 460, maxWidth: 980, margin: '0 auto' }}>
      {conversationList}
      {chatPanel}
      {copilotPanel}
    </div>
  )
}
