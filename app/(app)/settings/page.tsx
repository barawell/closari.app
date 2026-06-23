'use client'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'
import Link from 'next/link'

type QuickReply = { id: string; shortcut: string; title: string; body: string }

export default function SettingsPage() {
  const [qrs, setQrs] = useState<QuickReply[]>([])
  const [loaded, setLoaded] = useState(false)

  // New quick reply form
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<QuickReply | null>(null)
  const [form, setForm] = useState({ shortcut: '', title: '', body: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await authFetch('/api/quick-replies')
    const j = await res.json()
    setQrs(j.quick_replies || [])
    setLoaded(true)
  }

  useEffect(() => { load() }, [])

  function startEdit(qr: QuickReply) {
    setEditing(qr)
    setForm({ shortcut: qr.shortcut, title: qr.title, body: qr.body })
    setShowForm(true)
  }

  function startNew() {
    setEditing(null)
    setForm({ shortcut: '', title: '', body: '' })
    setShowForm(true)
  }

  async function submit() {
    if (!form.shortcut || !form.title || !form.body) return
    setSaving(true)
    try {
      if (editing) {
        await authFetch('/api/quick-replies', { method: 'PUT', body: JSON.stringify({ id: editing.id, ...form }) })
      } else {
        await authFetch('/api/quick-replies', { method: 'POST', body: JSON.stringify(form) })
      }
      setShowForm(false)
      await load()
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Hapus quick reply ini?')) return
    await authFetch(`/api/quick-replies?id=${id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0D0D0D', letterSpacing: '-0.02em', marginBottom: 3 }}>Setelan</h1>
        <p style={{ fontSize: 13, color: '#6B7280' }}>Quick Replies untuk balasan cepat di Inbox. Konfigurasi AI ada di <Link href="/halo-ai" style={{ color: '#16A34A', textDecoration: 'none', fontWeight: 500 }}>Halo AI →</Link></p>
      </div>

      {/* Quick Replies Section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0D0D0D', marginBottom: 2 }}>Quick Replies</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>Ketik <code style={{ background: '#F0FDF4', color: '#16A34A', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace', fontSize: 11 }}>/</code> di Inbox untuk akses cepat.</div>
          </div>
          <button onClick={startNew} style={{ padding: '7px 14px', background: '#0D0D0D', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Tambah
          </button>
        </div>

        {loaded && qrs.length === 0 && !showForm && (
          <div style={{ padding: 32, background: '#FAFAFA', border: '1px solid #E5E5E5', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 10 }}>Belum ada quick reply.</div>
            <button onClick={startNew} style={{ padding: '7px 14px', background: '#fff', color: '#0D0D0D', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              Buat yang pertama
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {qrs.map(qr => (
            <div key={qr.id} style={{ padding: '12px 14px', background: '#fff', border: '1px solid #E5E5E5', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ fontSize: 11, padding: '2px 6px', background: '#F0FDF4', color: '#16A34A', borderRadius: 3, fontFamily: 'monospace', border: '1px solid #BBF7D0' }}>/{qr.shortcut}</code>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D' }}>{qr.title}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => startEdit(qr)} style={{ fontSize: 12, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                  <button onClick={() => remove(qr.id)} style={{ fontSize: 12, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Hapus</button>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{qr.body}</div>
            </div>
          ))}
        </div>

        {/* Form */}
        {showForm && (
          <div style={{ marginTop: 16, padding: 16, background: '#FAFAFA', border: '1px solid #E5E5E5', borderRadius: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D', marginBottom: 12 }}>{editing ? 'Edit Quick Reply' : 'Buat Quick Reply Baru'}</div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: '0 0 180px' }}>
                <label style={lbl}>Shortcut</label>
                <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #E5E5E5', borderRadius: 7, padding: '0 11px' }}>
                  <span style={{ fontSize: 13, color: '#9CA3AF', fontFamily: 'monospace' }}>/</span>
                  <input value={form.shortcut} onChange={e => setForm({ ...form, shortcut: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="harga" style={{ ...inp, border: 'none', background: 'transparent', padding: '9px 0' }} />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Judul</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Tanya harga produk" style={inp} />
              </div>
            </div>

            <label style={lbl}>Isi pesan</label>
            <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={5} placeholder="Hi! Untuk info harga, kami punya beberapa paket..." style={{ ...inp, resize: 'vertical', lineHeight: 1.6, marginBottom: 12 }} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={submit} disabled={saving || !form.shortcut || !form.title || !form.body} style={{ padding: '8px 16px', background: saving || !form.shortcut || !form.title || !form.body ? '#F0F0F0' : '#0D0D0D', color: saving || !form.shortcut || !form.title || !form.body ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: saving || !form.shortcut || !form.title || !form.body ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Menyimpan…' : (editing ? 'Simpan perubahan' : 'Tambah')}
              </button>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', background: '#fff', color: '#6B7280', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Batal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: '#374151', marginBottom: 6, fontWeight: 500 }
const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, color: '#0D0D0D', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
