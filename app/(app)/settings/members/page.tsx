'use client'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'

type Member = { id: string; user_id: string; email: string; display_name: string | null; role: 'admin' | 'agent'; created_at: string; last_sign_in_at: string | null }
type Invite = { id: string; email: string; role: 'admin' | 'agent'; status: string; expires_at: string; created_at: string; token: string }

export default function MembersPage() {
  const [loaded, setLoaded] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentRole, setCurrentRole] = useState('')

  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'agent'>('agent')
  const [submitting, setSubmitting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ link: string } | null>(null)
  const [inviteErr, setInviteErr] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)

  async function load() {
    const res = await authFetch('/api/tenant/members')
    const j = await res.json()
    setMembers(j.members || [])
    setInvites(j.invites || [])
    setCurrentUserId(j.current_user_id || '')
    setCurrentRole(j.current_role || '')
    setLoaded(true)
  }

  useEffect(() => { load() }, [])

  async function sendInvite() {
    setInviteErr(''); setInviteResult(null); setSubmitting(true)
    try {
      const res = await authFetch('/api/tenant/members', { method: 'POST', body: JSON.stringify({ email: inviteEmail, role: inviteRole }) })
      const j = await res.json()
      if (res.ok) {
        setInviteResult({ link: j.invite_link })
        setInviteEmail('')
        await load()
      } else {
        setInviteErr(j.error || 'Gagal kirim invite')
      }
    } finally { setSubmitting(false) }
  }

  async function removeMember(id: string, email: string) {
    if (!confirm(`Hapus ${email} dari workspace?`)) return
    const res = await authFetch(`/api/tenant/members/${id}`, { method: 'DELETE' })
    const j = await res.json()
    if (res.ok) await load()
    else alert(j.error || 'Gagal hapus')
  }

  async function changeRole(id: string, newRole: 'admin' | 'agent') {
    const res = await authFetch(`/api/tenant/members/${id}`, { method: 'PUT', body: JSON.stringify({ role: newRole }) })
    const j = await res.json()
    if (res.ok) await load()
    else alert(j.error || 'Gagal ubah role')
  }

  async function revokeInvite(id: string) {
    if (!confirm('Revoke invite ini? Link tidak bisa dipakai lagi.')) return
    const res = await authFetch(`/api/tenant/invites/${id}`, { method: 'DELETE' })
    if (res.ok) await load()
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  if (!loaded) return <div style={{ fontSize: 13, color: '#9CA3AF' }}>Memuat…</div>

  const isAdmin = currentRole === 'admin'

  return (
    <div>
      {!isAdmin && (
        <div style={{ marginBottom: 20, padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 7, fontSize: 12, color: '#92400E' }}>
          Hanya admin yang bisa undang/hapus anggota tim.
        </div>
      )}

      {/* Header + button invite */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0D0D0D' }}>Anggota ({members.length})</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Kelola anggota tim & undang orang baru.</div>
        </div>
        {isAdmin && !showInviteForm && (
          <button onClick={() => setShowInviteForm(true)} style={btnPrimary(false)}>+ Undang anggota</button>
        )}
      </div>

      {/* Invite form */}
      {showInviteForm && isAdmin && (
        <div style={{ marginBottom: 20, padding: 14, background: '#FAFAFA', border: '1px solid #E5E5E5', borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D', marginBottom: 10 }}>Undang Anggota Baru</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@anggota.com" style={{ ...inputStyle, flex: 1 }} />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as any)} style={{ ...inputStyle, width: 140 }}>
              <option value="agent">Agen</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={sendInvite} disabled={submitting || !inviteEmail} style={btnPrimary(submitting || !inviteEmail)}>
              {submitting ? 'Membuat invite…' : 'Buat invite'}
            </button>
            <button onClick={() => { setShowInviteForm(false); setInviteEmail(''); setInviteErr(''); setInviteResult(null) }} style={btnSecondary}>Batal</button>
          </div>
          {inviteErr && <div style={errBox}>{inviteErr}</div>}
          {inviteResult && (
            <div style={{ marginTop: 12, padding: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 7 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#15803D', marginBottom: 5 }}>✓ Invite berhasil dibuat</div>
              <div style={{ fontSize: 11, color: '#15803D', marginBottom: 8 }}>Bagikan link ini ke anggota baru. Mereka harus klik link dari email tersebut & login dengan email yang diundang.</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={inviteResult.link} readOnly style={{ ...inputStyle, fontSize: 11, fontFamily: 'monospace', background: '#fff' }} onClick={e => (e.target as HTMLInputElement).select()} />
                <button onClick={() => copyLink(inviteResult.link)} style={btnSecondary}>{copiedLink ? '✓ Copied' : 'Copy'}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Members list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {members.map(m => {
          const isMe = m.user_id === currentUserId
          return (
            <div key={m.user_id} style={{ padding: '12px 14px', border: '1px solid #E5E5E5', borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, border: '1px solid #BBF7D0' }}>
                  {(m.display_name || m.email)[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D' }}>
                    {m.display_name || m.email.split('@')[0]}
                    {isMe && <span style={{ marginLeft: 6, fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>(kamu)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{m.email}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isAdmin && !isMe ? (
                  <select value={m.role} onChange={e => changeRole(m.user_id, e.target.value as any)} style={{ padding: '5px 8px', fontSize: 11, border: '1px solid #E5E5E5', borderRadius: 5, background: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}>
                    <option value="admin">Admin</option>
                    <option value="agent">Agen</option>
                  </select>
                ) : (
                  <span style={{ fontSize: 11, padding: '3px 8px', background: m.role === 'admin' ? '#F0FDF4' : '#F7F7F7', color: m.role === 'admin' ? '#15803D' : '#6B7280', borderRadius: 4, fontWeight: 500, border: `1px solid ${m.role === 'admin' ? '#BBF7D0' : '#E5E5E5'}` }}>
                    {m.role === 'admin' ? 'Admin' : 'Agen'}
                  </span>
                )}
                {isAdmin && (
                  <button onClick={() => removeMember(m.user_id, m.email)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 12, padding: '4px 6px', fontFamily: 'inherit' }}>Hapus</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D', marginBottom: 10 }}>Pending Invites ({invites.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {invites.map(inv => {
              const origin = typeof window !== 'undefined' ? window.location.origin : ''
              const link = `${origin}/accept-invite?token=${inv.token}`
              return (
                <div key={inv.id} style={{ padding: '11px 14px', border: '1px solid #FDE68A', background: '#FFFBEB', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D' }}>{inv.email}</div>
                    <div style={{ fontSize: 11, color: '#92400E', marginTop: 2 }}>
                      {inv.role === 'admin' ? 'Admin' : 'Agen'} · expire {new Date(inv.expires_at).toLocaleDateString('id-ID')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => copyLink(link)} style={btnSecondary}>{copiedLink ? '✓' : 'Copy link'}</button>
                    {isAdmin && <button onClick={() => revokeInvite(inv.id)} style={{ ...btnSecondary, color: '#DC2626', borderColor: '#FECACA' }}>Revoke</button>}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = { padding: '9px 12px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, color: '#0D0D0D', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
const btnPrimary = (disabled: boolean): React.CSSProperties => ({ padding: '8px 14px', background: disabled ? '#F0F0F0' : '#0D0D0D', color: disabled ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' })
const btnSecondary: React.CSSProperties = { padding: '7px 12px', background: '#fff', color: '#0D0D0D', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
const errBox: React.CSSProperties = { marginTop: 10, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, fontSize: 12, color: '#B91C1C', lineHeight: 1.5 }
