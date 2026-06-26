'use client'
import { useEffect } from 'react'

// Bersihkan service worker & cache lama (PWA dimatikan sementara biar gak nyajiin versi basi).
export default function SWRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations()
          .then((regs) => regs.forEach((r) => r.unregister()))
          .catch(() => {})
      }
      if (typeof caches !== 'undefined') {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {})
      }
    } catch {}
  }, [])
  return null
}
