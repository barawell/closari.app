'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BrandLoader } from '@/app/Loader'

function UpdatePasswordInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ready, setReady] = useState(false)
  const [authedEmail, setAuthedEmail] = useState('')

  // Handle code exchange CLIENT-SIDE supaya session cookie ke-set di browser.
  // Bug sebelumnya: server-side exchangeCodeForSession tidak persist cookie,
  // jadi user mendarat di sini tanpa session valid.
  useEffect(() => {
    (async () => {
      const code = searchParams.get('code')
      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            setErr('Link reset password sudah kedaluwarsa atau tidak valid. Coba minta link baru.')
            setReady(true)
            return
          }
        } catch (e: any) {
          setErr('Gagal verifikasi link: ' + (e?.message || 'unknown'))
          setReady(true)
          return
        }
      }
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setErr('Sesi tidak valid. Klik link reset password lagi dari email kamu.')
      } else {
        setAuthedEmail(data.session.user.email || '')
      }
      setReady(true)
    })()
  }, [searchParams])

  async function submit() {
    if (password !== confirm) { setErr('Password tidak cocok'); return }
    if (password.length < 8) { setErr('Password minimal 8 karakter'); return }
    setBusy(true); setErr('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      router.push('/inbox')
    } catch (e: any) {
      setErr(e?.message || 'Gagal update password')
    } finally { setBusy(false) }
  }

  if (!ready) {
    return <div style={{ fontSize: 13, color: '#9CA3AF' }}>Memverifikasi link…</div>
  }

  return (
    <div style={{ width: '100%', maxWidth: 380, padding: '0 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 40 }}>
        <img src="/logo.png" alt="Closari" width={20} height={20} style={{ display: "block", borderRadius: 5 }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: '#0D0D0D', letterSpacing: '-0.02em' }}>Closari</span>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D0D0D', letterSpacing: '-0.03em', marginBottom: 6 }}>Buat password baru</h1>
      <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>Minimal 8 karakter.</p>
      {authedEmail && (
        <p style={{ fontSize: 12, color: '#16A34A', marginBottom: 24 }}>Untuk akun: {authedEmail}</p>
      )}

      <label style={{ display: 'block', fontSize: 13, color: '#374151', fontWeight: 500, marginBottom: 6 }}>Password baru</label>
      <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
        style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 14, color: '#0D0D0D', background: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />

      <label style={{ display: 'block', fontSize: 13, color: '#374151', fontWeight: 500, marginBottom: 6 }}>Konfirmasi password</label>
      <input type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 14, color: '#0D0D0D', background: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />

      {err && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, fontSize: 13, color: '#B91C1C', marginBottom: 8 }}>{err}</div>}

      <button onClick={submit} disabled={busy || !password || !confirm || !authedEmail}
        style={{ width: '100%', padding: '10px 0', background: busy || !password || !confirm || !authedEmail ? '#F0F0F0' : '#0D0D0D', color: busy || !password || !confirm || !authedEmail ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 500, cursor: busy || !password || !confirm || !authedEmail ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
        {busy ? 'Menyimpan…' : 'Simpan password baru'}
      </button>

      {!authedEmail && (
        <a href="/forgot-password" style={{ display: 'block', textAlign: 'center', marginTop: 16, fontSize: 13, color: '#16A34A', textDecoration: 'none', fontWeight: 500 }}>
          Minta link reset baru →
        </a>
      )}
    </div>
  )
}

export default function UpdatePasswordPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7' }}>
      <Suspense fallback={<BrandLoader full />}>
        <UpdatePasswordInner />
      </Suspense>
    </div>
  )
}
