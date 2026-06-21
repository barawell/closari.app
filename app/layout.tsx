import type { ReactNode } from 'react'

export const metadata = {
  title: 'Closari',
  description: 'Platform WhatsApp Business multi-tenant + AI',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>{children}</body>
    </html>
  )
}
