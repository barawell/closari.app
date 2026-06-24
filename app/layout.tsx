import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Closari — WhatsApp Business + AI untuk Tim',
  description: 'Platform WhatsApp Business multi-tenant dengan AI auto-reply, broadcast, dan inbox terpadu.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, padding: 0, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
