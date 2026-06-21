'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/client-fetch'

const NAV = [
  { href: '/inbox', label: 'Inbox' },
  { href: '/broadcast', label: 'Broadcast' },
  { href: '/numbers', label: 'Nomor' },
  { href: '/settings', label: 'AI & Setelan' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [tenantName, setTenantName] = useState('')

  useEffect(() => {
    (async () => {
      const res = await authFetch('/api/me')
      if (res.status === 401) { router.replace('/login'); return }
      const j = await res.json()
      if (!j.tenant) { router.replace('/onboarding'); return }
      setTenantName(j.tenant.name)
      setReady(true)
    })()
  }, [router])

  if (!ready) return <div style={{ padding: 40, color: '#888' }}>Memuat…</div>

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, borderRight: '1px solid #eee', padding: 20, flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>Closari</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 24 }}>{tenantName}</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              style={{
                padding: '8px 12px', borderRadius: 8, fontSize: 14, textDecoration: 'none',
                color: pathname === n.href ? '#111' : '#555',
                background: pathname === n.href ? '#f3f3f3' : 'transparent', fontWeight: pathname === n.href ? 600 : 400,
              }}>{n.label}</Link>
          ))}
        </nav>
        <button onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }}
          style={{ marginTop: 24, fontSize: 13, color: '#888', background: 'none', border: 0, cursor: 'pointer', padding: '8px 12px' }}>
          Keluar
        </button>
      </aside>
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  )
}
