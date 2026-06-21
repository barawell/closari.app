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
    if (!FB_APP_ID || document.getElementById('fb-sdk')) return
    window.fbAsyncInit = function () { window.FB.init({ appId: FB_APP_ID, autoLogAppEvents: true, xfbml: false, version: 'v21.0' }) }
    const s = document.createElement('script'); s.id = 'fb-sdk'; s.async = true; s.src = 'https://connect.facebook.net/en_US/sdk.js'
    document.body.appendChild(s)
  }, [])

  function connectWhatsApp() {
    if (!FB_APP_ID || !FB_CONFIG_ID || !window.FB) { setMsg('Embedded Signup belum dikonfigurasi.'); setMsgType('err'); return }
    let captured: any = {}
    const listener = (e: MessageEvent) => { if (typeof e.data !== 'string') return; try { const d = JSON.parse(e.data); if (d.type === 'WA_EMBEDDED_SIGNUP') captured = d.data || {} } catch { } }
    window.addEventListener('message', listener)
    window.FB.login(async (resp: any) => {
      window.removeEventListener('message', listener)
      const code = resp?.authResponse?.code
      if (!code) { setMsg('Dibatalkan.'); setMsgType('err'); return }
      setMsg('Menyambungkan…'); setMsgType('ok')
      const res = await authFetch('/api/embedded-signup/callback', { method: 'POST', body: JSON.stringify({ code, phone_number_id: captured.phone_number_id, waba_id: captured.waba_id }) })
      const j = await res.json()
      setMsg(res.ok ? 'Nomor tersambung!' : (j.error || 'Gagal')); setMsgType(res.ok ? 'ok' : 'err')
      load()
    }, { config_id: FB_CONFIG_ID, response_type: 'code', override_default_response_type: true, extras: { setup: {} } })
  }

  async function addManual() {
    setMsg('')
    const res = await authFetch('/api/numbers', { method: 'POST', body: JSON.stringify(form) })
    const j = await res.json()
    if (!res.ok) { setMsg(j.error || 'Gagal'); setMsgType('err'); return }
    setShowManual(false); setForm({ phone_number_id: '', waba_id: '', access_token: '', display_phone: '', label: '' }); load()
  }

  const qualityBadge = (q: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      GREEN: { bg: '#F0FDF4', color: '#15803D' },
      YELLOW: { bg: '#FFFBEB', color: '#B45309' },
      RED: { bg: '#FEF2F2', color: '#B91C1C' },
    }
    return map[q] || { bg: '#F7F7F7', color: '#6B7280' }
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 740 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0D0D0D', letterSpacing: '-0.02em', marginBottom: 3 }}>Nomor WhatsApp</h1>
        <p style={{ fontSize: 13, color: '#6B7280' }}>Kelola nomor WA Business yang terhubung ke workspace ini.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={connectWhatsApp} style={{ padding: '8px 16px', background: '#0D0D0D', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          Connect WhatsApp
        </button>
        <button onClick={() => setShowManual(s => !s)} style={{ padding: '8px 16px', background: '#fff', color: '#374151', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          Tambah manual
        </button>
      </div>

      {msg && (
        <div style={{ padding: '9px 12px', borderRadius: 7, fontSize: 13, marginBottom: 14, background: msgType === 'ok' ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${msgType === 'ok' ? '#BBF7D0' : '#FECACA'}`, color: msgType === 'ok' ? '#15803D' : '#B91C1C' }}>
          {msg}
        </div>
      )}

      {showManual && (
        <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, padding: 18, marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>Untuk testing: isi dengan data test number dari Meta Cloud API.</p>
          {(['phone_number_id', 'waba_id', 'access_token', 'display_phone', 'label'] as const).map(k => (
            <input key={k} placeholder={k} value={(form as any)[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
              style={{ width: '100%', padding: '8px 11px', marginBottom: 8, border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, color: '#0D0D0D', background: '#F7F7F7', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }}
            />
          ))}
          <button onClick={addManual} style={{ padding: '8px 16px', background: '#0D0D0D', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Simpan nomor
          </button>
        </div>
      )}

      {numbers.length === 0 ? (
        <div style={{ background: '#F7F7F7', border: '1px solid #E5E5E5', borderRadius: 10, padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D', marginBottom: 4 }}>Belum ada nomor tersambung</div>
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>Connect nomor WA Business untuk mulai menerima pesan.</div>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F7F7F7', borderBottom: '1px solid #E5E5E5' }}>
                {['Nomor', 'Label', 'Status', 'Quality'].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {numbers.map(n => {
                const qb = qualityBadge(n.quality_rating)
                return (
                  <tr key={n.id} style={{ borderBottom: '1px solid #F0F0F0' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 500, color: '#0D0D0D' }}>{n.display_phone || n.phone_number_id}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{n.phone_number_id}</div>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#6B7280' }}>{n.label || '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 5, background: n.status === 'CONNECTED' ? '#F0FDF4' : '#F7F7F7', color: n.status === 'CONNECTED' ? '#15803D' : '#6B7280', border: `1px solid ${n.status === 'CONNECTED' ? '#BBF7D0' : '#E5E5E5'}` }}>
                        {n.status || 'unknown'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {n.quality_rating ? (
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 5, background: qb.bg, color: qb.color }}>
                          {n.quality_rating}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
