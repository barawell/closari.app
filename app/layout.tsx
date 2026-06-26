import type { Metadata, Viewport } from 'next'
import './globals.css'
import SWRegister from './sw-register'

export const metadata: Metadata = {
  title: 'Closari — WhatsApp Business + AI untuk Tim',
  description: 'Platform WhatsApp Business multi-tenant dengan AI auto-reply, broadcast, dan inbox terpadu.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#16A34A',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, padding: 0, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        {children}
        <SWRegister />
      </body>
    </html>
  )
}
