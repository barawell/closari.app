'use client'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'

export default function BroadcastPage() {
  const [numbers, setNumbers] = useState<any[]>([])
  const [waNumberId, setWaNumberId] = useState('')
  const [text, setText] = useState('')
  const [engagedOnly, setEngagedOnly] = useState(true)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    (async () => {
      const res = await authFetch('/api/numbers')
      const j = await res.json()
      setNumbers(j.numbers || [])
      if (j.numbers?.[0]) setWaNumberId(j.numbers[0].id)
    })()
  }, [])

  async function send() {
    setBusy(true); setResult(null)
    try {
      const res = await authFetch('/api/broadcast', { method: 'POST', body: JSON.stringify({ wa_number_id: waNumberId, text, engagedOnly }) })
      const j = await res.json()
      if (!res.ok) { alert(j.error || 'Gagal'); return }
      setResult(j)
    } finally { setBusy(false) }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 680 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: 4 }}>Broadcast</h1>
        <p style={{ fontSize: 14, color: '#64748B' }}>Kirim pesan ke kontak aktif. Pastikan pesan relevan & bernilai.</p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, marginBottom: 16 }}>
        <div style={{ marginBottom: 18 }}>
          <label style={lbl}>Kirim dari nomor</label>
          <select value={waNumberId} onChange={e => setWaNumberId(e.target.value)} style={inp}>
            {numbers.length === 0 && <option value="">(belum ada nomor)</option>}
            {numbers.map(n => (
              <option key={n.id} value={n.id}>
                {n.display_phone || n.phone_number_id} {n.label ? `· ${n.label}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={lbl}>Pesan</label>
          <textarea
            value={text} onChange={e => setText(e.target.value)}
            rows={6} placeholder="Tulis pesan broadcast…"
            style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}
          />
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4, textAlign: 'right' }}>
            {text.length} karakter
          </div>
        </div>

        <div style={{
          display: 'flex', gap: 12, alignItems: 'flex-start',
          padding: '12px 14px', background: '#F8FAFC', borderRadius: 10,
          border: '1px solid #E2E8F0', marginBottom: 20, cursor: 'pointer',
        }} onClick={() => setEngagedOnly(v => !v)}>
          <div style={{
            width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
            background: engagedOnly ? '#0A0F1E' : '#fff',
            border: engagedOnly ? 'none' : '1.5px solid #CBD5E1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {engagedOnly && <span style={{ color: '#00D97E', fontSize: 12, fontWeight: 700 }}>✓</span>}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>
              Hanya ke kontak aktif
            </div>
            <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
              Aktif chat dalam 60 hari terakhir. Opt-out otomatis dibuang. Disarankan aktif untuk jaga quality rating.
            </div>
          </div>
        </div>

        <button
          onClick={send}
          disabled={busy || !waNumberId || !text.trim()}
          style={{
            padding: '12px 24px',
            background: busy || !waNumberId || !text.trim() ? '#F1F5F9' : '#0A0F1E',
            color: busy || !waNumberId || !text.trim() ? '#CBD5E1' : '#fff',
            border: 0, borderRadius: 10, fontWeight: 700, fontSize: 14,
            cursor: busy || !waNumberId || !text.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {busy ? 'Mengirim…' : 'Kirim broadcast'}
        </button>
      </div>

      {result && (
        <div style={{
          background: '#F0FDF4', border: '1px solid #A7F3D0',
          borderRadius: 12, padding: '16px 20px',
          display: 'flex', gap: 24,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#065F46' }}>{result.sent}</div>
            <div style={{ fontSize: 12, color: '#6EE7B7', marginTop: 2 }}>Terkirim</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: result.failed > 0 ? '#EF4444' : '#94A3B8' }}>{result.failed}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Gagal</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#94A3B8' }}>{result.total}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Total target</div>
          </div>
        </div>
      )}

      <div style={{
        marginTop: 16, padding: '12px 14px',
        background: '#FFFBEB', border: '1px solid #FDE68A',
        borderRadius: 10, fontSize: 13, color: '#92400E', lineHeight: 1.6,
      }}>
        ⚠️ Teks bebas hanya sampai ke kontak aktif dalam 24 jam. Untuk jangkauan penuh ke semua kontak, gunakan template resmi (segera hadir).
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 13, color: '#374151', marginBottom: 6, fontWeight: 500 }
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  border: '1px solid #E2E8F0', borderRadius: 8,
  fontSize: 14, color: '#0F172A', background: '#F8FAFC',
  boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none',
}
