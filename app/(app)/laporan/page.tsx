'use client'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'
import { BrandLoader } from '@/app/Loader'

type Campaign = { id: string; template_name?: string | null; body?: string; sent: number; failed: number; total: number; status: string; created_at: string; reject_reason?: string | null }
type Recipient = { name?: string | null; phone: string; status: string; error?: string | null; sent_at?: string | null }

function fmtDate(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}
function statusLabel(s: string) {
  return s === 'read' ? 'Dibaca' : s === 'delivered' ? 'Sampai' : s === 'sent' ? 'Terkirim' : s === 'failed' ? 'Gagal' : s
}
function statusStyle(s: string): React.CSSProperties {
  if (s === 'failed') return { color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA' }
  if (s === 'read') return { color: '#1D4ED8', background: '#EFF6FF', border: '1px solid #BFDBFE' }
  if (s === 'delivered') return { color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0' }
  return { color: '#6B7280', background: '#F3F4F6', border: '1px solid #E5E7EB' }
}

export default function LaporanPage() {
  const [loaded, setLoaded] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [detail, setDetail] = useState<{ campaign: Campaign; recipients: Recipient[] } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'failed' | 'read'>('all')
  const [exporting, setExporting] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    const res = await authFetch('/api/broadcast/history')
    const j = await res.json()
    setCampaigns((j.campaigns || []).filter((c: Campaign) => c.status !== 'pending_approval'))
    setLoaded(true)
  }
  async function openDetail(id: string) {
    setDetailLoading(true); setDetail(null); setFilter('all')
    try {
      const res = await authFetch(`/api/broadcast/history?id=${id}`)
      const j = await res.json()
      if (j.campaign) setDetail({ campaign: j.campaign, recipients: j.recipients || [] })
    } finally { setDetailLoading(false) }
  }
  async function exportExcel() {
    if (!detail || exporting) return
    setExporting(true)
    try {
      const res = await authFetch(`/api/export?type=broadcast_report&campaign=${detail.campaign.id}`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'laporan_broadcast.xlsx'
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  if (!loaded) return <BrandLoader full />

  const rc = detail?.recipients || []
  const cFailed = rc.filter(r => r.status === 'failed').length
  const cRead = rc.filter(r => r.status === 'read').length
  const shown = filter === 'all' ? rc : filter === 'failed' ? rc.filter(r => r.status === 'failed') : rc.filter(r => r.status === 'read')

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      <div style={{ padding: 'clamp(18px,5vw,24px) clamp(16px,5vw,32px)', maxWidth: 900 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0D0D0D', letterSpacing: '-0.02em', margin: 0, marginBottom: 4 }}>Laporan</h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: 0, marginBottom: 18 }}>Status pengiriman broadcast per penerima — terkirim, dibaca, atau gagal beserta alasannya.</p>

        {detailLoading ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>Memuat laporan…</div>
        ) : detail ? (
          <div>
            <button onClick={() => setDetail(null)} style={{ ...btnGhost, fontSize: 12, padding: '6px 12px', marginBottom: 12 }}>← Kembali ke daftar</button>
            <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D', minWidth: 0 }}>{detail.campaign.template_name ? `Template: ${detail.campaign.template_name}` : (detail.campaign.body || 'Broadcast')}</div>
                  <button onClick={exportExcel} disabled={exporting} style={{ ...btnGhost, fontSize: 12, padding: '6px 12px', flexShrink: 0 }}>{exporting ? 'Menyiapkan…' : '⬇ Export Excel'}</button>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: '#15803D', fontWeight: 600 }}>✓ {detail.campaign.sent} terkirim</span>
                  {cRead > 0 && <span style={{ color: '#1D4ED8', fontWeight: 600 }}>👁 {cRead} dibaca</span>}
                  {detail.campaign.failed > 0 && <span style={{ color: '#DC2626', fontWeight: 600 }}>✕ {detail.campaign.failed} gagal</span>}
                  <span style={{ color: '#9CA3AF' }}>dari {detail.campaign.total}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: '1px solid #F0F0F0', flexWrap: 'wrap' }}>
                {[{ k: 'all', l: `Semua (${rc.length})` }, { k: 'failed', l: `Gagal (${cFailed})` }, { k: 'read', l: `Dibaca (${cRead})` }].map(f => (
                  <button key={f.k} onClick={() => setFilter(f.k as any)} style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${filter === f.k ? '#16A34A' : '#E5E5E5'}`, background: filter === f.k ? '#F0FDF4' : '#fff', color: filter === f.k ? '#15803D' : '#6B7280' }}>{f.l}</button>
                ))}
              </div>
              <div>
                {shown.length === 0 ? (
                  <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: 12, color: '#9CA3AF' }}>Tidak ada data.</div>
                ) : shown.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderBottom: '1px solid #F4F4F4' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || '—'}</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF' }}>{r.phone}</div>
                      {r.status === 'failed' && r.error && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3, lineHeight: 1.4 }}>{r.error}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ ...statusStyle(r.status), fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, display: 'inline-block' }}>{statusLabel(r.status)}</span>
                      <div style={{ fontSize: 10, color: '#B0B0B0', marginTop: 3 }}>{r.sent_at ? fmtDate(r.sent_at) : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : campaigns.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 13, color: '#9CA3AF', background: '#FAFAFA', borderRadius: 10, border: '1px solid #F0F0F0' }}>Belum ada broadcast.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {campaigns.map(c => (
              <div key={c.id} onClick={() => openDetail(c.id)} style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, padding: '14px 16px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, color: '#0D0D0D', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 12 }}>{c.template_name ? `Template: ${c.template_name}` : c.body}</div>
                  <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{fmtDate(c.created_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, alignItems: 'center' }}>
                  {c.status === 'rejected'
                    ? <span style={{ color: '#DC2626', fontWeight: 600 }}>✕ Ditolak{c.reject_reason ? ` · ${c.reject_reason}` : ''}</span>
                    : <><span style={{ color: '#15803D', fontWeight: 600 }}>✓ {c.sent} terkirim</span>{c.failed > 0 && <span style={{ color: '#DC2626', fontWeight: 600 }}>✕ {c.failed} gagal</span>}<span style={{ color: '#9CA3AF' }}>dari {c.total}</span></>}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: '#16A34A', fontWeight: 500, flexShrink: 0 }}>Lihat laporan →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const btnGhost: React.CSSProperties = { padding: '9px 16px', background: '#fff', color: '#6B7280', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
