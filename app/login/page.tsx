'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
        setInfo('Akun dibuat. Kalau diminta verifikasi email, cek inbox dulu, lalu login.')
        setMode('in')
      }
    } catch (e: any) {
      setErr(e?.message || 'Gagal')
    } finally { setBusy(false) }
  }

  return (
    <main style={{ maxWidth: 380, margin: '90px auto', padding: 24 }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Closari</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>{mode === 'in' ? 'Masuk ke akun kamu' : 'Buat akun baru'}</p>
      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inp} />
      <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={inp} />
      {err && <p style={{ color: '#c00', fontSize: 13 }}>{err}</p>}
      {info && <p style={{ color: '#070', fontSize: 13 }}>{info}</p>}
      <button onClick={submit} disabled={busy || !email || !password} style={btn}>
        {busy ? '...' : mode === 'in' ? 'Masuk' : 'Daftar'}
      </button>
      <p style={{ fontSize: 13, marginTop: 16, color: '#666' }}>
        {mode === 'in' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
        <a onClick={() => setMode(mode === 'in' ? 'up' : 'in')} style={{ color: '#2563eb', cursor: 'pointer' }}>
          {mode === 'in' ? 'Daftar' : 'Masuk'}
        </a>
      </p>
    </main>
  )
}

const inp: React.CSSProperties = { width: '100%', padding: 11, marginBottom: 10, border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }
const btn: React.CSSProperties = { width: '100%', padding: 12, background: '#111', color: '#fff', border: 0, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
