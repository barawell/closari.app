'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { authFetch } from '@/lib/client-fetch'
import { supabase } from '@/lib/supabase'

type Conv = { id: string; status: string; last_message_at: string; tags?: string[]; contact: any }
type Msg = { id: string; direction: string; body: string; sender: string; created_at: string; status?: string }
type ContactDetail = { contact: any; stats: { total_messages_in: number; total_messages_out: number; total_conversations: number; days_since_first_contact: number | null; days_since_last_order: number | null } }
type QuickReply = { id: string; shortcut: string; title: string; body: string }

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'baru'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}j`
  return `${Math.floor(h / 24)}h`
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: '#F0F0F0', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 600, border: '1px solid #E5E5E5' }}>
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
  const [contactDetail, setContactDetail] = useState<ContactDetail | null>(null)
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [newTag, setNewTag] = useState('')
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [showQR, setShowQR] = useState(false)
  const [rightTab, setRightTab] = useState<'contact' | 'copilot'>('contact')
  const [search, setSearch] = useState('')

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
    setUnread(prev => ({ ...prev, [id]: 0 }))
  }, [])

  async function loadContactDetail(contactId: string) {
    if (!contactId) return
    const res = await authFetch(`/api/contacts/${contactId}`)
    const j = await res.json()
    if (res.ok) {
      setContactDetail(j)
      setNotesDraft(j.contact?.notes || '')
    }
  }

  async function loadCopilot(id: string) {
    setCoLoading(true); setCopilot(null)
    try {
      const res = await authFetch('/api/inbox/copilot', { method: 'POST', body: JSON.stringify({ conversation_id: id }) })
      const j = await res.json()
      if (res.ok) setCopilot({ intent: j.intent || '', suggestion: j.suggestion || '' })
    } finally { setCoLoading(false) }
  }

  // Load quick replies once
  useEffect(() => {
    (async () => {
      const res = await authFetch('/api/quick-replies')
      const j = await res.json()
      setQuickReplies(j.quick_replies || [])
    })()
  }, [])

  // Realtime
  useEffect(() => {
    loadConvs()
    const channel = supabase
      .channel('inbox-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wa_messages' }, (payload) => {
        const newMsg = payload.new as Msg & { conversation_id: string }
        const convId = newMsg.conversation_id
        if (activeRef.current?.id === convId) {
          setMsgs(prev => { if (prev.find(m => m.id === newMsg.id)) return prev; return [...prev, newMsg] })
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        } else {
          setUnread(prev => ({ ...prev, [convId]: (prev[convId] || 0) + 1 }))
        }
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
    if (active) {
      loadMsgs(active.id)
      const ct = contactOf(active)
      if (ct.id) loadContactDetail(ct.id)
      setRightTab('contact')
    }
  }, [active, loadMsgs])

  async function send() {
    if (!active || !text.trim()) return
    setSending(true)
    const optimistic: Msg = { id: `opt-${Date.now()}`, direction: 'out', body: text, sender: 'agent', created_at: new Date().toISOString(), status: 'sending' }
    setMsgs(prev => [...prev, optimistic])
    const textToSend = text
    setText('')
    setShowQR(false)
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    try {
      const res = await authFetch('/api/inbox/send', { method: 'POST', body: JSON.stringify({ conversation_id: active.id, text: textToSend }) })
      const j = await res.json()
      if (!res.ok) {
        setMsgs(prev => prev.map(m => m.id === optimistic.id ? { ...m, status: 'failed' } : m))
        alert(j.error || 'Gagal kirim')
      } else {
        setMsgs(prev => prev.map(m => m.id === optimistic.id ? { ...m, status: 'sent' } : m))
      }
    } finally { setSending(false) }
  }

  async function saveNotes() {
    if (!contactDetail?.contact?.id) return
    setSavingNotes(true)
    try {
      const res = await authFetch(`/api/contacts/${contactDetail.contact.id}`, { method: 'PUT', body: JSON.stringify({ notes: notesDraft }) })
      if (res.ok) {
        setContactDetail(prev => prev ? { ...prev, contact: { ...prev.contact, notes: notesDraft } } : null)
      }
    } finally { setSavingNotes(false) }
  }

  async function addTag() {
    if (!contactDetail?.contact?.id || !newTag.trim()) return
    const tag = newTag.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 30)
    const currentTags = contactDetail.contact.tags || []
    if (currentTags.includes(tag)) { setNewTag(''); return }
    const updated = [...currentTags, tag]
    const res = await authFetch(`/api/contacts/${contactDetail.contact.id}`, { method: 'PUT', body: JSON.stringify({ tags: updated }) })
    if (res.ok) {
      setContactDetail(prev => prev ? { ...prev, contact: { ...prev.contact, tags: updated } } : null)
      setNewTag('')
    }
  }

  async function removeTag(tag: string) {
    if (!contactDetail?.contact?.id) return
    const updated = (contactDetail.contact.tags || []).filter((t: string) => t !== tag)
    const res = await authFetch(`/api/contacts/${contactDetail.contact.id}`, { method: 'PUT', body: JSON.stringify({ tags: updated }) })
    if (res.ok) {
      setContactDetail(prev => prev ? { ...prev, contact: { ...prev.contact, tags: updated } } : null)
    }
  }

  async function markOrder() {
    if (!contactDetail?.contact?.id) return
    const res = await authFetch(`/api/contacts/${contactDetail.contact.id}`, { method: 'PUT', body: JSON.stringify({ mark_order: true }) })
    if (res.ok) loadContactDetail(contactDetail.contact.id)
  }

  function handleTextChange(v: string) {
    setText(v)
    // Toggle quick reply picker kalau text dimulai "/"
    setShowQR(v.startsWith('/'))
  }

  function applyQuickReply(qr: QuickReply) {
    setText(qr.body)
    setShowQR(false)
  }

  const filteredConvs = search.trim() ? convs.filter(c => {
    const ct = contactOf(c)
    const q = search.toLowerCase()
    return (ct.name || '').toLowerCase().includes(q) || (ct.phone || '').includes(q)
  }) : convs

  const filteredQR = text.startsWith('/') ? quickReplies.filter(q => q.shortcut.startsWith(text.slice(1).toLowerCase())) : quickReplies

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#fff' }}>
      {/* LEFT: CONVERSATION LIST */}
      <div style={{ width: 280, borderRight: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #F0F0F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D' }}>Percakapan</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{convs.length} aktif · realtime</div>
            </div>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 0 2px #F0FDF4' }} title="Realtime aktif" />
          </div>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama / nomor…"
            style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid #E5E5E5', borderRadius: 5, background: '#F7F7F7', color: '#0D0D0D', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredConvs.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.6 }}>
                {search ? 'Tidak ada hasil.' : <>Belum ada percakapan.<br />Pesan masuk otomatis muncul di sini.</>}
              </div>
            </div>
          ) : filteredConvs.map(c => {
            const ct = contactOf(c)
            const isActive = active?.id === c.id
            const badge = unread[c.id] || 0
            const tags = ct.tags || []
            return (
              <div key={c.id} onClick={() => setActive(c)} style={{ padding: '10px 14px', borderBottom: '1px solid #F7F7F7', cursor: 'pointer', background: isActive ? '#F0FDF4' : '#fff', borderLeft: `2px solid ${isActive ? '#16A34A' : 'transparent'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <div style={{ fontWeight: badge > 0 ? 600 : 500, fontSize: 13, color: '#0D0D0D', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ct.name || ct.phone}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    {badge > 0 && (
                      <span style={{ background: '#16A34A', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 999, minWidth: 16, textAlign: 'center' }}>{badge}</span>
                    )}
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{c.last_message_at ? timeAgo(c.last_message_at) : ''}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {ct.phone}
                  {ct.opted_out && <span style={{ color: '#DC2626' }}>· opt-out</span>}
                </div>
                {tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                    {tags.slice(0, 3).map((t: string) => (
                      <span key={t} style={{ fontSize: 9, padding: '1px 5px', background: '#F0FDF4', color: '#15803D', borderRadius: 3, border: '1px solid #BBF7D0', fontWeight: 500 }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* MIDDLE: CHAT */}
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
                          HALO AI
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

            {/* Quick Reply Picker */}
            {showQR && filteredQR.length > 0 && (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', bottom: 0, left: 14, right: 14, background: '#fff', border: '1px solid #E5E5E5', borderRadius: 8, maxHeight: 240, overflowY: 'auto', boxShadow: '0 -4px 12px rgba(0,0,0,0.08)', zIndex: 10 }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0', fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>Quick Replies ({filteredQR.length})</div>
                  {filteredQR.map(qr => (
                    <div key={qr.id} onClick={() => applyQuickReply(qr)} style={{ padding: '10px 12px', borderBottom: '1px solid #F7F7F7', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#0D0D0D' }}>{qr.title}</div>
                        <code style={{ fontSize: 10, padding: '1px 5px', background: '#F0FDF4', color: '#16A34A', borderRadius: 3, fontFamily: 'monospace' }}>/{qr.shortcut}</code>
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{qr.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ padding: '10px 14px', background: '#fff', borderTop: '1px solid #E5E5E5', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                value={text} onChange={e => handleTextChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } if (e.key === 'Escape') setShowQR(false) }}
                placeholder="Tulis balasan… (Enter kirim · / untuk quick reply)"
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

      {/* RIGHT: CRM PANEL */}
      <div style={{ width: 300, background: '#fff', flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {!active ? (
          <div style={{ padding: '32px 16px', fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.6 }}>
            Pilih percakapan untuk melihat detail kontak.
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E5E5E5' }}>
              <button onClick={() => setRightTab('contact')} style={{
                flex: 1, padding: '11px 0', fontSize: 12, fontWeight: 500, background: 'none', border: 'none',
                color: rightTab === 'contact' ? '#0D0D0D' : '#9CA3AF',
                borderBottom: rightTab === 'contact' ? '2px solid #16A34A' : '2px solid transparent',
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
              }}>Detail Kontak</button>
              <button onClick={() => { setRightTab('copilot'); if (!copilot && active) loadCopilot(active.id) }} style={{
                flex: 1, padding: '11px 0', fontSize: 12, fontWeight: 500, background: 'none', border: 'none',
                color: rightTab === 'copilot' ? '#0D0D0D' : '#9CA3AF',
                borderBottom: rightTab === 'copilot' ? '2px solid #16A34A' : '2px solid transparent',
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z" fill={rightTab === 'copilot' ? '#16A34A' : '#9CA3AF'}/></svg>
                AI Copilot
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {rightTab === 'contact' && contactDetail && (
                <>
                  {/* Contact header */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
                    <Avatar name={contactDetail.contact.name || contactDetail.contact.phone} size={56} />
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#0D0D0D', marginTop: 10 }}>{contactDetail.contact.name || 'Belum ada nama'}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{contactDetail.contact.phone}</div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                    <div style={{ padding: '8px 10px', background: '#F7F7F7', borderRadius: 7, border: '1px solid #E5E5E5' }}>
                      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, letterSpacing: 0.5 }}>PESAN MASUK</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#0D0D0D' }}>{contactDetail.stats.total_messages_in}</div>
                    </div>
                    <div style={{ padding: '8px 10px', background: '#F7F7F7', borderRadius: 7, border: '1px solid #E5E5E5' }}>
                      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, letterSpacing: 0.5 }}>BALAS</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#0D0D0D' }}>{contactDetail.stats.total_messages_out}</div>
                    </div>
                  </div>

                  {/* Last order info */}
                  {contactDetail.stats.days_since_last_order !== null && (
                    <div style={{ padding: '10px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 7, marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: '#15803D', fontWeight: 600, letterSpacing: 0.5, marginBottom: 2 }}>ORDER TERAKHIR</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D' }}>{contactDetail.stats.days_since_last_order} hari yang lalu</div>
                    </div>
                  )}

                  <button onClick={markOrder} style={{ width: '100%', padding: '8px 0', fontSize: 12, fontWeight: 500, background: '#fff', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16 }}>
                    ✓ Tandai kontak ini baru order
                  </button>

                  {/* Tags */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginBottom: 6, letterSpacing: 0.5 }}>TAGS</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                      {(contactDetail.contact.tags || []).map((t: string) => (
                        <span key={t} style={{ fontSize: 11, padding: '3px 7px', background: '#F0FDF4', color: '#15803D', borderRadius: 4, border: '1px solid #BBF7D0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {t}
                          <button onClick={() => removeTag(t)} style={{ background: 'none', border: 'none', color: '#15803D', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0, fontFamily: 'inherit' }}>×</button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="+ tag baru" style={{ flex: 1, padding: '5px 8px', fontSize: 11, border: '1px solid #E5E5E5', borderRadius: 5, outline: 'none', background: '#fff', color: '#0D0D0D', fontFamily: 'inherit' }} />
                      <button onClick={addTag} disabled={!newTag.trim()} style={{ padding: '5px 10px', fontSize: 11, background: !newTag.trim() ? '#F0F0F0' : '#0D0D0D', color: !newTag.trim() ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 5, cursor: !newTag.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Add</button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', letterSpacing: 0.5 }}>CATATAN INTERNAL</div>
                      {notesDraft !== (contactDetail.contact.notes || '') && (
                        <button onClick={saveNotes} disabled={savingNotes} style={{ fontSize: 11, color: '#16A34A', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                          {savingNotes ? 'Menyimpan…' : 'Simpan'}
                        </button>
                      )}
                    </div>
                    <textarea value={notesDraft} onChange={e => setNotesDraft(e.target.value)} placeholder="Catatan tentang kontak ini. Hanya tim kamu yang lihat." rows={5} style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #E5E5E5', borderRadius: 7, outline: 'none', resize: 'vertical', background: '#FAFAFA', fontFamily: 'inherit', color: '#0D0D0D', boxSizing: 'border-box', lineHeight: 1.5 }} />
                  </div>
                </>
              )}

              {rightTab === 'copilot' && (
                <>
                  <button onClick={() => loadCopilot(active.id)} style={{ width: '100%', padding: '7px 0', fontSize: 11, color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, marginBottom: 14 }}>
                    {coLoading ? 'Memuat…' : 'Refresh saran AI'}
                  </button>
                  {coLoading ? (
                    <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>Membaca percakapan…</div>
                  ) : !copilot ? (
                    <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>Klik refresh untuk dapat saran.</div>
                  ) : (
                    <>
                      {copilot.intent && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.08em', marginBottom: 6 }}>MAKSUD CUSTOMER</div>
                          <div style={{ fontSize: 12, color: '#374151', background: '#F7F7F7', border: '1px solid #E5E5E5', borderRadius: 6, padding: '8px 10px', lineHeight: 1.5 }}>{copilot.intent}</div>
                        </div>
                      )}
                      {copilot.suggestion && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.08em', marginBottom: 6 }}>SARAN BALASAN</div>
                          <div style={{ fontSize: 12, color: '#14532D', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, padding: '8px 10px', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: 8 }}>{copilot.suggestion}</div>
                          <button onClick={() => setText(copilot.suggestion)} style={{ width: '100%', padding: '7px 0', background: '#0D0D0D', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                            Pakai saran ini
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
