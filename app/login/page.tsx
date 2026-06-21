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
        setInfo('Akun dibuat. Cek inbox email kamu untuk verifikasi, lalu login.')
        setMode('in')
      }
    } catch (e: any) {
      setErr(e?.message || 'Gagal')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0A0F1E' }}>
      {/* Left panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontWeight: 800, fontSize: 22, color: '#fff', letterSpacing: '-0.03em', marginBottom: 40 }}>
              Clos<span style={{ color: '#00D97E' }}>ari</span>
            </div>
          </Link>

          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', marginBottom: 6 }}>
            {mode === 'in' ? 'Selamat datang kembali' : 'Buat akun baru'}
          </h1>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 32 }}>
            {mode === 'in' ? 'Masuk ke workspace kamu' : 'Mulai gratis, tanpa kartu kredit'}
          </p>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#94A3B8', marginBottom: 6, fontWeight: 500 }}>Email</label>
            <input
              type="email" placeholder="kamu@perusahaan.com"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              style={{
                width: '100%', padding: '11px 14px',
                background: '#111827', border: '1px solid #1E293B',
                borderRadius: 8, fontSize: 14, color: '#fff',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#94A3B8', marginBottom: 6, fontWeight: 500 }}>Password</label>
            <input
              type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              style={{
                width: '100%', padding: '11px 14px',
                background: '#111827', border: '1px solid #1E293B',
                borderRadius: 8, fontSize: 14, color: '#fff',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {err && (
            <div style={{ background: '#EF444411', border: '1px solid #EF444433', color: '#FCA5A5', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
              {err}
            </div>
          )}
          {info && (
            <div style={{ background: '#00D97E11', border: '1px solid #00D97E33', color: '#6EE7B7', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
              {info}
            </div>
          )}

          <button
            onClick={submit} disabled={busy || !email || !password}
            style={{
              width: '100%', padding: '12px 0',
              background: busy || !email || !password ? '#1E293B' : '#00D97E',
              color: busy || !email || !password ? '#475569' : '#0A0F1E',
              border: 0, borderRadius: 8, fontSize: 15, fontWeight: 700,
              cursor: busy || !email || !password ? 'not-allowed' : 'pointer',
              marginTop: 8,
            }}
          >
            {busy ? 'Memproses…' : mode === 'in' ? 'Masuk' : 'Buat akun'}
          </button>

          <p style={{ fontSize: 13, marginTop: 20, color: '#475569', textAlign: 'center' }}>
            {mode === 'in' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
            <button onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); setInfo('') }}
              style={{ color: '#00D97E', background: 'none', border: 0, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              {mode === 'in' ? 'Daftar gratis' : 'Masuk'}
            </button>
          </p>
        </div>
      </div>

      {/* Right panel — decorative */}
      <div style={{
        flex: 1, background: '#111827',
        borderLeft: '1px solid #1E293B',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        padding: 48,
      }}>
        <div style={{ maxWidth: 360 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#00D97E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>
            Mengapa Closari?
          </div>
          {[
            { icon: '⚡', text: 'Balas lebih cepat dengan saran AI real-time' },
            { icon: '🛡️', text: 'Nomor aman — filter kontak & cooldown built-in' },
            { icon: '👥', text: 'Satu inbox untuk seluruh tim CS kamu' },
            { icon: '📊', text: 'Audit trail setiap pesan yang keluar masuk' },
          ].map(item => (
            <div key={item.text} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: '#00D97E11',
                border: '1px solid #00D97E22', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 16, flexShrink: 0,
              }}>{item.icon}</div>
              <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.5, margin: 0 }}>{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
