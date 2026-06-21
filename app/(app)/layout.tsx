'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/client-fetch'

const NAV = [
  {
    href: '/inbox', label: 'Inbox',
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 3.5h11M2 7.5h11M2 11.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  },
  {
    href: '/broadcast', label: 'Broadcast',
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 7.5C2 7.5 4 4 7.5 4C11 4 13 7.5 13 7.5C13 7.5 11 11 7.5 11C4 11 2 7.5 2 7.5Z" stroke="currentColor" strokeWidth="1.4"/><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/></svg>,
  },
  {
    href: '/numbers', label: 'Nomor',
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="3" y="1" width="9" height="13" rx="2" stroke="currentColor" strokeWidth="1.4"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/></svg>,
  },
  {
    href: '/settings', label: 'AI & Setelan',
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.4"/><path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3.2 3.2l1.1 1.1M10.7 10.7l1.1 1.1M10.7 3.2l-1.1 1.1M3.2 10.7l1.1 1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  },
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <div style={{ fontSize: 13, color: '#9CA3AF' }}>Memuat…</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fff' }}>
      {/* SIDEBAR */}
      <aside style={{
        width: 216, background: '#FAFAFA',
        borderRight: '1px solid #E5E5E5',
        display: 'flex', flexDirection: 'column',
        flexShrink: 0, position: 'sticky', top: 0, height: '100vh',
      }}>
        {/* Logo */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #E5E5E5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <img src="/logo.png" alt="Closari" width={18} height={18} style={{ display: "block", borderRadius: 5 }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#0D0D0D', letterSpacing: '-0.02em' }}>Closari</span>
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', paddingLeft: 25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tenantName}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 8px' }}>
          {NAV.map(n => {
            const active = pathname === n.href
            return (
              <Link key={n.href} href={n.href} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '7px 10px', borderRadius: 6, fontSize: 13,
                textDecoration: 'none', marginBottom: 1,
                color: active ? '#0D0D0D' : '#6B7280',
                background: active ? '#fff' : 'transparent',
                fontWeight: active ? 500 : 400,
                border: active ? '1px solid #E5E5E5' : '1px solid transparent',
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
              }}>
                <span style={{ color: active ? '#16A34A' : '#9CA3AF', display: 'flex' }}>{n.icon}</span>
                {n.label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div style={{ padding: '8px', borderTop: '1px solid #E5E5E5' }}>
          <div style={{
            padding: '8px 10px', borderRadius: 6, marginBottom: 2,
            background: '#fff', border: '1px solid #E5E5E5',
          }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#0D0D0D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userEmail}
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{tenantName}</div>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }}
            style={{
              width: '100%', textAlign: 'left',
              padding: '7px 10px', borderRadius: 6, fontSize: 13,
              color: '#9CA3AF', background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Keluar
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  )
}
