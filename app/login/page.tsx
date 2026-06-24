'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next') || '/inbox'
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')

  function friendlyErr(e: any): string {
    // Ambil semua kemungkinan pesan dari error object
    const msg = String(e?.message || e?.error_description || e?.msg || e?.error || '')
    const code = String(e?.code || e?.error_code || e?.status || '')
    const combined = (msg + code).toLowerCase()

    if (combined.includes('already') || combined.includes('exists') || code === '422' || e?.status === 422)
      return 'Email ini sudah terdaftar. Silakan masuk.'
    if (combined.includes('invalid') || combined.includes('credentials') || code === '400' || e?.status === 400)
      return 'Email atau password salah.'
    if (combined.includes('not confirmed'))
      return 'Email belum dikonfirmasi. Cek inbox kamu.'
    if (combined.includes('password'))
      return 'Password minimal 6 karakter.'
    if (msg.trim() && msg !== '{}' && msg !== '[object Object]')
      return msg
    return 'Email sudah terdaftar atau terjadi kesalahan. Coba masuk.'
  }

  async function submit() {
    setErr(''); setInfo('')
    if (mode === 'up') {
      if (password.length < 6) { setErr('Password minimal 6 karakter.'); return }
      if (password !== confirm) { setErr('Password dan konfirmasi tidak sama.'); return }
    }
    setBusy(true)
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setErr(friendlyErr(error)); return }
        router.push(nextPath)
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) { setErr(friendlyErr(error)); return }
        if (data?.session) {
          // Email confirm OFF → langsung masuk
          router.push(nextPath)
          return
        }
        if (!data?.user) {
          // User null + no error = email sudah terdaftar (Supabase behavior)
          setErr('Email ini sudah terdaftar. Silakan masuk.')
          setMode('in'); setPassword(''); setConfirm('')
          return
        }
        setInfo('Akun dibuat! Cek email untuk konfirmasi, lalu login.')
        setMode('in'); setPassword(''); setConfirm('')
      }
    } catch (e: any) {
      setErr(friendlyErr(e))
    } finally { setBusy(false) }
  }

  const canSubmit = !busy && !!email && !!password && (mode === 'in' || !!confirm)

  const eyeIcon = (
    <button type="button" onClick={() => setShowPw(v => !v)}
      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, display: 'flex', alignItems: 'center' }}>
      {showPw
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      }
    </button>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '48px 40px', background: '#fff' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 48 }}>
            <img src="/logo.png" alt="Closari" width={22} height={22} style={{ display: 'block', borderRadius: 5 }} />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#0D0D0D', letterSpacing: '-0.02em' }}>Closari</span>
          </Link>

          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0D0D0D', letterSpacing: '-0.03em', marginBottom: 6 }}>
            {mode === 'in' ? 'Selamat datang kembali' : 'Buat akun baru'}
          </h1>
          <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 28, lineHeight: 1.5 }}>
            {mode === 'in' ? 'Masuk ke workspace kamu' : 'Mulai gratis, tanpa kartu kredit'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#374151', fontWeight: 500, marginBottom: 5 }}>Email</label>
              <input type="email" placeholder="nama@perusahaan.com" value={email}
                onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                style={inp} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>Password</label>
                {mode === 'in' && (
                  <Link href="/forgot-password" style={{ fontSize: 12, color: '#16A34A', textDecoration: 'none', fontWeight: 500 }}>Lupa password?</Link>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                  style={{ ...inp, paddingRight: 36 }} />
                {eyeIcon}
              </div>
            </div>
            {mode === 'up' && (
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#374151', fontWeight: 500, marginBottom: 5 }}>Konfirmasi Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={confirm}
                    onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                    style={{ ...inp, paddingRight: 36, borderColor: confirm && confirm !== password ? '#FECACA' : '#E5E5E5' }} />
                  {eyeIcon}
                </div>
                {confirm && confirm !== password && (
                  <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Password tidak sama</div>
                )}
              </div>
            )}
          </div>

          {err && <div style={{ marginTop: 12, padding: '9px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, fontSize: 13, color: '#B91C1C' }}>{err}</div>}
          {info && <div style={{ marginTop: 12, padding: '9px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 7, fontSize: 13, color: '#15803D' }}>{info}</div>}

          <button onClick={submit} disabled={!canSubmit}
            style={{ width: '100%', marginTop: 16, padding: '10px 0', background: canSubmit ? '#0D0D0D' : '#F0F0F0', color: canSubmit ? '#fff' : '#9CA3AF', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 500, cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
            {busy ? 'Memproses…' : mode === 'in' ? 'Masuk' : 'Buat akun'}
          </button>

          <p style={{ fontSize: 13, marginTop: 18, color: '#9CA3AF', textAlign: 'center' }}>
            {mode === 'in' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
            <button onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); setInfo(''); setConfirm('') }}
              style={{ color: '#16A34A', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }}>
              {mode === 'in' ? 'Daftar gratis' : 'Masuk'}
            </button>
          </p>
        </div>
      </div>

      <div style={{ background: '#F7F7F7', borderLeft: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 48px' }}>
        <div style={{ maxWidth: 340 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#16A34A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>Mengapa Closari</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { headline: 'Balas lebih cepat', desc: 'AI Copilot baca setiap percakapan dan sarankan respons terbaik real-time.' },
              { headline: 'Nomor tetap aman', desc: 'Filter kontak aktif dan cooldown otomatis — dibangun oleh tim yang pernah kena banned.' },
              { headline: 'Satu inbox, semua tim', desc: 'Banyak agen, banyak nomor, satu tampilan yang rapi dan terorganisir.' },
              { headline: 'Setup dalam menit', desc: 'Connect nomor, invite tim, aktifkan AI. Tidak perlu technical setup yang rumit.' },
            ].map(item => (
              <div key={item.headline} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 2, background: '#0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#0D0D0D', marginBottom: 2 }}>{item.headline}</div>
                  <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 14, color: '#0D0D0D', background: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', fontSize: 13, color: '#9CA3AF' }}>Memuat…</div>}>
      <LoginInner />
    </Suspense>
  )
}
