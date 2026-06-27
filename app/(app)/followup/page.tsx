'use client'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'
import { BrandLoader } from '@/app/Loader'

type Contact = {
  id: string; name: string | null; phone: string
  followup_status: string; last_message_at: string | null
  last_order_at: string | null; order_count: number
  category: string; tags?: string[]
}
type Activity = { id: string; action: string; note: string | null; created_at: string; contact?: any }

const CATEGORY_LABEL: Record<string, { label: string; color: string; bg: string; border: string }> = {
  loyal:    { label: 'Loyal',      color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  lapsed:   { label: 'Lama tidak order', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  one_time: { label: 'Baru 1x order', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  new:      { label: 'Belum order',  color: '#6B7280', bg: '#F7F7F7', border: '#E5E5E5' },
  prospect: { label: 'Prospek',     color: '#6B7280', bg: '#F7F7F7', border: '#E5E5E5' },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'baru'
  if (m < 60) return `${m}m lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}j lalu`
  return `${Math.floor(h / 24)} hari lalu`
}

export default function FollowUpPage() {
  const [tab, setTab] = useState<'pending' | 'today'>('pending')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  async function loadPending() {
    setLoading(true)
    const res = await authFetch('/api/followup?view=pending')
    const j = await res.json()
    setContacts(j.contacts || [])
    setLoading(false)
  }

  async function loadToday() {
    setLoading(true)
    const res = await authFetch('/api/followup?view=today')
    const j = await res.json()
    setActivities(j.activities || [])
    setLoading(false)
  }

  useEffect(() => {
    if (tab === 'pending') loadPending()
    else loadToday()
  }, [tab])

  async function markContacted(contactId: string, note?: string) {
    setBusy(contactId)
    try {
      const res = await authFetch('/api/followup', {
        method: 'POST',
        body: JSON.stringify({ contact_id: contactId, action: 'contacted', note: note || null }),
      })
      if (res.ok) {
        // hilang dari daftar pending (anti follow-up ganda)
        setContacts(prev => prev.filter(c => c.id !== contactId))
        setNoteFor(null); setNoteText('')
      }
    } finally { setBusy(null) }
  }

  async function saveNote(contactId: string) {
    if (!noteText.trim()) return
    setBusy(contactId)
    try {
      const res = await authFetch('/api/followup', {
        method: 'POST',
        body: JSON.stringify({ contact_id: contactId, action: 'note', note: noteText }),
      })
      if (res.ok) { setNoteFor(null); setNoteText('') }
    } finally { setBusy(null) }
  }

  return (
    <div style={{ padding: 'clamp(18px,5vw,32px) clamp(14px,5vw,36px)', maxWidth: 820 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0D0D0D', letterSpacing: '-0.02em', marginBottom: 3 }}>Follow Up Customer</h1>
        <p style={{ fontSize: 13, color: '#6B7280' }}>Customer yang sudah di-approach otomatis jadi "Terkontak" dan hilang dari daftar ini biar tidak dobel.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '1px solid #E5E5E5', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
        {[{ id: 'pending', label: 'Perlu Follow Up' }, { id: 'today', label: 'Aktivitas Hari Ini' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: tab === t.id ? 600 : 400, background: tab === t.id ? '#0D0D0D' : '#fff', color: tab === t.id ? '#fff' : '#6B7280', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <BrandLoader />
      ) : tab === 'pending' ? (
        contacts.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 13, color: '#9CA3AF', lineHeight: 1.6, background: '#FAFAFA', borderRadius: 10, border: '1px solid #F0F0F0' }}>
            🎉 Semua customer sudah di-follow up.<br />Tidak ada yang perlu di-approach saat ini.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>{contacts.length} customer perlu di-follow up</div>
            {contacts.map(c => {
              const cat = CATEGORY_LABEL[c.category] || CATEGORY_LABEL.prospect
              return (
                <div key={c.id} style={{ border: '1px solid #E5E5E5', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#0D0D0D' }}>{c.name || c.phone}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, color: cat.color, background: cat.bg, border: `1px solid ${cat.border}` }}>{cat.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                        {c.phone}
                        {c.order_count > 0 && <span> · {c.order_count}x order</span>}
                        {c.last_message_at && <span> · pesan {timeAgo(c.last_message_at)}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => setNoteFor(noteFor === c.id ? null : c.id)} style={btnGhost}>+ Catatan</button>
                      <button onClick={() => markContacted(c.id)} disabled={busy === c.id} style={btnPrimary(busy === c.id)}>
                        {busy === c.id ? '…' : '✓ Tandai Terkontak'}
                      </button>
                    </div>
                  </div>
                  {noteFor === c.id && (
                    <div style={{ padding: '0 14px 12px', display: 'flex', gap: 6 }}>
                      <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Catatan follow-up (mis. sudah ditawari promo, minta di-WA besok)…"
                        onKeyDown={e => e.key === 'Enter' && markContacted(c.id, noteText)}
                        style={{ flex: 1, padding: '8px 10px', fontSize: 12, border: '1px solid #E5E5E5', borderRadius: 6, outline: 'none', fontFamily: 'inherit', color: '#0D0D0D' }} />
                      <button onClick={() => markContacted(c.id, noteText)} disabled={busy === c.id} style={btnPrimary(busy === c.id)}>Simpan & Terkontak</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : (
        // Today's activity log
        activities.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 13, color: '#9CA3AF', background: '#FAFAFA', borderRadius: 10, border: '1px solid #F0F0F0' }}>
            Belum ada aktivitas follow-up hari ini.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>{activities.length} aktivitas hari ini</div>
            {activities.map(a => {
              const ct = a.contact || {}
              return (
                <div key={a.id} style={{ border: '1px solid #E5E5E5', borderRadius: 8, background: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: a.action === 'contacted' ? '#16A34A' : '#9CA3AF', marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#0D0D0D' }}>
                      <span style={{ fontWeight: 600 }}>{ct.name || ct.phone || 'Customer'}</span>
                      <span style={{ color: '#6B7280' }}> — {a.action === 'contacted' ? 'ditandai terkontak' : 'ditambah catatan'}</span>
                    </div>
                    {a.note && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3, lineHeight: 1.5 }}>{a.note}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{timeAgo(a.created_at)}</div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

const btnPrimary = (disabled: boolean): React.CSSProperties => ({ padding: '7px 12px', background: disabled ? '#F0F0F0' : '#16A34A', color: disabled ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })
const btnGhost: React.CSSProperties = { padding: '7px 12px', background: '#fff', color: '#6B7280', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }
