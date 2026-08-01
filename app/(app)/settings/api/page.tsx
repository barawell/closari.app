'use client'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'
import { BrandLoader } from '@/app/Loader'

/* Settings > API — kelola API key untuk integrasi eksternal.

   Buat sistem lain (mis. website daracare.id) mengirim WhatsApp lewat Closari
   secara otomatis. Key ditampilkan PENUH sekali saat dibuat; setelah itu hanya
   prefix yang terlihat. */

type KeyRow = { id: string; nama: string; key_prefix: string; terakhir_dipakai: string | null; dicabut: boolean; created_at: string }

export default function ApiKeysPage() {
  const [loaded, setLoaded] = useState(false)
  const [keys, setKeys] = useState<KeyRow[]>([])
  const [role, setRole] = useState('')
  const [nama, setNama] = useState('')
  const [membuat, setMembuat] = useState(false)
  const [keyBaru, setKeyBaru] = useState<string | null>(null)
  const [tersalin, setTersalin] = useState(false)
  const [err, setErr] = useState('')

  const isAdmin = role === 'owner' || role === 'admin'

  async function load() {
    const [kRes, meRes] = await Promise.all([authFetch('/api/tenant/api-keys'), authFetch('/api/me')])
    const kJ = await kRes.json().catch(() => ({}))
    const meJ = await meRes.json().catch(() => ({}))
    setKeys(kJ.keys || [])
    setRole(meJ.role || '')
    setLoaded(true)
  }
  useEffect(() => { load() }, [])

  async function buat() {
    setErr(''); setMembuat(true); setKeyBaru(null)
    try {
      const res = await authFetch('/api/tenant/api-keys', { method: 'POST', body: JSON.stringify({ nama }) })
      const j = await res.json()
      if (res.ok && j.key) { setKeyBaru(j.key); setNama(''); await load() }
      else setErr(j.error || 'Gagal membuat key.')
    } finally { setMembuat(false) }
  }

  async function cabut(id: string) {
    if (!confirm('Cabut API key ini? Sistem yang memakainya akan langsung berhenti bisa mengirim.')) return
    setErr('')
    const res = await authFetch(`/api/tenant/api-keys?id=${id}`, { method: 'DELETE' })
    if (res.ok) await load()
    else { const j = await res.json().catch(() => ({})); setErr(j.error || 'Gagal mencabut.') }
  }

  function salin() {
    if (!keyBaru) return
    navigator.clipboard?.writeText(keyBaru).then(() => { setTersalin(true); setTimeout(() => setTersalin(false), 2000) })
  }

  if (!loaded) return <BrandLoader />

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, color: '#0D0D0D', margin: '0 0 4px' }}>API Key</h1>
      <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px', lineHeight: 1.6 }}>
        Untuk sistem lain mengirim WhatsApp lewat Closari secara otomatis — misalnya website mengejar
        keranjang tertinggal. Key mewakili workspace ini; pesan terkirim dari nomor WhatsApp workspace ini.
      </p>

      {/* Key baru — tampil sekali */}
      {keyBaru && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 9, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 8 }}>
            Key baru dibuat — salin sekarang, tidak akan ditampilkan lagi.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ flex: 1, padding: '9px 12px', background: '#fff', border: '1px solid #BBF7D0', borderRadius: 7, fontSize: 12, color: '#0D0D0D', wordBreak: 'break-all', fontFamily: 'monospace' }}>{keyBaru}</code>
            <button onClick={salin} style={btnPrimary(false)}>{tersalin ? 'Tersalin ✓' : 'Salin'}</button>
          </div>
        </div>
      )}

      {/* Buat key */}
      {isAdmin && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D', marginBottom: 10 }}>Buat API key baru</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={nama} onChange={e => setNama(e.target.value.slice(0, 80))} placeholder="Nama (mis. Dara abandoned cart)" style={inputStyle} />
            <button onClick={buat} disabled={membuat} style={btnPrimary(membuat)}>{membuat ? 'Membuat…' : 'Buat'}</button>
          </div>
        </div>
      )}

      {/* Daftar key */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D', marginBottom: 12 }}>Key aktif</div>
        {keys.length === 0 ? (
          <div style={{ fontSize: 13, color: '#9CA3AF' }}>Belum ada API key.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {keys.map(k => (
              <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid #F0F0F0', borderRadius: 7, opacity: k.dicabut ? 0.5 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#0D0D0D', fontWeight: 500 }}>{k.nama}</div>
                  <div style={{ fontSize: 11.5, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 2 }}>
                    {k.key_prefix}••••{k.dicabut ? ' · dicabut' : ''}
                    {k.terakhir_dipakai ? ` · dipakai ${new Date(k.terakhir_dipakai).toLocaleDateString('id-ID')}` : ' · belum dipakai'}
                  </div>
                </div>
                {isAdmin && !k.dicabut && (
                  <button onClick={() => cabut(k.id)} style={{ ...btnSecondary, color: '#DC2626', borderColor: '#FECACA' }}>Cabut</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {err && <div style={errBox}>{err}</div>}

      {/* Petunjuk pakai */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D', marginBottom: 8 }}>Cara pakai</div>
        <pre style={{ fontSize: 11.5, color: '#374151', background: '#F9FAFB', padding: 12, borderRadius: 7, overflowX: 'auto', lineHeight: 1.6, margin: 0 }}>{`POST https://<domain-closari>/api/external/send
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "to": "628xxxxxxxxxx",
  "mode": "template",
  "template_name": "keranjang_tertinggal",
  "language": "id",
  "params": ["Budi", "Program Berat Badan", "Rp3.100.000"]
}`}</pre>
        <p style={{ fontSize: 11.5, color: '#9CA3AF', margin: '8px 0 0', lineHeight: 1.6 }}>
          Untuk menjangkau nomor yang belum pernah chat, pakai mode <b>template</b> (template harus sudah
          disetujui Meta). Mode <b>text</b> hanya untuk nomor yang chat dalam 24 jam terakhir.
        </p>
      </div>
    </div>
  )
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E5E5', borderRadius: 9, padding: 16 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, color: '#0D0D0D', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
const btnPrimary = (disabled: boolean): React.CSSProperties => ({ padding: '9px 16px', background: disabled ? '#F0F0F0' : '#0D0D0D', color: disabled ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })
const btnSecondary: React.CSSProperties = { padding: '8px 14px', background: '#fff', color: '#0D0D0D', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
const errBox: React.CSSProperties = { marginTop: 12, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, fontSize: 12, color: '#B91C1C', lineHeight: 1.5 }
