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
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok')

  async function load() {
    const res = await authFetch('/api/numbers')
    const j = await res.json()
    setNumbers(j.numbers || [])
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!FB_APP_ID) return
    if (document.getElementById('fb-sdk')) return
    window.fbAsyncInit = function () { window.FB.init({ appId: FB_APP_ID, autoLogAppEvents: true, xfbml: false, version: 'v21.0' }) }
    const s = document.createElement('script')
    s.id = 'fb-sdk'; s.async = true; s.src = 'https://connect.facebook.net/en_US/sdk.js'
    document.body.appendChild(s)
  }, [])

  function connectWhatsApp() {
    if (!FB_APP_ID || !FB_CONFIG_ID || !window.FB) {
      setMsg('Embedded Signup belum dikonfigurasi.'); setMsgType('err'); return
    }
    let captured: any = {}
    const listener = (e: MessageEvent) => {
      if (typeof e.data !== 'string') return
      try { const d = JSON.parse(e.data); if (d.type === 'WA_EMBEDDED_SIGNUP') captured = d.data || {} } catch { }
    }
    window.addEventListener('message', listener)
    window.FB.login(async (resp: any) => {
      window.removeEventListener('message', listener)
      const code = resp?.authResponse?.code
      if (!code) { setMsg('Dibatalkan.'); setMsgType('err'); return }
      setMsg('Menyambungkan…'); setMsgType('ok')
      const res = await authFetch('/api/embedded-signup/callback', {
        method: 'POST',
        body: JSON.stringify({ code, phone_number_id: captured.phone_number_id, waba_id: captured.waba_id }),
      })
      const j = await res.json()
      setMsg(res.ok ? 'Nomor tersambung!' : (j.error || 'Gagal'))
      setMsgType(res.ok ? 'ok' : 'err')
      load()
    }, { config_id: FB_CONFIG_ID, response_type: 'code', override_default_response_type: true, extras: { setup: {} } })
  }

  async function addManual() {
    setMsg('')
    const res = await authFetch('/api/numbers', { method: 'POST', body: JSON.stringify(form) })
    const j = await res.json()
    if (!res.ok) { setMsg(j.error || 'Gagal'); setMsgType('err'); return }
    setShowManual(false)
    setForm({ phone_number_id: '', waba_id: '', access_token: '', display_phone: '', label: '' })
    load()
  }

  const qualityColor = (q: string) => q === 'GREEN' ? '#00D97E' : q === 'YELLOW' ? '#F59E0B' : q === 'RED' ? '#EF4444' : '#94A3B8'

  return (
    <div style={{ padding: '32px 40px', maxWidth: 760 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: 4 }}>Nomor WhatsApp</h1>
        <p style={{ fontSize: 14, color: '#64748B' }}>Kelola nomor WA Business yang terhubung ke workspace ini.</p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={connectWhatsApp} style={{
          padding: '10px 18px', background: '#0A0F1E', color: '#fff',
          border: 0, borderRadius: 8, fontWeight: 600, fontSize: 14,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          + Connect WhatsApp
        </button>
        <button onClick={() => setShowManual(s => !s)} style={{
          padding: '10px 18px', background: '#fff', color: '#374151',
          border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Tambah manual
        </button>
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16,
          background: msgType === 'ok' ? '#F0FDF4' : '#FEF2F2',
          border: `1px solid ${msgType === 'ok' ? '#A7F3D0' : '#FECACA'}`,
          color: msgType === 'ok' ? '#065F46' : '#991B1B',
        }}>{msg}</div>
      )}

      {showManual && (
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: 20, marginBottom: 20,
        }}>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 0, marginBottom: 14 }}>
            Untuk testing: isi dengan data test number dari Meta Cloud API.
          </p>
          {(['phone_number_id', 'waba_id', 'access_token', 'display_phone', 'label'] as const).map(k => (
            <input key={k} placeholder={k}
              value={(form as any)[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
              style={{
                width: '100%', padding: '10px 12px', marginBottom: 8,
                border: '1px solid #E2E8F0', borderRadius: 8,
                fontSize: 13, color: '#0F172A', background: '#F8FAFC',
                boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none',
              }}
            />
          ))}
          <button onClick={addManual} style={{
            padding: '10px 20px', background: '#0A0F1E', color: '#fff',
            border: 0, borderRadius: 8, fontWeight: 600, fontSize: 14,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Simpan nomor</button>
        </div>
      )}

      {numbers.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: '48px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📱</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', marginBottom: 6 }}>Belum ada nomor tersambung</div>
          <div style={{ fontSize: 13, color: '#94A3B8' }}>Connect nomor WA Business untuk mulai menerima pesan.</div>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={th}>Nomor</th>
                <th style={th}>Label</th>
                <th style={th}>Status</th>
                <th style={th}>Quality</th>
              </tr>
            </thead>
            <tbody>
              {numbers.map(n => (
                <tr key={n.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{n.display_phone || n.phone_number_id}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{n.phone_number_id}</div>
                  </td>
                  <td style={td}><span style={{ color: '#374151' }}>{n.label || '—'}</span></td>
                  <td style={td}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
                      background: n.status === 'CONNECTED' ? '#F0FDF4' : '#F8FAFC',
                      color: n.status === 'CONNECTED' ? '#065F46' : '#94A3B8',
                      border: `1px solid ${n.status === 'CONNECTED' ? '#A7F3D0' : '#E2E8F0'}`,
                    }}>
                      {n.status || 'unknown'}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{ color: qualityColor(n.quality_rating), fontWeight: 600 }}>
                      {n.quality_rating || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#94A3B8', letterSpacing: '0.04em', textTransform: 'uppercase' }
const td: React.CSSProperties = { padding: '14px 16px', verticalAlign: 'middle' }
