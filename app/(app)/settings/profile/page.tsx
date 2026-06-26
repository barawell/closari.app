'use client'
import { useEffect, useState, useRef } from 'react'
import { authFetch } from '@/lib/client-fetch'
import { BrandLoader } from '@/app/Loader'

export default function ProfilePage() {
  const [loaded, setLoaded] = useState(false)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [origDisplayName, setOrigDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [role, setRole] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarErr, setAvatarErr] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Change email
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailMsg, setEmailMsg] = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [submittingEmail, setSubmittingEmail] = useState(false)

  // Change password
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordErr, setPasswordErr] = useState('')
  const [submittingPwd, setSubmittingPwd] = useState(false)

  async function load() {
    const res = await authFetch('/api/me')
    const j = await res.json()
    setEmail(j.email || '')
    setDisplayName(j.displayName || '')
    setOrigDisplayName(j.displayName || '')
    setAvatarUrl(j.avatarUrl || null)
    setRole(j.role || '')
    setLoaded(true)
  }

  useEffect(() => { load() }, [])

  async function saveName() {
    setSaving(true)
    try {
      const res = await authFetch('/api/me', { method: 'PUT', body: JSON.stringify({ display_name: displayName }) })
      if (res.ok) {
        setOrigDisplayName(displayName)
        setSavedAt(Date.now())
      }
    } finally { setSaving(false) }
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarErr(''); setUploadingAvatar(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await authFetch('/api/me/profile-photo', { method: 'POST', body: fd })
      const j = await res.json()
      if (res.ok) setAvatarUrl(j.avatar_url)
      else setAvatarErr(j.error || 'Gagal upload foto')
    } catch {
      setAvatarErr('Gagal upload foto')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function removeAvatar() {
    setAvatarErr(''); setUploadingAvatar(true)
    try {
      const res = await authFetch('/api/me/profile-photo', { method: 'DELETE' })
      if (res.ok) setAvatarUrl(null)
      else setAvatarErr('Gagal hapus foto')
    } finally { setUploadingAvatar(false) }
  }

  async function requestEmailChange() {
    setEmailMsg(''); setEmailErr(''); setSubmittingEmail(true)
    try {
      const res = await authFetch('/api/me/change-email', { method: 'POST', body: JSON.stringify({ email: newEmail }) })
      const j = await res.json()
      if (res.ok) {
        setEmailMsg(j.message || 'Link verifikasi sudah dikirim ke email baru.')
        setNewEmail('')
        setShowEmailForm(false)
      } else {
        setEmailErr(j.error || 'Gagal request perubahan email')
      }
    } finally { setSubmittingEmail(false) }
  }

  async function requestPasswordReset() {
    setPasswordMsg(''); setPasswordErr(''); setSubmittingPwd(true)
    try {
      const res = await authFetch('/api/me/change-password', { method: 'POST' })
      const j = await res.json()
      if (res.ok) {
        setPasswordMsg(j.message || 'Link reset password sudah dikirim ke email kamu.')
      } else {
        setPasswordErr(j.error || 'Gagal request reset password')
      }
    } finally { setSubmittingPwd(false) }
  }

  if (!loaded) return <BrandLoader full />

  const initial = (displayName || email || '?')[0].toUpperCase()

  return (
    <div>
      {/* Foto Profil — semua member boleh ganti fotonya sendiri */}
      <Section title="Foto Profil" description="Foto yang dilihat anggota tim. Kamu bisa ganti foto kamu sendiri.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#F0F0F0', border: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 28, fontWeight: 600, color: '#6B7280' }}>{initial}</span>}
          </div>
          <div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar} style={btnPrimary(uploadingAvatar)}>
                {uploadingAvatar ? 'Mengunggah…' : avatarUrl ? 'Ganti foto' : 'Unggah foto'}
              </button>
              {avatarUrl && (
                <button onClick={removeAvatar} disabled={uploadingAvatar} style={btnSecondary}>Hapus</button>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>PNG, JPG, atau WEBP. Maks 2 MB.</div>
            {avatarErr && <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 6 }}>{avatarErr}</div>}
          </div>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onPickAvatar} style={{ display: 'none' }} />
        </div>
      </Section>

      {/* Display Name */}
      <Section title="Nama Tampilan" description="Nama yang dilihat anggota tim lain di workspace.">
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <input value={displayName} onChange={e => setDisplayName(e.target.value.slice(0, 80))} placeholder="Contoh: Budi Santoso"
              style={inputStyle} maxLength={80} />
          </div>
          <button onClick={saveName} disabled={saving || displayName === origDisplayName}
            style={btnPrimary(saving || displayName === origDisplayName)}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
        {savedAt && Date.now() - savedAt < 3000 && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#16A34A' }}>✓ Tersimpan</div>
        )}
      </Section>

      {/* Email */}
      <Section title="Email Login" description="Email yang dipakai untuk login. Mengganti email butuh verifikasi.">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#F7F7F7', border: '1px solid #E5E5E5', borderRadius: 7 }}>
          <div style={{ fontSize: 13, color: '#0D0D0D', fontWeight: 500 }}>{email}</div>
          {!showEmailForm && (
            <button onClick={() => setShowEmailForm(true)} style={btnSecondary}>Ganti email</button>
          )}
        </div>
        {showEmailForm && (
          <div style={{ marginTop: 10, padding: 12, background: '#FAFAFA', border: '1px solid #E5E5E5', borderRadius: 7 }}>
            <label style={labelStyle}>Email baru</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@baru.com" style={inputStyle} />
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, marginBottom: 10 }}>
              Setelah klik tombol, link verifikasi akan dikirim ke email baru. Email lama tetap aktif sampai kamu klik link verifikasi.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={requestEmailChange} disabled={submittingEmail || !newEmail} style={btnPrimary(submittingEmail || !newEmail)}>
                {submittingEmail ? 'Mengirim…' : 'Kirim link verifikasi'}
              </button>
              <button onClick={() => { setShowEmailForm(false); setNewEmail(''); setEmailErr('') }} style={btnSecondary}>Batal</button>
            </div>
          </div>
        )}
        {emailMsg && <div style={successBox}>{emailMsg}</div>}
        {emailErr && <div style={errBox}>{emailErr}</div>}
      </Section>

      {/* Password */}
      <Section title="Password" description="Untuk ganti password, kami akan kirim link reset ke email login kamu.">
        <button onClick={requestPasswordReset} disabled={submittingPwd} style={btnSecondary}>
          {submittingPwd ? 'Mengirim…' : 'Kirim link reset password'}
        </button>
        {passwordMsg && <div style={successBox}>{passwordMsg}</div>}
        {passwordErr && <div style={errBox}>{passwordErr}</div>}
      </Section>

      {/* Role */}
      <Section title="Role" description="Role kamu di workspace ini. Hanya admin yang bisa ubah role.">
        <div style={{ display: 'inline-block', padding: '5px 12px', background: role === 'admin' ? '#F0FDF4' : '#F7F7F7', border: `1px solid ${role === 'admin' ? '#BBF7D0' : '#E5E5E5'}`, borderRadius: 5, fontSize: 12, fontWeight: 500, color: role === 'admin' ? '#15803D' : '#6B7280' }}>
          {role === 'admin' ? 'Admin' : role === 'agent' ? 'Agen' : 'Unknown'}
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

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: '#374151', marginBottom: 6, fontWeight: 500 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, color: '#0D0D0D', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
const btnPrimary = (disabled: boolean): React.CSSProperties => ({ padding: '9px 16px', background: disabled ? '#F0F0F0' : '#0D0D0D', color: disabled ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' })
const btnSecondary: React.CSSProperties = { padding: '8px 14px', background: '#fff', color: '#0D0D0D', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
const successBox: React.CSSProperties = { marginTop: 10, padding: '8px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 7, fontSize: 12, color: '#15803D', lineHeight: 1.5 }
const errBox: React.CSSProperties = { marginTop: 10, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, fontSize: 12, color: '#B91C1C', lineHeight: 1.5 }
