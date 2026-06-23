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

  // Diagnose state
  const [diagFor, setDiagFor] = useState<string | null>(null)
  const [diagLoading, setDiagLoading] = useState(false)
  const [diag, setDiag] = useState<any>(null)
  const [subscribing, setSubscribing] = useState(false)

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

  async function runDiagnose(id: string) {
    setDiagFor(id); setDiag(null); setDiagLoading(true)
    try {
      const res = await authFetch(`/api/numbers/diagnose?id=${id}`)
      const j = await res.json()
      setDiag(j.checks || { errors: [j.error || 'gagal cek'] })
    } finally { setDiagLoading(false) }
  }

  async function subscribe(id: string) {
    setSubscribing(true)
    try {
      const res = await authFetch('/api/numbers/diagnose', { method: 'POST', body: JSON.stringify({ id }) })
      const j = await res.json()
      if (res.ok) { await runDiagnose(id); load() }
      else { setDiag((d: any) => ({ ...(d || {}), errors: [...(d?.errors || []), j.error || 'gagal subscribe'] })) }
    } finally { setSubscribing(false) }
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
    <div style={{ padding: '32px 36px', maxWidth: 760 }}>
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
          <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>Isi dengan data dari Meta: phone_number_id, WABA ID, dan permanent access token.</p>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {numbers.map(n => {
            const qb = qualityBadge(n.quality_rating)
            const isDiag = diagFor === n.id
            return (
              <div key={n.id} style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#0D0D0D', fontSize: 14 }}>{n.display_phone || n.phone_number_id}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{n.label ? `${n.label} · ` : ''}{n.phone_number_id}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 5, background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
                      {n.status || 'connected'}
                    </span>
                    {n.quality_rating && (
                      <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 5, background: qb.bg, color: qb.color }}>{n.quality_rating}</span>
                    )}
                    <button onClick={() => isDiag ? setDiagFor(null) : runDiagnose(n.id)}
                      style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, background: isDiag ? '#0D0D0D' : '#fff', color: isDiag ? '#fff' : '#374151', border: '1px solid #E5E5E5', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {isDiag ? 'Tutup' : 'Cek koneksi'}
                    </button>
                  </div>
                </div>

                {isDiag && (
                  <div style={{ borderTop: '1px solid #F0F0F0', padding: '14px 16px', background: '#FAFAFA' }}>
                    {diagLoading ? (
                      <div style={{ fontSize: 12, color: '#9CA3AF' }}>Mengecek koneksi ke Meta…</div>
                    ) : diag ? (
                      <div>
                        <CheckRow ok={diag.has_token} label="Access token tersimpan" />
                        <CheckRow ok={diag.token_valid} label="Token valid (bisa akses Meta API)" />
                        <CheckRow ok={diag.webhook_subscribed} label="Webhook ter-subscribe ke WABA (WAJIB biar pesan masuk)" />

                        {diag.phone_info?.verified_name && (
                          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>Nama terverifikasi: <b>{diag.phone_info.verified_name}</b></div>
                        )}

                        {!diag.webhook_subscribed && diag.token_valid && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 12, color: '#B45309', marginBottom: 8, lineHeight: 1.5 }}>
                              ⚠️ Inilah penyebab pesan tidak masuk. App belum subscribe ke WABA. Klik tombol di bawah untuk mengaktifkan.
                            </div>
                            <button onClick={() => subscribe(n.id)} disabled={subscribing}
                              style={{ padding: '9px 16px', background: subscribing ? '#F0F0F0' : '#16A34A', color: subscribing ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: subscribing ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                              {subscribing ? 'Mengaktifkan…' : '✓ Aktifkan terima pesan (subscribe webhook)'}
                            </button>
                          </div>
                        )}

                        {diag.webhook_subscribed && (
                          <div style={{ marginTop: 10, fontSize: 12, color: '#15803D', fontWeight: 500 }}>
                            ✓ Koneksi sehat. Pesan masuk harusnya langsung muncul di Inbox.
                          </div>
                        )}

                        {(diag.errors || []).length > 0 && (
                          <div style={{ marginTop: 12, padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7 }}>
                            {diag.errors.map((e: string, i: number) => (
                              <div key={i} style={{ fontSize: 11.5, color: '#B91C1C', lineHeight: 1.5 }}>• {e}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Panduan webhook */}
      <div style={{ marginTop: 24, padding: '16px 18px', background: '#F7F7F7', border: '1px solid #E5E5E5', borderRadius: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D', marginBottom: 8 }}>Kalau pesan tetap tidak masuk, cek di Meta:</div>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#6B7280', lineHeight: 1.7 }}>
          <li>Meta App → WhatsApp → Configuration → Webhook URL = <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>https://closari-app-ogl6.vercel.app/api/wa/webhook</code></li>
          <li>Field <b>messages</b> harus ter-checklist (Subscribe).</li>
          <li><b>META_APP_SECRET</b> di Vercel harus persis sama dengan App Secret di Meta → Settings → Basic.</li>
          <li>Klik "Cek koneksi" di atas → kalau webhook belum subscribe, klik tombol hijau.</li>
        </ol>
      </div>
    </div>
  )
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12.5, color: '#374151' }}>
      <span style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ok ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${ok ? '#BBF7D0' : '#FECACA'}` }}>
        {ok
          ? <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="#16A34A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          : <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M3 3L7 7M7 3L3 7" stroke="#DC2626" strokeWidth="1.6" strokeLinecap="round"/></svg>}
      </span>
      {label}
    </div>
  )
}
