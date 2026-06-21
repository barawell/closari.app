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
    <div style={{ padding: 32, maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Broadcast</h1>

      <label style={lbl}>Kirim dari nomor</label>
      <select value={waNumberId} onChange={e => setWaNumberId(e.target.value)} style={inp}>
        {numbers.length === 0 && <option value="">(belum ada nomor)</option>}
        {numbers.map(n => <option key={n.id} value={n.id}>{n.display_phone || n.phone_number_id} {n.label ? `· ${n.label}` : ''}</option>)}
      </select>

      <label style={lbl}>Pesan</label>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder="Tulis pesan broadcast…" style={{ ...inp, resize: 'vertical' }} />

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '4px 0 16px', fontSize: 13, color: '#555' }}>
        <input type="checkbox" checked={engagedOnly} onChange={e => setEngagedOnly(e.target.checked)} style={{ marginTop: 3 }} />
        <span><b>Cuma ke pelanggan aktif</b> (aktif chat 60 hari terakhir). Nomor opt-out otomatis dibuang. Disarankan nyala biar quality rating aman.</span>
      </label>

      <button onClick={send} disabled={busy || !waNumberId || !text.trim()} style={btn}>{busy ? 'Mengirim…' : 'Kirim broadcast'}</button>

      {result && (
        <div style={{ marginTop: 20, padding: 14, background: '#f6f8f6', borderRadius: 10, fontSize: 14 }}>
          Terkirim: <b>{result.sent}</b> · Gagal: <b>{result.failed}</b> · Total target: <b>{result.total}</b>
        </div>
      )}
      <p style={{ fontSize: 12, color: '#999', marginTop: 16 }}>
        Catatan: teks bebas cuma sampai ke pelanggan yang aktif dalam 24 jam. Untuk jangkauan penuh, pakai template resmi (menyusul).
      </p>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 13, color: '#666', marginBottom: 6, marginTop: 12 }
const inp: React.CSSProperties = { width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }
const btn: React.CSSProperties = { padding: '11px 20px', background: '#111', color: '#fff', border: 0, borderRadius: 8, fontWeight: 600, cursor: 'pointer' }
