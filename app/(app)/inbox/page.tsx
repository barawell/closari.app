'use client'
import { useEffect, useRef, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'

type Conv = { id: string; status: string; last_message_at: string; contact: any }
type Msg = { id: string; direction: string; body: string; sender: string; created_at: string }

export default function InboxPage() {
  const [convs, setConvs] = useState<Conv[]>([])
  const [active, setActive] = useState<Conv | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [copilot, setCopilot] = useState<{ intent: string; suggestion: string } | null>(null)
  const [coLoading, setCoLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const contactOf = (c: Conv) => (Array.isArray(c?.contact) ? c.contact[0] : c?.contact) || {}

  async function loadConvs() {
    const res = await authFetch('/api/inbox/conversations')
    const j = await res.json(); setConvs(j.conversations || [])
  }
  async function loadMsgs(id: string) {
    const res = await authFetch(`/api/inbox/messages?conversation_id=${id}`)
    const j = await res.json(); setMsgs(j.messages || [])
    setTimeout(() => endRef.current?.scrollIntoView(), 50)
  }
  async function loadCopilot(id: string) {
    setCoLoading(true); setCopilot(null)
    try {
      const res = await authFetch('/api/inbox/copilot', { method: 'POST', body: JSON.stringify({ conversation_id: id }) })
      const j = await res.json()
      if (res.ok) setCopilot({ intent: j.intent || '', suggestion: j.suggestion || '' })
    } finally { setCoLoading(false) }
  }

  useEffect(() => { loadConvs() }, [])
  useEffect(() => { if (active) { loadMsgs(active.id); loadCopilot(active.id) } }, [active])

  async function send() {
    if (!active || !text.trim()) return
    setSending(true)
    try {
      const res = await authFetch('/api/inbox/send', { method: 'POST', body: JSON.stringify({ conversation_id: active.id, text }) })
      const j = await res.json()
      if (!res.ok) { alert(j.error || 'Gagal kirim'); return }
      setText(''); await loadMsgs(active.id)
    } finally { setSending(false) }
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* daftar percakapan */}
      <div style={{ width: 280, borderRight: '1px solid #eee', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ padding: 16, fontWeight: 600, borderBottom: '1px solid #eee' }}>Percakapan</div>
        {convs.length === 0 && <div style={{ padding: 16, color: '#999', fontSize: 13 }}>Belum ada percakapan.</div>}
        {convs.map(c => {
          const ct = contactOf(c)
          return (
            <div key={c.id} onClick={() => setActive(c)}
              style={{ padding: 14, borderBottom: '1px solid #f4f4f4', cursor: 'pointer', background: active?.id === c.id ? '#f5f8ff' : 'transparent' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{ct.name || ct.phone}</div>
              <div style={{ fontSize: 12, color: '#999' }}>{ct.phone}{ct.opted_out ? ' · opt-out' : ''}</div>
            </div>
          )
        })}
      </div>

      {/* thread */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #eee' }}>
        {!active ? <div style={{ margin: 'auto', color: '#999' }}>Pilih percakapan</div> : (
          <>
            <div style={{ padding: 16, borderBottom: '1px solid #eee', fontWeight: 600 }}>{contactOf(active).name || contactOf(active).phone}</div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#fafafa' }}>
              {msgs.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.direction === 'in' ? 'flex-start' : 'flex-end', marginBottom: 8 }}>
                  <div style={{ maxWidth: '72%', padding: '8px 12px', borderRadius: 12, fontSize: 14,
                    background: m.direction === 'in' ? '#fff' : (m.sender === 'ai' ? '#e7f0ff' : '#dcf8c6'), border: '1px solid #eee', whiteSpace: 'pre-wrap' }}>
                    {m.sender === 'ai' && <div style={{ fontSize: 10, color: '#2563eb', marginBottom: 2 }}>AI</div>}
                    {m.body}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div style={{ padding: 12, borderTop: '1px solid #eee', display: 'flex', gap: 8 }}>
              <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="Tulis balasan…" style={{ flex: 1, padding: 10, border: '1px solid #ddd', borderRadius: 8 }} />
              <button onClick={send} disabled={sending || !text.trim()}
                style={{ padding: '10px 18px', background: '#111', color: '#fff', border: 0, borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Kirim</button>
            </div>
          </>
        )}
      </div>

      {/* COPILOT panel kanan */}
      <div style={{ width: 300, flexShrink: 0, overflowY: 'auto', background: '#fcfcfd' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>✨ Copilot</span>
          {active && <button onClick={() => loadCopilot(active.id)} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 0, cursor: 'pointer' }}>Refresh</button>}
        </div>
        {!active ? <div style={{ padding: 16, color: '#aaa', fontSize: 13 }}>Pilih percakapan untuk bantuan AI.</div> :
          coLoading ? <div style={{ padding: 16, color: '#888', fontSize: 13 }}>AI lagi baca percakapan…</div> :
          !copilot ? <div style={{ padding: 16, color: '#aaa', fontSize: 13 }}>Tidak ada saran.</div> : (
          <div style={{ padding: 16 }}>
            {copilot.intent && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#999', marginBottom: 6 }}>Maksud customer</div>
                <div style={{ fontSize: 14, lineHeight: 1.5, color: '#333', background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: 12 }}>{copilot.intent}</div>
              </div>
            )}
            {copilot.suggestion && (
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#999', marginBottom: 6 }}>Saran balasan</div>
                <div style={{ fontSize: 14, lineHeight: 1.5, color: '#333', background: '#eef4ff', border: '1px solid #d9e6ff', borderRadius: 10, padding: 12, whiteSpace: 'pre-wrap' }}>{copilot.suggestion}</div>
                <button onClick={() => setText(copilot.suggestion)}
                  style={{ marginTop: 10, width: '100%', padding: '9px 0', background: '#2563eb', color: '#fff', border: 0, borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  Pakai saran ini
                </button>
                <p style={{ fontSize: 11, color: '#aaa', marginTop: 8 }}>Kamu tetap bisa edit sebelum kirim.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
