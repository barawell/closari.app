'use client'
import { useEffect, useState, useRef } from 'react'
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
    href: '/halo-ai', label: 'Aira AI',
    icon: <svg width="15" height="15" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  },
  {
    href: '/broadcast', label: 'Broadcast',
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 7.5C2 7.5 4 4 7.5 4C11 4 13 7.5 13 7.5C13 7.5 11 11 7.5 11C4 11 2 7.5 2 7.5Z" stroke="currentColor" strokeWidth="1.4"/><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/></svg>,
  },
  {
    href: '/templates', label: 'Template',
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="2.5" y="2" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 5.5h5M5 8h5M5 10.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  },
  {
    href: '/kontak', label: 'Kontak',
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="2.4" stroke="currentColor" strokeWidth="1.4"/><path d="M3 12.5c0-2.2 2-3.6 4.5-3.6S12 10.3 12 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  },
  {
    href: '/followup', label: 'Follow Up',
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 2.5h9v7l-3-2-3 2v-7Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M3 11.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  },
  {
    href: '/numbers', label: 'Nomor WhatsApp',
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="3" y="1" width="9" height="13" rx="2" stroke="currentColor" strokeWidth="1.4"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/></svg>,
  },
  {
    href: '/settings', label: 'Setelan',
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.4"/><path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3.2 3.2l1.1 1.1M10.7 10.7l1.1 1.1M10.7 3.2l-1.1 1.1M3.2 10.7l1.1 1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [tenantName, setTenantName] = useState('')
  const [tenantLogo, setTenantLogo] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    (async () => {
      const res = await authFetch('/api/me')
      if (res.status === 401) { router.replace('/login'); return }
      const j = await res.json()
      if (!j.tenant) { router.replace('/onboarding'); return }
      setTenantName(j.tenant.name)
      setTenantLogo(j.tenant.logo_url || null)
      setUserEmail(j.email || '')
      setDisplayName(j.displayName || '')
      setAvatarUrl(j.avatarUrl || null)
      setReady(true)
    })()
  }, [router, pathname])  // re-fetch on path change to reflect updates

  // Close dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false)
    }
    if (showUserMenu) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showUserMenu])

  if (!ready) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <div style={{ fontSize: 13, color: '#9CA3AF' }}>Memuat…</div>
    </div>
  )

  const userInitial = (displayName || userEmail || '?')[0].toUpperCase()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fff' }}>
      {/* SIDEBAR */}
      <aside style={{
        width: 216, background: '#FAFAFA',
        borderRight: '1px solid #E5E5E5',
        display: 'flex', flexDirection: 'column',
        flexShrink: 0, position: 'sticky', top: 0, height: '100vh',
      }}>
        {/* Workspace header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #E5E5E5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 3 }}>
            {tenantLogo ? (
              <img src={tenantLogo} alt={tenantName} width={22} height={22} style={{ display: 'block', borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 22, height: 22, borderRadius: 5, background: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                {(tenantName || 'W')[0].toUpperCase()}
              </div>
            )}
            <span style={{ fontWeight: 700, fontSize: 14, color: '#0D0D0D', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tenantName}</span>
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF', paddingLeft: 31, letterSpacing: 0.5 }}>
            CLOSARI
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 8px' }}>
          {NAV.map(n => {
            const active = pathname === n.href || (n.href === '/settings' && pathname.startsWith('/settings'))
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

        {/* User dropdown */}
        <div style={{ padding: '8px', borderTop: '1px solid #E5E5E5', position: 'relative' }} ref={userMenuRef}>
          <button onClick={() => setShowUserMenu(v => !v)} style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            padding: '8px 10px', borderRadius: 6,
            background: '#fff', border: '1px solid #E5E5E5',
            display: 'flex', alignItems: 'center', gap: 9, fontFamily: 'inherit',
          }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', background: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, border: '1px solid #BBF7D0', flexShrink: 0 }}>
              {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : userInitial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#0D0D0D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName || userEmail.split('@')[0]}
              </div>
              <div style={{ fontSize: 10, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
            </div>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}><path d="M2.5 4L5 6.5L7.5 4" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          {showUserMenu && (
            <div style={{
              position: 'absolute', bottom: 58, left: 8, right: 8,
              background: '#fff', border: '1px solid #E5E5E5', borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              overflow: 'hidden', zIndex: 10,
            }}>
              <Link href="/settings/profile" onClick={() => setShowUserMenu(false)} style={menuItem}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="4.5" r="2.2" stroke="currentColor" strokeWidth="1.3"/><path d="M2.5 11c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                Profil saya
              </Link>
              <Link href="/settings/workspace" onClick={() => setShowUserMenu(false)} style={menuItem}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="2" y="2.5" width="9" height="8" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M5 10.5V8.5H8V10.5" stroke="currentColor" strokeWidth="1.3"/></svg>
                Workspace
              </Link>
              <Link href="/settings/members" onClick={() => setShowUserMenu(false)} style={menuItem}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="4.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.3"/><circle cx="9" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 11c0-1.7 1.5-3 3.5-3s3.5 1.3 3.5 3M8 11c0-1.2 1-2 2-2s2 0.8 2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                Anggota tim
              </Link>
              <div style={{ borderTop: '1px solid #F0F0F0' }} />
              <button onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }} style={{
                ...menuItem, color: '#DC2626', background: 'none', border: 'none', width: '100%', cursor: 'pointer',
                fontFamily: 'inherit', textAlign: 'left',
              }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M5.5 2H2.5C1.95 2 1.5 2.45 1.5 3V10C1.5 10.55 1.95 11 2.5 11H5.5M8.5 9L11 6.5L8.5 4M11 6.5H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Keluar
              </button>
            </div>
          )}
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  )
}

const menuItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9,
  padding: '9px 12px', fontSize: 13, color: '#374151',
  textDecoration: 'none', cursor: 'pointer',
}
