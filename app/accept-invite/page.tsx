'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BrandLoader } from '@/app/Loader'

function AcceptInviteInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [inviteInfo, setInviteInfo] = useState<{ email: string; role: string; tenant: { name: string; logo_url: string | null } } | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentEmail, setCurrentEmail] = useState('')
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    (async () => {
      if (!token) {
        setErr('Token tidak valid')
        setLoading(false)
        return
      }

      // Cek invite info
      const res = await fetch(`/api/invites/${token}`)
      const j = await res.json()
      if (!res.ok) {
        setErr(j.error || 'Invite tidak valid')
        setLoading(false)
        return
      }
      setInviteInfo({ email: j.invite.email, role: j.invite.role, tenant: j.tenant })

      // Cek session login
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setIsLoggedIn(true)
        setCurrentEmail(data.session.user.email || '')
      }
      setLoading(false)
    })()
  }, [token])

  async function accept() {
    if (!token) return
    setAccepting(true)
    setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setErr('Sesi tidak ada, login dulu'); return }

      const res = await fetch(`/api/invites/${token}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const j = await res.json()
      if (res.ok) {
        // Redirect to inbox
        router.push('/inbox')
      } else {
        setErr(j.error || 'Gagal terima invite')
      }
    } finally { setAccepting(false) }
  }

  if (loading) {
    return <div style={{ fontSize: 13, color: '#9CA3AF' }}>Memvalidasi invite…</div>
  }

  if (err && !inviteInfo) {
    return (
      <div style={{ width: '100%', maxWidth: 420, padding: '0 24px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 8V12M12 16V16.01M3 12a9 9 0 1118 0 9 9 0 01-18 0z" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0D0D0D', marginBottom: 8 }}>Invite tidak valid</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24, lineHeight: 1.6 }}>{err}</p>
        <a href="/login" style={{ display: 'inline-block', padding: '10px 20px', background: '#0D0D0D', color: '#fff', borderRadius: 7, textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>Ke halaman masuk</a>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: 420, padding: '0 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 32 }}>
        <img src="/logo.png" alt="Closari" width={20} height={20} style={{ display: "block", borderRadius: 5 }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: '#0D0D0D', letterSpacing: '-0.02em' }}>Closari</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {inviteInfo?.tenant?.logo_url ? (
            <img src={inviteInfo.tenant.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: 22, fontWeight: 600, color: '#16A34A' }}>{(inviteInfo?.tenant?.name || '?')[0].toUpperCase()}</span>
          )}
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500, letterSpacing: '0.05em' }}>UNDANGAN BERGABUNG</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0D0D0D', letterSpacing: '-0.01em' }}>{inviteInfo?.tenant?.name}</div>
        </div>
      </div>

      <div style={{ padding: 14, background: '#FAFAFA', border: '1px solid #E5E5E5', borderRadius: 8, marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>Detail invite</div>
        <div style={{ fontSize: 13, color: '#0D0D0D', lineHeight: 1.7 }}>
          <div>Email: <strong>{inviteInfo?.email}</strong></div>
          <div>Role: <strong>{inviteInfo?.role === 'admin' ? 'Admin' : 'Agen'}</strong></div>
        </div>
      </div>

      {!isLoggedIn ? (
        <>
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 1.6 }}>
            Untuk terima invite, login dulu dengan email <strong>{inviteInfo?.email}</strong>. Belum punya akun? Daftar dulu.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={`/login?next=/accept-invite?token=${token}`} style={{ flex: 1, padding: '10px 0', background: '#0D0D0D', color: '#fff', borderRadius: 7, textDecoration: 'none', fontSize: 13, fontWeight: 500, textAlign: 'center' }}>Masuk</a>
            <a href={`/?next=/accept-invite?token=${token}`} style={{ flex: 1, padding: '10px 0', background: '#fff', color: '#0D0D0D', border: '1px solid #E5E5E5', borderRadius: 7, textDecoration: 'none', fontSize: 13, fontWeight: 500, textAlign: 'center' }}>Daftar</a>
          </div>
        </>
      ) : currentEmail.toLowerCase() !== inviteInfo?.email.toLowerCase() ? (
        <>
          <div style={{ padding: '10px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 7, fontSize: 12, color: '#92400E', marginBottom: 16, lineHeight: 1.5 }}>
            Kamu login sebagai <strong>{currentEmail}</strong>, tapi invite ini untuk <strong>{inviteInfo?.email}</strong>.<br />
            Logout dulu & login dengan email yang sesuai.
          </div>
          <button onClick={async () => { await supabase.auth.signOut(); router.push(`/login?next=/accept-invite?token=${token}`) }} style={{ width: '100%', padding: '10px 0', background: '#0D0D0D', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Logout & masuk ulang</button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 1.6 }}>
            Klik di bawah untuk bergabung ke workspace <strong>{inviteInfo?.tenant.name}</strong>.
          </p>
          <button onClick={accept} disabled={accepting} style={{ width: '100%', padding: '10px 0', background: accepting ? '#F0F0F0' : '#16A34A', color: accepting ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: accepting ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
            {accepting ? 'Menggabungkan…' : 'Terima & Bergabung'}
          </button>
          {err && <div style={{ marginTop: 10, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, fontSize: 12, color: '#B91C1C' }}>{err}</div>}
        </>
      )}
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7' }}>
      <Suspense fallback={<BrandLoader full />}>
        <AcceptInviteInner />
      </Suspense>
    </div>
  )
}
