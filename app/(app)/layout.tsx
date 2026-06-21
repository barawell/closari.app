'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/client-fetch'

const NAV = [
  { href: '/inbox', label: 'Inbox', icon: '💬' },
  { href: '/broadcast', label: 'Broadcast', icon: '📣' },
  { href: '/numbers', label: 'Nomor', icon: '📱' },
  { href: '/settings', label: 'AI & Setelan', icon: '⚙️' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [tenantName, setTenantName] = useState('')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    (async () => {
      const res = await authFetch('/api/me')
      if (res.status === 401) { router.replace('/login'); return }
      const j = await res.json()
      if (!j.tenant) { router.replace('/onboarding'); return }
      setTenantName(j.tenant.name)
      setUserEmail(j.email || '')
      setReady(true)
    })()
  }, [router])

  if (!ready) return (
    <div style={{ minHeight: '100vh', background: '#0A0F1E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#475569', fontSize: 14 }}>Memuat…</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F0FDF4' }}>
      {/* SIDEBAR */}
      <aside style={{
        width: 220, background: '#0A0F1E',
        borderRight: '1px solid #1E293B',
        display: 'flex', flexDirection: 'column',
        flexShrink: 0, position: 'sticky', top: 0, height: '100vh',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #1E293B' }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: '-0.03em', marginBottom: 2 }}>
            Clos<span style={{ color: '#00D97E' }}>ari</span>
          </div>
          <div style={{
            fontSize: 11, color: '#475569', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2,
          }}>{tenantName}</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 12px' }}>
          {NAV.map(n => {
            const active = pathname === n.href
            return (
              <Link key={n.href} href={n.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8, fontSize: 14,
                textDecoration: 'none', marginBottom: 2,
                color: active ? '#fff' : '#64748B',
                background: active ? '#1E293B' : 'transparent',
                fontWeight: active ? 600 : 400,
              }}>
                <span style={{ fontSize: 15 }}>{n.icon}</span>
                {n.label}
                {active && <span style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: '#00D97E' }} />}
              </Link>
            )
          })}
        </nav>

        {/* User + logout */}
        <div style={{ padding: '12px', borderTop: '1px solid #1E293B' }}>
          <div style={{ padding: '8px 12px', marginBottom: 4 }}>
            <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userEmail}
            </div>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }}
            style={{
              width: '100%', textAlign: 'left',
              padding: '9px 12px', borderRadius: 8, fontSize: 13,
              color: '#475569', background: 'none', border: 0,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Keluar
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  )
}
