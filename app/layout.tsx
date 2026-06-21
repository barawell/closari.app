import type { ReactNode } from 'react'
import './globals.css'

export const metadata = {
  title: 'Closari — CS WhatsApp + AI',
  description: 'Shared inbox, AI copilot, dan broadcast yang compliant. Satu platform untuk tim CS kamu.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
