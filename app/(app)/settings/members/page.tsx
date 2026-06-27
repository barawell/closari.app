'use client'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'
import { BrandLoader } from '@/app/Loader'

type Member = { user_id: string; email: string; role: string; display_name?: string }
type Invite = { id: string; email: string; role: string; created_at: string }

const roleBadge: Record<string, { c: string; bg: string; b: string }> = {
  owner: { c: '#92400E', bg: '#FFFBEB', b: '#FDE68A' },
  admin: { c: '#15803D', bg: '#F0FDF4', b: '#BBF7D0' },
  agent: { c: '#6D28D9', bg: '#F5F3FF', b: '#DDD6FE' },
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [meId, setMeId] = useState('')
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(false)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState('agent')
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res = await authFetch('/api/team')
    const j = await res.json()
    setMembers(j.members || [])
    setInvites(j.invites || [])
    setMeId(j.me?.userId || '')
    setCanManage(!!j.can_manage)
    setLoading(false)
  }

  async function invite() {
    if (!email.includes('@')) { alert('Email tidak valid'); return }
    setBusy(true)
    try {
      const res = await authFetch('/api/team', { method: 'POST', body: JSON.stringify({ email, role }) })
      const j = await res.json()
      if (!res.ok) { alert(j.error || 'Gagal'); return }
      setEmail(''); load()
      alert(`Email undangan dikirim ke ${email}. Mereka akan dapat link untuk set password & langsung masuk ke workspace.`)
    } finally { setBusy(false) }
  }

  async function changeRole(m: Member, newRole: string) {
    const res = await authFetch(`/api/team/${m.user_id}`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) })
    if (!res.ok) { const j = await res.json(); alert(j.error || 'Gagal'); return }
    load()
  }
  async function removeMember(m: Member) {
    if (!confirm(`Keluarkan ${m.email} dari workspace?`)) return
    const res = await authFetch(`/api/team/${m.user_id}?type=member`, { method: 'DELETE' })
    if (!res.ok) { const j = await res.json(); alert(j.error || 'Gagal'); return }
    load()
  }
  async function cancelInvite(inv: Invite) {
    const res = await authFetch(`/api/team/${inv.id}?type=invite`, { method: 'DELETE' })
    if (!res.ok) { const j = await res.json(); alert(j.error || 'Gagal'); return }
    load()
  }

  return (
    <div style={{ padding: 'clamp(18px,5vw,32px) clamp(14px,5vw,36px)', maxWidth: 720 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0D0D0D', letterSpacing: '-0.02em', marginBottom: 3 }}>Anggota Tim</h1>
        <p style={{ fontSize: 13, color: '#6B7280' }}>Undang anggota & atur peran. Admin bisa kelola broadcast & setelan; agent hanya balas chat.</p>
      </div>

      {canManage && (
        <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0D0D0D', marginBottom: 12 }}>Undang anggota</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@contoh.com" style={{ ...inp, flex: 1 }} />
            <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inp, maxWidth: 140 }}>
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
            <button onClick={invite} disabled={busy} style={{ padding: '9px 18px', background: busy ? '#F0F0F0' : '#16A34A', color: busy ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{busy ? 'Mengundang…' : 'Undang'}</button>
          </div>
        </div>
      )}

      {loading ? <BrandLoader /> : (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.03em', marginBottom: 8 }}>ANGGOTA ({members.length})</div>
          <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            {members.map((m, i) => {
              const bg = roleBadge[m.role] || roleBadge.agent
              return (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < members.length - 1 ? '1px solid #F7F7F7' : 'none' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, border: '1px solid #BBF7D0', flexShrink: 0 }}>{(m.display_name || m.email || '?')[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D' }}>{m.display_name || m.email.split('@')[0]}{m.user_id === meId && <span style={{ color: '#9CA3AF', fontWeight: 400 }}> · kamu</span>}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>{m.email}</div>
                  </div>
                  {canManage && m.user_id !== meId && m.role !== 'owner' ? (
                    <select value={m.role} onChange={e => changeRole(m, e.target.value)} style={{ ...inp, width: 110, padding: '5px 8px', fontSize: 12 }}>
                      <option value="agent">Agent</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 600, color: bg.c, background: bg.bg, border: `1px solid ${bg.b}`, padding: '2px 9px', borderRadius: 999, textTransform: 'capitalize' }}>{m.role}</span>
                  )}
                  {canManage && m.user_id !== meId && m.role !== 'owner' && (
                    <button onClick={() => removeMember(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 12, fontFamily: 'inherit' }}>Keluarkan</button>
                  )}
                </div>
              )
            })}
          </div>

          {invites.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.03em', marginBottom: 8 }}>UNDANGAN PENDING ({invites.length})</div>
              <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, overflow: 'hidden' }}>
                {invites.map((inv, i) => (
                  <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < invites.length - 1 ? '1px solid #F7F7F7' : 'none' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#0D0D0D' }}>{inv.email}</div>
                      <div style={{ fontSize: 11, color: '#B45309' }}>Email dikirim · menunggu diterima · role {inv.role}</div>
                    </div>
                    {canManage && <button onClick={() => cancelInvite(inv)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 12, fontFamily: 'inherit' }}>Batalkan</button>}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

const inp: React.CSSProperties = { padding: '9px 11px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, color: '#0D0D0D', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
