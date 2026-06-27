'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { authFetch } from '@/lib/client-fetch'
import { supabase } from '@/lib/supabase'

// Nada notifikasi pesan masuk — di-generate via WebAudio (gak butuh file mp3).
let _audioCtx: AudioContext | null = null
function playNotifSound() {
  try {
    if (typeof window === 'undefined') return
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    if (!_audioCtx) _audioCtx = new Ctx()
    const ctx = _audioCtx
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    // dua nada pendek (ding-dong)
    ;[ [880, 0], [1180, 0.12] ].forEach(([freq, t]) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq as number
      gain.gain.setValueAtTime(0.0001, now + (t as number))
      gain.gain.exponentialRampToValueAtTime(0.18, now + (t as number) + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (t as number) + 0.22)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(now + (t as number))
      osc.stop(now + (t as number) + 0.24)
    })
  } catch { /* ignore */ }
}

type Conv = { id: string; status: string; last_message_at: string; tags?: string[]; contact: any }
type Msg = { id: string; direction: string; body: string; sender: string; created_at: string; status?: string; type?: string; media_url?: string | null; media_mime?: string | null; media_filename?: string | null; is_forwarded?: boolean }
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

// Render media (foto / video / audio / dokumen) di dalam bubble.
function MediaBubble({ m, light }: { m: Msg; light: boolean }) {
  const mime = m.media_mime || ''
  const url = m.media_url || ''
  if (!url) {
    return <div style={{ fontSize: 12, fontStyle: 'italic', opacity: 0.7 }}>📎 {m.media_filename || m.type || 'lampiran'} (gagal dimuat)</div>
  }
  if (mime.startsWith('image/') || m.type === 'image' || m.type === 'sticker') {
    return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" style={{ maxWidth: 240, maxHeight: 280, borderRadius: 8, display: 'block', objectFit: 'cover' }} /></a>
  }
  if (mime.startsWith('video/') || m.type === 'video') {
    return <video src={url} controls style={{ maxWidth: 260, borderRadius: 8, display: 'block' }} />
  }
  if (mime.startsWith('audio/') || m.type === 'audio' || m.type === 'voice') {
    return <audio src={url} controls style={{ maxWidth: 240 }} />
  }
  // dokumen
  return (
    <a href={url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: light ? '#fff' : '#0D0D0D', padding: '4px 0' }}>
      <div style={{ width: 34, height: 34, borderRadius: 7, background: light ? 'rgba(255,255,255,0.18)' : '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 1.5h5L12.5 5v9.5H4V1.5Z" stroke={light ? '#fff' : '#16A34A'} strokeWidth="1.3" strokeLinejoin="round"/><path d="M9 1.5V5h3.5" stroke={light ? '#fff' : '#16A34A'} strokeWidth="1.3" strokeLinejoin="round"/></svg>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{m.media_filename || 'Dokumen'}</div>
        <div style={{ fontSize: 10, opacity: 0.7 }}>Ketuk untuk buka</div>
      </div>
    </a>
  )
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
  const [soundOn, setSoundOn] = useState(true)
  const [sendingMedia, setSendingMedia] = useState(false)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [showInfoMobile, setShowInfoMobile] = useState(false)
  const [readMap, setReadMap] = useState<Record<string, number>>({})
  const seededRef = useRef(false)
  const tenantIdRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const endRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<Conv | null>(null)
  activeRef.current = active
  tenantIdRef.current = tenantId
  const soundRef = useRef(true)
  soundRef.current = soundOn

  // Load sound preference (in-memory only; resets per session)
  function toggleSound() {
    setSoundOn(v => {
      const next = !v
      // unlock audio on user gesture
      if (next) playNotifSound()
      return next
    })
  }

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

  // Tandai percakapan sudah dibaca, disimpan ke localStorage per workspace (persist saat reload).
  const markRead = useCallback((convId: string) => {
    setReadMap(prev => {
      const next = { ...prev, [convId]: Date.now() }
      try { localStorage.setItem('closari_inbox_read_' + (tenantIdRef.current || 'x'), JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  // Muat status baca tersimpan; pertama kali pakai: anggap semua percakapan saat ini sudah dibaca.
  useEffect(() => {
    if (!tenantId || seededRef.current || convs.length === 0) return
    seededRef.current = true
    try {
      const key = 'closari_inbox_read_' + tenantId
      const raw = localStorage.getItem(key)
      if (raw) { setReadMap(JSON.parse(raw)); return }
      const seed: Record<string, number> = {}
      for (const c of convs) seed[c.id] = c.last_message_at ? new Date(c.last_message_at).getTime() : Date.now()
      localStorage.setItem(key, JSON.stringify(seed))
      setReadMap(seed)
    } catch {}
  }, [tenantId, convs])

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

  // Ambil tenant id (buat filter realtime per-tenant)
  useEffect(() => {
    (async () => {
      const res = await authFetch('/api/me')
      const j = await res.json()
      setTenantId(j?.tenant?.id || null)
    })()
  }, [])

  // Realtime — DIFILTER per tenant biar tidak bocor antar client
  useEffect(() => {
    loadConvs()
    if (!tenantId) return // tunggu tenantId siap dulu

    const channel = supabase
      .channel('inbox-realtime-' + tenantId)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_messages', filter: 'tenant_id=eq.' + tenantId },
        (payload) => {
          const newMsg = payload.new as Msg & { conversation_id: string; direction: string; sender: string }
          const convId = newMsg.conversation_id
          // Nada notif untuk pesan masuk dari customer (bukan balasan kita sendiri)
          if (newMsg.direction === 'in' && newMsg.sender === 'contact' && soundRef.current) {
            playNotifSound()
          }
          if (activeRef.current?.id === convId) {
            markRead(convId)
            setMsgs(prev => {
              if (prev.find(m => m.id === newMsg.id)) return prev
              // Ganti bubble optimistic (opt-) dgn pesan asli dari DB biar tidak dobel
              // & status (centang) bisa update. Cocokkan arah + isi.
              const idx = prev.findIndex(m => typeof m.id === 'string' && m.id.startsWith('opt-') && m.direction === newMsg.direction && (m.body || '') === (newMsg.body || ''))
              if (idx !== -1) { const c = [...prev]; c[idx] = newMsg; return c }
              return [...prev, newMsg]
            })
            setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          } else {
            setUnread(prev => ({ ...prev, [convId]: (prev[convId] || 0) + 1 }))
          }
          loadConvs()
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wa_messages', filter: 'tenant_id=eq.' + tenantId },
        (payload) => {
          const updated = payload.new as Msg
          setMsgs(prev => prev.map(m => m.id === updated.id ? { ...m, status: updated.status } : m))
        })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadConvs, tenantId])

  // Jaring pengaman: refresh daftar tiap 15 detik agar pesan baru tetap ke-tandai walau realtime telat/mati.
  useEffect(() => {
    const iv = setInterval(() => { loadConvs() }, 15000)
    return () => clearInterval(iv)
  }, [loadConvs])

  useEffect(() => {
    if (active) {
      loadMsgs(active.id)
      markRead(active.id)
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

  async function sendMedia(file: File) {
    if (!active) return
    setSendingMedia(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('conversation_id', active.id)
      const res = await authFetch('/api/inbox/media', { method: 'POST', body: fd })
      const j = await res.json()
      if (!res.ok) alert(j.error || 'Gagal kirim file')
      else loadMsgs(active.id)
    } finally {
      setSendingMedia(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
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
    <div className={`inbox-shell${active ? ' has-active' : ''}${showInfoMobile ? ' show-info' : ''}`} style={{ display: 'flex', height: '100vh', background: '#fff' }}>
      {/* LEFT: CONVERSATION LIST */}
      <div className="inbox-list" style={{ width: 280, borderRight: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #F0F0F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D' }}>Percakapan</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{convs.length} aktif · realtime</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={toggleSound} title={soundOn ? 'Nada notif: ON' : 'Nada notif: OFF'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: soundOn ? '#16A34A' : '#D4D4D4' }}>
                {soundOn ? (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 6v3h2l3 2.5v-8L5 6H3Z" fill="currentColor"/><path d="M10 5.5C10.7 6.2 11 6.8 11 7.5C11 8.2 10.7 8.8 10 9.5M11.5 4C12.7 5 13 6.2 13 7.5C13 8.8 12.7 10 11.5 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 6v3h2l3 2.5v-8L5 6H3Z" fill="currentColor"/><path d="M10 6L13 9M13 6L10 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                )}
              </button>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 0 2px #F0FDF4' }} title="Realtime aktif" />
            </div>
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
            const lastMs = c.last_message_at ? new Date(c.last_message_at).getTime() : 0
            const isUnread = !isActive && (badge > 0 || lastMs > (readMap[c.id] || 0))
            const tags = ct.tags || []
            return (
              <div key={c.id} onClick={() => { setActive(c); setShowInfoMobile(false) }} style={{ padding: '10px 14px', borderBottom: '1px solid #F7F7F7', cursor: 'pointer', background: isActive ? '#F0FDF4' : isUnread ? '#F4FDF8' : '#fff', borderLeft: `2px solid ${isActive || isUnread ? '#16A34A' : 'transparent'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    {isUnread && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A', flexShrink: 0 }} />}
                    <div style={{ fontWeight: isUnread ? 700 : 500, fontSize: 13, color: '#0D0D0D', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ct.name || ct.phone}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    {badge > 0 && (
                      <span style={{ background: '#16A34A', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 999, minWidth: 16, textAlign: 'center' }}>{badge}</span>
                    )}
                    <span style={{ fontSize: 11, fontWeight: isUnread ? 600 : 400, color: isUnread ? '#16A34A' : '#9CA3AF' }}>{c.last_message_at ? timeAgo(c.last_message_at) : ''}</span>
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
      <div className="inbox-chat" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #E5E5E5' }}>
        {!active ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.7 }}>Pilih percakapan<br />untuk mulai membalas</div>
          </div>
        ) : (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', gap: 10, background: '#fff' }}>
              <button onClick={() => setActive(null)} className="inbox-mobile-only" aria-label="Kembali" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: -4, color: '#0D0D0D' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12.5 5L7.5 10l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <Avatar name={contactOf(active).name || contactOf(active).phone} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: '#0D0D0D' }}>{contactOf(active).name || contactOf(active).phone}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{contactOf(active).phone}</div>
              </div>
              <button onClick={() => setShowInfoMobile(true)} className="inbox-mobile-only" aria-label="Info kontak" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6B7280' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M10 9v4M10 6.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
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
                          AIRA AI
                        </div>
                      )}
                      {m.is_forwarded && (
                        <div style={{ fontSize: 10, fontStyle: 'italic', opacity: 0.6, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6h6M6 3l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Diteruskan
                        </div>
                      )}
                      {(m.media_url || (m.type && m.type !== 'text' && m.type !== 'button' && m.type !== 'interactive')) && (
                        <div style={{ marginBottom: m.body ? 6 : 0 }}>
                          <MediaBubble m={m} light={m.direction === 'out' && m.sender !== 'ai'} />
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
              <input ref={fileInputRef} type="file" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) sendMedia(f) }} />
              <button onClick={() => fileInputRef.current?.click()} disabled={sendingMedia} title="Kirim foto / dokumen"
                style={{ padding: '9px 10px', borderRadius: 7, background: '#F7F7F7', border: '1px solid #E5E5E5', cursor: sendingMedia ? 'wait' : 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', color: '#6B7280' }}>
                {sendingMedia
                  ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#D4D4D4" strokeWidth="2"/><path d="M8 2a6 6 0 016 6" stroke="#16A34A" strokeWidth="2" strokeLinecap="round"><animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="0.7s" repeatCount="indefinite"/></path></svg>
                  : <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M14 7.5l-6 6a3.5 3.5 0 01-5-5l6.5-6.5a2.3 2.3 0 013.3 3.3L6.5 11.5a1.1 1.1 0 01-1.6-1.6L11 3.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
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
      <div className="inbox-right" style={{ width: 300, background: '#fff', flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <button onClick={() => setShowInfoMobile(false)} className="inbox-mobile-only" style={{ alignItems: 'center', gap: 6, background: 'none', border: 'none', borderBottom: '1px solid #E5E5E5', cursor: 'pointer', padding: '10px 14px', color: '#6B7280', fontSize: 13, fontFamily: 'inherit' }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M12.5 5L7.5 10l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Kembali ke chat
        </button>
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
