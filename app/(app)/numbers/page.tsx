'use client'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'

const FB_APP_ID = process.env.NEXT_PUBLIC_FB_APP_ID || ''
const FB_CONFIG_ID = process.env.NEXT_PUBLIC_FB_CONFIG_ID || ''

declare global { interface Window { FB: any; fbAsyncInit: any } }

export default function NumbersPage() {
  const [numbers, setNumbers] = useState<any[]>([])
  const [showManual, setShowManual] = useState(false)
  const [form, setForm] = useState({ phone_number_id: '', waba_id: '', access_token: '', display_phone: '', label: '' })
  const [msg, setMsg] = useState('')

  async function load() {
    const res = await authFetch('/api/numbers')
    const j = await res.json()
    setNumbers(j.numbers || [])
  }
  useEffect(() => { load() }, [])

  // ── Load FB SDK utk Embedded Signup ──
  useEffect(() => {
    if (!FB_APP_ID) return
    if (document.getElementById('fb-sdk')) return
    window.fbAsyncInit = function () { window.FB.init({ appId: FB_APP_ID, autoLogAppEvents: true, xfbml: false, version: 'v21.0' }) }
    const s = document.createElement('script')
    s.id = 'fb-sdk'; s.async = true; s.src = 'https://connect.facebook.net/en_US/sdk.js'
    document.body.appendChild(s)
  }, [])

  function connectWhatsApp() {
    if (!FB_APP_ID || !FB_CONFIG_ID || !window.FB) { setMsg('Embedded Signup belum dikonfigurasi (FB_APP_ID / FB_CONFIG_ID).'); return }
    let captured: any = {}
    const listener = (e: MessageEvent) => {
      if (typeof e.data !== 'string') return
      try {
        const d = JSON.parse(e.data)
        if (d.type === 'WA_EMBEDDED_SIGNUP') captured = d.data || {}
      } catch { /* ignore */ }
    }
    window.addEventListener('message', listener)
    window.FB.login(async (resp: any) => {
      window.removeEventListener('message', listener)
      const code = resp?.authResponse?.code
      if (!code) { setMsg('Dibatalkan / gagal.'); return }
      setMsg('Menyambungkan…')
      const res = await authFetch('/api/embedded-signup/callback', {
        method: 'POST',
        body: JSON.stringify({ code, phone_number_id: captured.phone_number_id, waba_id: captured.waba_id }),
      })
      const j = await res.json()
      setMsg(res.ok ? 'Nomor tersambung!' : (j.error || 'Gagal'))
      load()
    }, { config_id: FB_CONFIG_ID, response_type: 'code', override_default_response_type: true, extras: { setup: {} } })
  }

  async function addManual() {
    setMsg('')
    const res = await authFetch('/api/numbers', { method: 'POST', body: JSON.stringify(form) })
    const j = await res.json()
    if (!res.ok) { setMsg(j.error || 'Gagal'); return }
    setShowManual(false); setForm({ phone_number_id: '', waba_id: '', access_token: '', display_phone: '', label: '' }); load()
  }

  return (
    <div style={{ padding: 32, maxWidth: 760 }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Nomor WhatsApp</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={connectWhatsApp} style={btnPrimary}>Connect WhatsApp (Embedded Signup)</button>
        <button onClick={() => setShowManual(s => !s)} style={btnGhost}>+ Tambah manual (test)</button>
      </div>
      {msg && <p style={{ fontSize: 13, color: '#2563eb' }}>{msg}</p>}

      {showManual && (
        <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: '#666', marginTop: 0 }}>Buat testing: isi dari test number Meta (Cloud API).</p>
          {(['phone_number_id', 'waba_id', 'access_token', 'display_phone', 'label'] as const).map(k => (
            <input key={k} placeholder={k} value={(form as any)[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
              style={{ width: '100%', padding: 9, marginBottom: 8, border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }} />
          ))}
          <button onClick={addManual} style={btnPrimary}>Simpan nomor</button>
        </div>
      )}

      {numbers.length === 0 ? (
        <p style={{ color: '#999' }}>Belum ada nomor tersambung.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead><tr style={{ textAlign: 'left', color: '#888' }}>
            <th style={th}>Nomor</th><th style={th}>Label</th><th style={th}>Status</th><th style={th}>Kualitas</th>
          </tr></thead>
          <tbody>
            {numbers.map(n => (
              <tr key={n.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                <td style={td}>{n.display_phone || n.phone_number_id}</td>
                <td style={td}>{n.label || '—'}</td>
                <td style={td}>{n.status}</td>
                <td style={td}>{n.quality_rating || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const btnPrimary: React.CSSProperties = { padding: '10px 16px', background: '#111', color: '#fff', border: 0, borderRadius: 8, fontWeight: 600, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { padding: '10px 16px', background: '#fff', color: '#333', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer' }
const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 500 }
const td: React.CSSProperties = { padding: '10px' }
