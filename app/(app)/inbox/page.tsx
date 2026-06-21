'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { authFetch } from '@/lib/client-fetch'
import { supabase } from '@/lib/supabase'

type Conv = { id: string; status: string; last_message_at: string; contact: any }
type Msg = { id: string; direction: string; body: string; sender: string; created_at: string; status?: string }

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'baru'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}j`
  return `${Math.floor(h / 24)}h`
}

function Avatar({ name }: { name: string }) {
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: '#F0F0F0', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, border: '1px solid #E5E5E5' }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

function StatusIcon({ status }: { status?: string }) {
  if (!status || status === 'sent') return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
  if (status === 'delivered') return <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 6L9 9L14 3" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
  if (status === 'read') return <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 6L9 9L14 3" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
  if (status === 'failed') return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#DC2626" strokeWidth="1.4"/><path d="M6 3.5V6.5M6 8.5V8.6" stroke="#DC2626" strokeWidth="1.4" strokeLinecap="round"/></svg>
  return null
}

export default function InboxPage() {
  const [convs, setConvs] = useState<Conv[]>([])
  const [active, setActive] = useState<Conv | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [copilot, setCopilot] = useState<{ intent: string; suggestion: string } | null>(null)
  const [coLoading, setCoLoading] = useState(false)
  const [unread, setUnread] = useState<Record<string, number>>({})
  const endRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<Conv | null>(null)
  activeRef.current = active

  const contactOf = (c: Conv) => (Array.isArray(c?.contact) ? c.contact[0] : c?.contact) || {}

  const loadConvs = useCallback(async () => {
    const res = await authFetch('/api/inbox/conversations')
    const j = await res.json()
    setConvs(j.conversations || [])
  }, [])

  const loadMsgs = useCallback(async (id: string) => {
    const res = await authFetch(`/api/inbox/messages?conversation_id=${id}`)
    const j = await res.json()
    setMsgs(j.messages || [])
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    // Clear unread
    setUnread(prev => ({ ...prev, [id]: 0 }))
  }, [])

  async function loadCopilot(id: string) {
    setCoLoading(true); setCopilot(null)
    try {
      const res = await authFetch('/api/inbox/copilot', { method: 'POST', body: JSON.stringify({ conversation_id: id }) })
      const j = await res.json()
      if (res.ok) setCopilot({ intent: j.intent || '', suggestion: j.suggestion || '' })
    } finally { setCoLoading(false) }
  }

  // Supabase Realtime
  useEffect(() => {
    loadConvs()

    const channel = supabase
      .channel('inbox-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wa_messages' }, (payload) => {
        const newMsg = payload.new as Msg & { conversation_id: string; tenant_id: string }
        const convId = newMsg.conversation_id

        // Kalau sedang buka percakapan ini, langsung append pesan
        if (activeRef.current?.id === convId) {
          setMsgs(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        } else {
          // Increment unread badge
          setUnread(prev => ({ ...prev, [convId]: (prev[convId] || 0) + 1 }))
        }

        // Refresh conversation list untuk update last_message_at
        loadConvs()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wa_messages' }, (payload) => {
        const updated = payload.new as Msg
        setMsgs(prev => prev.map(m => m.id === updated.id ? { ...m, status: updated.status } : m))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadConvs])

  useEffect(() => {
    if (active) { loadMsgs(active.id); loadCopilot(active.id) }
  }, [active, loadMsgs])

  async function send() {
    if (!active || !text.trim()) return
    setSending(true)
    const optimistic: Msg = { id: `opt-${Date.now()}`, direction: 'out', body: text, sender: 'agent', created_at: new Date().toISOString(), status: 'sending' }
    setMsgs(prev => [...prev, optimistic])
    setText('')
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    try {
      const res = await authFetch('/api/inbox/send', { method: 'POST', body: JSON.stringify({ conversation_id: active.id, text: optimistic.body }) })
      const j = await res.json()
      if (!res.ok) {
        setMsgs(prev => prev.map(m => m.id === optimistic.id ? { ...m, status: 'failed' } : m))
        alert(j.error || 'Gagal kirim')
      } else {
        setMsgs(prev => prev.map(m => m.id === optimistic.id ? { ...m, status: 'sent' } : m))
      }
    } finally { setSending(false) }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#fff' }}>
      {/* CONVERSATION LIST */}
      <div style={{ width: 260, borderRight: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D' }}>Percakapan</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{convs.length} aktif · realtime</div>
          </div>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 0 2px #F0FDF4' }} title="Realtime aktif" />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {convs.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.6 }}>Belum ada percakapan.<br />Pesan masuk otomatis muncul di sini.</div>
            </div>
          ) : convs.map(c => {
            const ct = contactOf(c)
            const isActive = active?.id === c.id
            const badge = unread[c.id] || 0
            return (
              <div key={c.id} onClick={() => setActive(c)} style={{ padding: '10px 14px', borderBottom: '1px solid #F7F7F7', cursor: 'pointer', background: isActive ? '#F0FDF4' : '#fff', borderLeft: `2px solid ${isActive ? '#16A34A' : 'transparent'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <div style={{ fontWeight: badge > 0 ? 600 : 500, fontSize: 13, color: '#0D0D0D' }}>{ct.name || ct.phone}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {badge > 0 && (
                      <span style={{ background: '#16A34A', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 999, minWidth: 16, textAlign: 'center' }}>{badge}</span>
                    )}
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{c.last_message_at ? timeAgo(c.last_message_at) : ''}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{ct.phone}{ct.opted_out ? ' · opt-out' : ''}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* CHAT THREAD */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #E5E5E5' }}>
        {!active ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.7 }}>Pilih percakapan<br />untuk mulai membalas</div>
          </div>
        ) : (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', gap: 10, background: '#fff' }}>
              <Avatar name={contactOf(active).name || contactOf(active).phone} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: '#0D0D0D' }}>{contactOf(active).name || contactOf(active).phone}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{contactOf(active).phone}</div>
              </div>
              <button onClick={() => loadCopilot(active.id)} style={{ padding: '5px 10px', fontSize: 11, color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                Refresh AI
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, background: '#FAFAFA' }}>
              {msgs.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.direction === 'in' ? 'flex-start' : 'flex-end' }}>
                  <div style={{ maxWidth: '70%' }}>
                    <div style={{
                      padding: '9px 13px', borderRadius: 10,
                      fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap',
                      background: m.direction === 'in' ? '#fff' : m.sender === 'ai' ? '#F0FDF4' : '#0D0D0D',
                      color: m.direction === 'in' ? '#0D0D0D' : m.sender === 'ai' ? '#14532D' : '#fff',
                      border: m.direction === 'in' ? '1px solid #E5E5E5' : m.sender === 'ai' ? '1px solid #BBF7D0' : 'none',
                      opacity: m.status === 'sending' ? 0.6 : 1,
                    }}>
                      {m.sender === 'ai' && (
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#16A34A', marginBottom: 3, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z" fill="#16A34A"/></svg>
                          AI COPILOT
                        </div>
                      )}
                      {m.body}
                    </div>
                    {m.direction === 'out' && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 3, paddingRight: 2 }}>
                        <StatusIcon status={m.status} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <div style={{ padding: '10px 14px', background: '#fff', borderTop: '1px solid #E5E5E5', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                value={text} onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Tulis balasan… (Enter kirim, Shift+Enter baris baru)"
                rows={1}
                style={{ flex: 1, padding: '9px 12px', resize: 'none', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#F7F7F7', color: '#0D0D0D', lineHeight: 1.5 }}
              />
              <button onClick={send} disabled={sending || !text.trim()}
                style={{ padding: '9px 16px', borderRadius: 7, background: sending || !text.trim() ? '#F0F0F0' : '#0D0D0D', color: sending || !text.trim() ? '#9CA3AF' : '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: sending || !text.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                {sending ? '…' : 'Kirim'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* COPILOT */}
      <div style={{ width: 260, background: '#fff', flexShrink: 0, overflowY: 'auto' }}>
        <div style={{ padding: '13px 14px 11px', borderBottom: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#0D0D0D' }}>
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z" fill="#16A34A"/></svg>
            Copilot
          </div>
        </div>
        <div style={{ padding: 14 }}>
          {!active ? (
            <div style={{ paddingTop: 24, fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.6 }}>Pilih percakapan untuk melihat saran AI.</div>
          ) : coLoading ? (
            <div style={{ paddingTop: 24, fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>Membaca percakapan…</div>
          ) : !copilot ? (
            <div style={{ paddingTop: 24, fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>Tidak ada saran.</div>
          ) : (
            <>
              {copilot.intent && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>Maksud customer</div>
                  <div style={{ fontSize: 13, color: '#374151', background: '#F7F7F7', border: '1px solid #E5E5E5', borderRadius: 7, padding: '9px 11px', lineHeight: 1.55 }}>{copilot.intent}</div>
                </div>
              )}
              {copilot.suggestion && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>Saran balasan</div>
                  <div style={{ fontSize: 13, color: '#14532D', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 7, padding: '9px 11px', lineHeight: 1.55, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{copilot.suggestion}</div>
                  <button onClick={() => setText(copilot.suggestion)}
                    style={{ width: '100%', padding: '8px 0', background: '#0D0D0D', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 500, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                    Pakai saran ini
                  </button>
                  <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 7, textAlign: 'center' }}>Kamu tetap bisa edit sebelum kirim.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
