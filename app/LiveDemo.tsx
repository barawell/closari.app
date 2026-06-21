'use client'
import { useState, useRef, useEffect } from 'react'

type DemoMsg = { id: number; from: 'user' | 'ai' | 'agent'; text: string; time: string }

const PERSONAS = [
  { name: 'Budi Santoso', phone: '6281234567890', avatar: 'B' },
  { name: 'Rina Dewi', phone: '6285678901234', avatar: 'R' },
]

const DEMO_RESPONSES: Record<string, { intent: string; suggestion: string }> = {
  default: { intent: 'Pertanyaan umum dari customer', suggestion: 'Halo! Terima kasih sudah menghubungi kami. Ada yang bisa saya bantu hari ini?' },
  harga: { intent: 'Menanyakan harga / paket', suggestion: 'Halo! Untuk info harga, kami punya beberapa paket mulai dari yang basic. Boleh saya tahu kebutuhan tim kamu dulu? Berapa agen yang akan pakai?' },
  banned: { intent: 'Masalah nomor kena banned / restrict', suggestion: 'Wah, nomor kena banned memang menyebalkan. Closari dirancang khusus untuk mencegah ini — dengan filter kontak aktif dan rate yang aman. Mau saya jelaskan cara kerjanya?' },
  fitur: { intent: 'Menanyakan fitur yang tersedia', suggestion: 'Closari punya shared inbox untuk tim, AI copilot yang sarankan balasan, broadcast yang aman, dan support multi-nomor. Fitur mana yang paling kamu butuhkan?' },
  coba: { intent: 'Ingin mencoba / trial', suggestion: 'Gratis untuk dicoba, tidak perlu kartu kredit! Kamu bisa daftar di closari.id dan langsung connect nomor WA Business kamu. Proses setup sekitar 10 menit.' },
  terima: { intent: 'Mengucapkan terima kasih', suggestion: 'Sama-sama! Jangan ragu hubungi kami lagi kalau ada pertanyaan. Semoga timnya makin produktif!' },
}

function getResponse(text: string) {
  const t = text.toLowerCase()
  if (t.includes('harga') || t.includes('biaya') || t.includes('paket') || t.includes('bayar')) return DEMO_RESPONSES.harga
  if (t.includes('banned') || t.includes('ban') || t.includes('restrict') || t.includes('diblokir')) return DEMO_RESPONSES.banned
  if (t.includes('fitur') || t.includes('bisa apa') || t.includes('fungsi')) return DEMO_RESPONSES.fitur
  if (t.includes('coba') || t.includes('trial') || t.includes('daftar') || t.includes('mulai')) return DEMO_RESPONSES.coba
  if (t.includes('makasih') || t.includes('terima kasih') || t.includes('thanks')) return DEMO_RESPONSES.terima
  return DEMO_RESPONSES.default
}

function now() {
  return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export default function LiveDemo() {
  const [activePerson, setActivePerson] = useState(0)
  const [messages, setMessages] = useState<Record<number, DemoMsg[]>>({
    0: [{ id: 1, from: 'user', text: 'Halo, mau tanya soal Closari dong', time: '10:23' }],
    1: [{ id: 1, from: 'user', text: 'Nomor WA saya kena restrict, gimana solusinya?', time: '10:31' }],
  })
  const [input, setInput] = useState('')
  const [copilot, setCopilot] = useState<{ intent: string; suggestion: string } | null>(null)
  const [copilotLoading, setCopilotLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const currentMsgs = messages[activePerson] || []

  // Scroll cuma di dalam container messages — bukan window
  useEffect(() => {
    const el = messagesContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [currentMsgs])

  useEffect(() => {
    const lastUserMsg = [...currentMsgs].reverse().find(m => m.from === 'user')
    if (!lastUserMsg) return
    setCopilotLoading(true)
    setCopilot(null)
    const timer = setTimeout(() => {
      setCopilot(getResponse(lastUserMsg.text))
      setCopilotLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [activePerson, currentMsgs.length])

  function sendAsAgent(text: string) {
    if (!text.trim() || sending) return
    setSending(true)
    const agentMsg: DemoMsg = { id: Date.now(), from: 'agent', text: text.trim(), time: now() }
    setMessages(prev => ({ ...prev, [activePerson]: [...(prev[activePerson] || []), agentMsg] }))
    setInput('')
    setCopilot(null)

    setTimeout(() => {
      const replies = [
        'Oh ok, jadi gimana cara mulainya?',
        'Wah menarik! Berapa harganya?',
        'Bisa dicoba gratis dulu gak?',
        'Oke, saya coba daftar dulu ya',
        'Makasih infonya!',
      ]
      const userReply: DemoMsg = { id: Date.now() + 1, from: 'user', text: replies[Math.floor(Math.random() * replies.length)], time: now() }
      setMessages(prev => ({ ...prev, [activePerson]: [...(prev[activePerson] || []), userReply] }))
      setSending(false)
    }, 1500)
  }

  const person = PERSONAS[activePerson]

  return (
    <div style={{ border: '1px solid #E5E5E5', borderRadius: 12, overflow: 'hidden', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', display: 'flex', height: 520 }}>

      {/* Conversation list */}
      <div style={{ width: 220, borderRight: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', background: '#FAFAFA' }}>
        <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #F0F0F0' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0D0D0D' }}>Percakapan</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
            realtime aktif
          </div>
        </div>
        {PERSONAS.map((p, i) => (
          <div key={i} onClick={() => setActivePerson(i)} style={{ padding: '10px 14px', borderBottom: '1px solid #F0F0F0', cursor: 'pointer', background: activePerson === i ? '#F0FDF4' : '#fff', borderLeft: `2px solid ${activePerson === i ? '#16A34A' : 'transparent'}` }}>
            <div style={{ fontWeight: activePerson === i ? 600 : 500, fontSize: 13, color: '#0D0D0D', marginBottom: 2 }}>{p.name}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>{p.phone}</div>
          </div>
        ))}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', padding: 12 }}>
          <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.5, textAlign: 'center', width: '100%' }}>
            Demo interaktif.<br />Ketik pesan di bawah.
          </div>
        </div>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', gap: 10, background: '#fff' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#6B7280', flexShrink: 0 }}>
            {person.avatar}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D' }}>{person.name}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>{person.phone}</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
            Online
          </div>
        </div>

        <div ref={messagesContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 8, background: '#FAFAFA' }}>
          {currentMsgs.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-start' : 'flex-end' }}>
              <div style={{ maxWidth: '75%' }}>
                {m.from === 'user' && <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 3, fontWeight: 500 }}>{person.name}</div>}
                {m.from === 'agent' && <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 3, fontWeight: 500, textAlign: 'right' }}>Agen (kamu)</div>}
                <div style={{
                  padding: '8px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.5,
                  background: m.from === 'user' ? '#fff' : '#0D0D0D',
                  color: m.from === 'user' ? '#0D0D0D' : '#fff',
                  border: m.from === 'user' ? '1px solid #E5E5E5' : 'none',
                }}>
                  {m.text}
                </div>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3, textAlign: m.from === 'user' ? 'left' : 'right' }}>{m.time}</div>
              </div>
            </div>
          ))}
          {sending && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '8px 14px', background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, fontSize: 13, color: '#9CA3AF' }}>
                sedang mengetik…
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '10px 12px', background: '#fff', borderTop: '1px solid #E5E5E5', display: 'flex', gap: 8 }}>
          <input
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendAsAgent(input)}
            placeholder="Balas sebagai agen… (Enter kirim)"
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#F7F7F7', color: '#0D0D0D' }}
          />
          <button onClick={() => sendAsAgent(input)} disabled={!input.trim() || sending}
            style={{ padding: '8px 14px', background: !input.trim() || sending ? '#F0F0F0' : '#0D0D0D', color: !input.trim() || sending ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: !input.trim() || sending ? 'not-allowed' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            Kirim
          </button>
        </div>
      </div>

      {/* Copilot */}
      <div style={{ width: 220, borderLeft: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z" fill="#16A34A"/></svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#0D0D0D' }}>AI Copilot</span>
        </div>
        <div style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
          {copilotLoading ? (
            <div style={{ paddingTop: 20, fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.6 }}>Membaca percakapan…</div>
          ) : copilot ? (
            <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Maksud</div>
                <div style={{ fontSize: 12, color: '#374151', background: '#F7F7F7', border: '1px solid #E5E5E5', borderRadius: 6, padding: '8px 10px', lineHeight: 1.5 }}>{copilot.intent}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Saran balasan</div>
                <div style={{ fontSize: 12, color: '#14532D', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, padding: '8px 10px', lineHeight: 1.5, marginBottom: 8 }}>{copilot.suggestion}</div>
                <button onClick={() => setInput(copilot.suggestion)}
                  style={{ width: '100%', padding: '7px 0', background: '#0D0D0D', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Pakai saran ini
                </button>
              </div>
            </>
          ) : (
            <div style={{ paddingTop: 20, fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>Belum ada saran.</div>
          )}
        </div>
      </div>
    </div>
  )
}
