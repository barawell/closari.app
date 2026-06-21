'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authFetch } from '@/lib/client-fetch'

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function create() {
    setBusy(true); setErr('')
    try {
      const res = await authFetch('/api/tenant', { method: 'POST', body: JSON.stringify({ name }) })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Gagal')
      router.push('/inbox')
    } catch (e: any) { setErr(e?.message || 'Gagal'); setBusy(false) }
  }

  return (
    <main style={{ maxWidth: 420, margin: '90px auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Buat workspace</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>Nama bisnis kamu — ini jadi tenant pertama kamu di Closari.</p>
      <input placeholder="Nama bisnis (mis. Barawell)" value={name} onChange={e => setName(e.target.value)}
        style={{ width: '100%', padding: 11, marginBottom: 12, border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
      {err && <p style={{ color: '#c00', fontSize: 13 }}>{err}</p>}
      <button onClick={create} disabled={busy || !name.trim()}
        style={{ width: '100%', padding: 12, background: '#111', color: '#fff', border: 0, borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
        {busy ? '...' : 'Buat & lanjut'}
      </button>
    </main>
  )
}
