'use client'
import { useState } from 'react'
import { authFetch } from '@/lib/client-fetch'

const EXPORTS = [
  { type: 'segmentation', label: 'Segmentasi Customer', desc: 'Kontak lengkap + aktivitas chat & performa broadcast per orang. Paling pas buat segmentasi.', file: 'segmentasi_customer.xlsx', star: true },
  { type: 'contacts', label: 'Kontak (mentah)', desc: 'Semua kontak apa adanya (nama, nomor, tag, opt-out, order, dll).', file: 'kontak.xlsx' },
  { type: 'conversations', label: 'Percakapan', desc: 'Semua percakapan di inbox.', file: 'percakapan.xlsx' },
  { type: 'messages', label: 'Pesan', desc: 'Semua pesan masuk & keluar. Bisa besar kalau riwayat banyak.', file: 'pesan.xlsx' },
  { type: 'campaigns', label: 'Campaign Broadcast', desc: 'Semua campaign broadcast yang pernah dibuat.', file: 'campaign_broadcast.xlsx' },
  { type: 'recipients', label: 'Hasil Broadcast (per penerima)', desc: 'Status kirim tiap penerima di semua broadcast (terkirim/dibaca/gagal + alasan).', file: 'broadcast_penerima.xlsx' },
]

export default function ExportPage() {
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function download(type: string, file: string) {
    if (busy) return
    setBusy(type); setErr(null)
    try {
      const res = await authFetch(`/api/export?type=${type}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setErr(j.error || `Gagal export (${res.status})`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setErr(e?.message || 'Gagal export')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0D0D0D', marginBottom: 4 }}>Export Data</div>
        <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>Unduh data workspace ini dalam format Excel (.xlsx), siap dibuka di Excel/Google Sheets. Data otomatis hanya dari workspace yang sedang aktif.</div>
      </div>

      {err && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12, borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>{err}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {EXPORTS.map(x => (
          <div key={x.type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: '#fff', border: `1px solid ${x.star ? '#BBF7D0' : '#E5E5E5'}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D', display: 'flex', alignItems: 'center', gap: 7 }}>
                {x.label}
                {x.star && <span style={{ fontSize: 10, fontWeight: 700, color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '1px 7px', borderRadius: 999 }}>REKOMENDASI</span>}
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3, lineHeight: 1.5 }}>{x.desc}</div>
            </div>
            <button
              onClick={() => download(x.type, x.file)}
              disabled={busy === x.type}
              style={{ flexShrink: 0, padding: '9px 16px', background: '#0D0D0D', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: busy ? 'default' : 'pointer', opacity: busy && busy !== x.type ? 0.5 : 1, fontFamily: 'inherit' }}
            >
              {busy === x.type ? 'Menyiapkan…' : '⬇ Download Excel'}
            </button>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: '#B0B0B0', marginTop: 16, lineHeight: 1.6 }}>
        Catatan: hanya admin/owner workspace yang bisa export. Untuk riwayat pesan yang sangat besar, export bisa butuh beberapa detik.
      </div>
    </div>
  )
}
