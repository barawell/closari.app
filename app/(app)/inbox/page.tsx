'use client'
import { useEffect, useRef, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'

type Conv = { id: string; status: string; last_message_at: string; contact: any }
type Msg = { id: string; direction: string; body: string; sender: string; created_at: string }

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}j`
  return `${Math.floor(h / 24)}h`
}

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
    const j = await res.json()
    setConvs(j.conversations || [])
  }
  async function loadMsgs(id: string) {
    const res = await authFetch(`/api/inbox/messages?conversation_id=${id}`)
    const j = await res.json()
    setMsgs(j.messages || [])
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
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
  useEffect(() => {
    if (active) { loadMsgs(active.id); loadCopilot(active.id) }
  }, [active])

  async function send() {
    if (!active || !text.trim()) return
    setSending(true)
    try {
      const res = await authFetch('/api/inbox/send', { method: 'POST', body: JSON.stringify({ conversation_id: active.id, text }) })
      const j = await res.json()
      if (!res.ok) { alert(j.error || 'Gagal kirim'); return }
      setText('')
      await loadMsgs(active.id)
    } finally { setSending(false) }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F8FAFC' }}>

      {/* CONVERSATION LIST */}
      <div style={{
        width: 280, background: '#fff',
        borderRight: '1px solid #E2E8F0',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        <div style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid #F1F5F9',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Percakapan</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{convs.length} aktif</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {convs.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
              <div style={{ fontSize: 13, color: '#94A3B8' }}>Belum ada percakapan masuk.</div>
            </div>
          ) : convs.map(c => {
            const ct = contactOf(c)
            const isActive = active?.id === c.id
            return (
              <div key={c.id} onClick={() => setActive(c)} style={{
                padding: '12px 16px',
                borderBottom: '1px solid #F8FAFC',
                cursor: 'pointer',
                background: isActive ? '#F0FDF4' : 'transparent',
                borderLeft: isActive ? '3px solid #00D97E' : '3px solid transparent',
                transition: 'background 0.1s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A' }}>
                    {ct.name || ct.phone}
                  </div>
                  <div style={{ fontSize: 11, color: '#CBD5E1' }}>
                    {c.last_message_at ? timeAgo(c.last_message_at) : ''}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>
                  {ct.phone}{ct.opted_out ? ' · opt-out' : ''}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F5F9' }}>
          <button onClick={loadConvs} style={{
            width: '100%', padding: '8px 0', fontSize: 12,
            color: '#94A3B8', background: 'none', border: '1px solid #E2E8F0',
            borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
          }}>Refresh</button>
        </div>
      </div>

      {/* CHAT THREAD */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #E2E8F0' }}>
        {!active ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#CBD5E1' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#94A3B8' }}>Pilih percakapan</div>
            <div style={{ fontSize: 13, color: '#CBD5E1', marginTop: 4 }}>untuk mulai balas pesan</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              padding: '14px 20px', background: '#fff',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: '#0A0F1E', color: '#00D97E',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, flexShrink: 0,
              }}>
                {(contactOf(active).name || contactOf(active).phone || '?')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#0F172A' }}>
                  {contactOf(active).name || contactOf(active).phone}
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>{contactOf(active).phone}</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 10, background: '#F8FAFC' }}>
              {msgs.map(m => (
                <div key={m.id} style={{
                  display: 'flex',
                  justifyContent: m.direction === 'in' ? 'flex-start' : 'flex-end',
                }}>
                  <div style={{
                    maxWidth: '72%', padding: '10px 14px', borderRadius: 12,
                    fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                    background: m.direction === 'in'
                      ? '#fff'
                      : m.sender === 'ai'
                        ? '#F0FDF4'
                        : '#0A0F1E',
                    color: m.direction === 'in'
                      ? '#0F172A'
                      : m.sender === 'ai'
                        ? '#065F46'
                        : '#fff',
                    border: m.direction === 'in'
                      ? '1px solid #E2E8F0'
                      : m.sender === 'ai'
                        ? '1px solid #A7F3D0'
                        : 'none',
                  }}>
                    {m.sender === 'ai' && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#00D97E', marginBottom: 4, letterSpacing: '0.06em' }}>✨ AI</div>
                    )}
                    {m.body}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: '12px 16px', background: '#fff',
              borderTop: '1px solid #E2E8F0',
              display: 'flex', gap: 8, alignItems: 'flex-end',
            }}>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Tulis balasan… (Enter kirim, Shift+Enter baris baru)"
                rows={1}
                style={{
                  flex: 1, padding: '10px 14px', resize: 'none',
                  border: '1px solid #E2E8F0', borderRadius: 10,
                  fontSize: 14, fontFamily: 'inherit', outline: 'none',
                  background: '#F8FAFC', color: '#0F172A',
                  lineHeight: 1.5,
                }}
              />
              <button
                onClick={send}
                disabled={sending || !text.trim()}
                style={{
                  padding: '10px 18px', borderRadius: 10,
                  background: sending || !text.trim() ? '#F1F5F9' : '#0A0F1E',
                  color: sending || !text.trim() ? '#CBD5E1' : '#fff',
                  border: 0, fontSize: 14, fontWeight: 600,
                  cursor: sending || !text.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', flexShrink: 0,
                }}
              >
                {sending ? '…' : 'Kirim'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* COPILOT PANEL */}
      <div style={{ width: 280, background: '#fff', flexShrink: 0, overflowY: 'auto', borderLeft: '1px solid #E2E8F0' }}>
        <div style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>✨</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>Copilot</span>
          </div>
          {active && (
            <button onClick={() => loadCopilot(active.id)} style={{
              fontSize: 11, color: '#00D97E', background: 'none',
              border: '1px solid #A7F3D0', borderRadius: 6,
              padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
            }}>Refresh</button>
          )}
        </div>

        <div style={{ padding: 16 }}>
          {!active ? (
            <div style={{ textAlign: 'center', paddingTop: 24 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>✨</div>
              <div style={{ fontSize: 13, color: '#CBD5E1' }}>Pilih percakapan untuk bantuan AI.</div>
            </div>
          ) : coLoading ? (
            <div style={{ textAlign: 'center', paddingTop: 24 }}>
              <div style={{ fontSize: 13, color: '#94A3B8' }}>AI sedang membaca percakapan…</div>
            </div>
          ) : !copilot ? (
            <div style={{ fontSize: 13, color: '#CBD5E1', textAlign: 'center', paddingTop: 24 }}>Tidak ada saran.</div>
          ) : (
            <>
              {copilot.intent && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Maksud customer
                  </div>
                  <div style={{
                    fontSize: 13, lineHeight: 1.6, color: '#374151',
                    background: '#F8FAFC', border: '1px solid #E2E8F0',
                    borderRadius: 8, padding: '10px 12px',
                  }}>{copilot.intent}</div>
                </div>
              )}
              {copilot.suggestion && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Saran balasan
                  </div>
                  <div style={{
                    fontSize: 13, lineHeight: 1.6, color: '#065F46',
                    background: '#F0FDF4', border: '1px solid #A7F3D0',
                    borderRadius: 8, padding: '10px 12px', whiteSpace: 'pre-wrap',
                    marginBottom: 10,
                  }}>{copilot.suggestion}</div>
                  <button
                    onClick={() => setText(copilot.suggestion)}
                    style={{
                      width: '100%', padding: '9px 0',
                      background: '#0A0F1E', color: '#fff',
                      border: 0, borderRadius: 8, fontWeight: 600,
                      cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
                    }}
                  >Pakai saran ini</button>
                  <p style={{ fontSize: 11, color: '#CBD5E1', marginTop: 8, textAlign: 'center' }}>
                    Kamu tetap bisa edit sebelum kirim.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
