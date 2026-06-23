'use client'
import { supabase } from './supabase'

// Fetch dgn Authorization: Bearer <token> otomatis (token selalu fresh).
// PENTING: untuk FormData (upload file), JANGAN set Content-Type manual —
// browser harus set sendiri "multipart/form-data; boundary=...".
export async function authFetch(path: string, opts: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(opts.headers)
  headers.set('Authorization', `Bearer ${session?.access_token || ''}`)

  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData
  if (opts.body && !isForm && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  // Kalau FormData, pastikan Content-Type TIDAK ada (browser yang isi).
  if (isForm) headers.delete('Content-Type')

  return fetch(path, { ...opts, headers })
}
