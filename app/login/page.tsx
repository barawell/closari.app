'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')

  async function submit() {
    setBusy(true); setErr(''); setInfo('')
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/inbox')
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setInfo('Akun dibuat. Cek email untuk verifikasi, lalu login.')
        setMode('in')
      }
    } catch (e: any) {
      setErr(e?.message || 'Gagal')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '48px 40px', background: '#fff' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 48 }}>
            <img src="/logo.png" alt="Closari" width={22} height={22} style={{ display: "block", borderRadius: 5 }} />
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
              <input type="email" placeholder="nama@perusahaan.com" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 14, color: '#0D0D0D', background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>Password</label>
                {mode === 'in' && (
                  <Link href="/forgot-password" style={{ fontSize: 12, color: '#16A34A', textDecoration: 'none', fontWeight: 500 }}>
                    Lupa password?
                  </Link>
                )}
              </div>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 14, color: '#0D0D0D', background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {err && <div style={{ marginTop: 12, padding: '9px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, fontSize: 13, color: '#B91C1C' }}>{err}</div>}
          {info && <div style={{ marginTop: 12, padding: '9px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 7, fontSize: 13, color: '#15803D' }}>{info}</div>}

          <button onClick={submit} disabled={busy || !email || !password}
            style={{ width: '100%', marginTop: 16, padding: '10px 0', background: busy || !email || !password ? '#F0F0F0' : '#0D0D0D', color: busy || !email || !password ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 500, cursor: busy || !email || !password ? 'not-allowed' : 'pointer', letterSpacing: '-0.01em' }}>
            {busy ? 'Memproses…' : mode === 'in' ? 'Masuk' : 'Buat akun'}
          </button>

          <p style={{ fontSize: 13, marginTop: 18, color: '#9CA3AF', textAlign: 'center' }}>
            {mode === 'in' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
            <button onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); setInfo('') }}
              style={{ color: '#16A34A', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
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
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
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
