'use client'
import { supabase } from './supabase'

// Fetch dgn Authorization: Bearer <token> otomatis (token selalu fresh).
export async function authFetch(path: string, opts: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(opts.headers)
  headers.set('Authorization', `Bearer ${session?.access_token || ''}`)
  if (opts.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(path, { ...opts, headers })
}
