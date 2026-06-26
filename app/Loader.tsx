'use client'
import React from 'react'

// Loader ber-branding Closari: logo berdenyut + ring hijau berputar.
// Pakai <BrandLoader full /> untuk layar penuh, atau <BrandLoader label="…" /> inline.
export function BrandLoader({ label, full = false }: { label?: string; full?: boolean }) {
  const node = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <span className="closari-spinner" aria-hidden>
        <svg className="closari-spinner-ring" viewBox="0 0 60 60" width="60" height="60">
          <circle cx="30" cy="30" r="27" fill="none" stroke="#ECECEC" strokeWidth="4" />
          <circle cx="30" cy="30" r="27" fill="none" stroke="#16A34A" strokeWidth="4" strokeLinecap="round" strokeDasharray="58 200" />
        </svg>
        <img src="/logo.png" alt="" className="closari-spinner-logo" />
      </span>
      {label && <span style={{ fontSize: 13, color: '#9CA3AF' }}>{label}</span>}
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Memuat…</span>
    </div>
  )
  if (full) return <div className="closari-loader-full">{node}</div>
  return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 16px' }}>{node}</div>
}

export default BrandLoader
