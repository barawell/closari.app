'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const TABS = [
  { href: '/settings/profile', label: 'Profil Saya' },
  { href: '/settings/workspace', label: 'Workspace' },
  { href: '/settings/members', label: 'Anggota Tim' },
  { href: '/settings/quick-replies', label: 'Quick Replies' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      {/* Header */}
      <div style={{ padding: '24px 32px 0', borderBottom: '1px solid #E5E5E5' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0D0D0D', letterSpacing: '-0.02em', margin: 0, marginBottom: 4 }}>Setelan</h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: 0, marginBottom: 16 }}>Kelola profil, workspace, anggota tim, dan quick replies.</p>

        {/* Tab nav */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(tab => {
            const active = pathname === tab.href || (tab.href === '/settings/profile' && pathname === '/settings')
            return (
              <Link key={tab.href} href={tab.href} style={{
                padding: '10px 14px', fontSize: 13, fontWeight: 500,
                textDecoration: 'none',
                color: active ? '#0D0D0D' : '#9CA3AF',
                borderBottom: active ? '2px solid #16A34A' : '2px solid transparent',
                marginBottom: -1,
              }}>
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 32px', maxWidth: 760 }}>
        {children}
      </div>
    </div>
  )
}
