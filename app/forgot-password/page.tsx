'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    if (!email) return
    setBusy(true); setErr('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
      })
      if (error) throw error
      setSent(true)
    } catch (e: any) {
      setErr(e?.message || 'Gagal mengirim email')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 24px' }}>
        <Link href="/login" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 40 }}>
          <img src="/logo.png" alt="Closari" width={20} height={20} style={{ display: "block", borderRadius: 5 }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: '#0D0D0D', letterSpacing: '-0.02em' }}>Closari</span>
        </Link>

        {sent ? (
          <div>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10L8 14L16 6" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D0D0D', letterSpacing: '-0.03em', marginBottom: 8 }}>Cek email kamu</h1>
            <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
              Link reset password sudah dikirim ke <strong>{email}</strong>. Cek inbox atau folder spam.
            </p>
            <Link href="/login" style={{ fontSize: 13, color: '#16A34A', textDecoration: 'none', fontWeight: 500 }}>
              Kembali ke halaman masuk
            </Link>
          </div>
        ) : (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D0D0D', letterSpacing: '-0.03em', marginBottom: 6 }}>Reset password</h1>
            <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 28, lineHeight: 1.5 }}>
              Masukkan email kamu dan kami kirimkan link untuk reset password.
            </p>

            <label style={{ display: 'block', fontSize: 13, color: '#374151', fontWeight: 500, marginBottom: 6 }}>Email</label>
            <input
              type="email" placeholder="nama@perusahaan.com"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 14, color: '#0D0D0D', background: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
            />

            {err && (
              <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, fontSize: 13, color: '#B91C1C', marginBottom: 8 }}>
                {err}
              </div>
            )}

            <button
              onClick={submit} disabled={busy || !email}
              style={{ width: '100%', padding: '10px 0', background: busy || !email ? '#F0F0F0' : '#0D0D0D', color: busy || !email ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 500, cursor: busy || !email ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginBottom: 16 }}
            >
              {busy ? 'Mengirim…' : 'Kirim link reset'}
            </button>

            <Link href="/login" style={{ fontSize: 13, color: '#6B7280', textDecoration: 'none' }}>
              ← Kembali ke halaman masuk
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
