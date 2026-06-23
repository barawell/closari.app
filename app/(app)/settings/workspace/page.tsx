'use client'
import { useEffect, useState, useRef } from 'react'
import { authFetch } from '@/lib/client-fetch'
import { supabase } from '@/lib/supabase'

export default function WorkspacePage() {
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [origName, setOrigName] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [role, setRole] = useState('')

  const [savingName, setSavingName] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [err, setErr] = useState('')

  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoErr, setLogoErr] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const [tenantRes, meRes] = await Promise.all([
      authFetch('/api/tenant'),
      authFetch('/api/me'),
    ])
    const tenantJ = await tenantRes.json()
    const meJ = await meRes.json()
    setName(tenantJ.tenant?.name || '')
    setOrigName(tenantJ.tenant?.name || '')
    setLogoUrl(tenantJ.tenant?.logo_url || null)
    setRole(meJ.role || '')
    setLoaded(true)
  }

  useEffect(() => { load() }, [])

  async function saveName() {
    setErr(''); setSavingName(true)
    try {
      const res = await authFetch('/api/tenant', { method: 'PUT', body: JSON.stringify({ name }) })
      const j = await res.json()
      if (res.ok) {
        setOrigName(name)
        setSavedAt(Date.now())
      } else {
        setErr(j.error || 'Gagal simpan')
      }
    } finally { setSavingName(false) }
  }

  async function uploadLogo(file: File) {
    setLogoErr(''); setUploadingLogo(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLogoErr('Sesi habis, login lagi.'); return }

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/tenant/logo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })
      const j = await res.json()
      if (res.ok) {
        setLogoUrl(j.logo_url)
      } else {
        setLogoErr(j.error || 'Gagal upload')
      }
    } catch (e: any) {
      setLogoErr(e?.message || 'Gagal upload')
    } finally { setUploadingLogo(false) }
  }

  async function removeLogo() {
    if (!confirm('Hapus logo workspace?')) return
    setUploadingLogo(true)
    try {
      const res = await authFetch('/api/tenant/logo', { method: 'DELETE' })
      if (res.ok) setLogoUrl(null)
    } finally { setUploadingLogo(false) }
  }

  if (!loaded) return <div style={{ fontSize: 13, color: '#9CA3AF' }}>Memuat…</div>

  const isAdmin = role === 'admin'

  return (
    <div>
      {!isAdmin && (
        <div style={{ marginBottom: 20, padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 7, fontSize: 12, color: '#92400E' }}>
          Kamu adalah <strong>agen</strong>. Hanya admin yang bisa edit workspace settings.
        </div>
      )}

      {/* Nama workspace */}
      <Section title="Nama Workspace" description="Nama ini ditampilkan di sidebar dan dilihat oleh anggota tim.">
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <input value={name} onChange={e => setName(e.target.value.slice(0, 80))} disabled={!isAdmin} placeholder="Nama workspace" style={inputStyle} />
          </div>
          {isAdmin && (
            <button onClick={saveName} disabled={savingName || name === origName || !name.trim()} style={btnPrimary(savingName || name === origName || !name.trim())}>
              {savingName ? 'Menyimpan…' : 'Simpan'}
            </button>
          )}
        </div>
        {savedAt && Date.now() - savedAt < 3000 && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#16A34A' }}>✓ Tersimpan. Refresh halaman untuk lihat perubahan di sidebar.</div>
        )}
        {err && <div style={errBox}>{err}</div>}
      </Section>

      {/* Logo */}
      <Section title="Logo Workspace" description="Logo akan muncul di sidebar dan landing page invite. Ukuran max 2 MB. Format: PNG, JPG, WEBP, SVG.">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Preview */}
          <div style={{ width: 80, height: 80, borderRadius: 12, background: '#F7F7F7', border: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>No logo</div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            {isAdmin && (
              <>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }} style={{ display: 'none' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo} style={btnSecondary}>
                    {uploadingLogo ? 'Mengupload…' : (logoUrl ? 'Ganti logo' : 'Upload logo')}
                  </button>
                  {logoUrl && <button onClick={removeLogo} disabled={uploadingLogo} style={{ ...btnSecondary, color: '#DC2626', borderColor: '#FECACA' }}>Hapus</button>}
                </div>
                {logoErr && <div style={errBox}>{logoErr}</div>}
              </>
            )}
          </div>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid #F0F0F0' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#0D0D0D', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12, lineHeight: 1.5 }}>{description}</div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, color: '#0D0D0D', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
const btnPrimary = (disabled: boolean): React.CSSProperties => ({ padding: '9px 16px', background: disabled ? '#F0F0F0' : '#0D0D0D', color: disabled ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' })
const btnSecondary: React.CSSProperties = { padding: '8px 14px', background: '#fff', color: '#0D0D0D', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
const errBox: React.CSSProperties = { marginTop: 10, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, fontSize: 12, color: '#B91C1C', lineHeight: 1.5 }
