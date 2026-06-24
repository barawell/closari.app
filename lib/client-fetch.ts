'use client'
import { supabase } from './supabase'

// Tenant aktif disimpan di localStorage (per-browser). Dikirim sbg x-tenant-id.
const TENANT_KEY = 'closari_tenant'

export function getActiveTenant(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(TENANT_KEY) } catch { return null }
}
export function setActiveTenant(id: string) {
  try { localStorage.setItem(TENANT_KEY, id) } catch { /* ignore */ }
}
export function clearActiveTenant() {
  try { localStorage.removeItem(TENANT_KEY) } catch { /* ignore */ }
}

// Fetch dgn Authorization: Bearer <token> + x-tenant-id (workspace aktif).
export async function authFetch(path: string, opts: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(opts.headers)
  headers.set('Authorization', `Bearer ${session?.access_token || ''}`)

  const tid = getActiveTenant()
  if (tid) headers.set('x-tenant-id', tid)

  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData
  if (opts.body && !isForm && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (isForm) headers.delete('Content-Type')

  return fetch(path, { ...opts, headers })
}
