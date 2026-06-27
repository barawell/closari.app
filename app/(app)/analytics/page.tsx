'use client'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'

type MsgDay = { date: string; in: number; out: number }
type Campaign = { id: string; body: string; status: string; sent: number; failed: number; total: number; created_at: string }
type DeliveryStats = { sent: number; failed: number; delivered: number; read: number; totalSent: number; deliveryRate: number; readRate: number }
type ContactStats = { total: number; optout: number; new7d: number }
type WebhookHealth = { lastWebhookAt: string | null; healthy: boolean; phone: string | null; label: string | null }

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [msgChart, setMsgChart] = useState<MsgDay[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [delivery, setDelivery] = useState<DeliveryStats>({ sent: 0, failed: 0, delivered: 0, read: 0, totalSent: 0, deliveryRate: 0, readRate: 0 })
  const [contacts, setContacts] = useState<ContactStats>({ total: 0, optout: 0, new7d: 0 })
  const [webhook, setWebhook] = useState<WebhookHealth>({ lastWebhookAt: null, healthy: false, phone: null, label: null })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res = await authFetch('/api/analytics')
    const j = await res.json()
    setMsgChart(j.msgChart || [])
    setCampaigns(j.campaigns || [])
    setDelivery(j.delivery || delivery)
    setContacts(j.contacts || contacts)
    setWebhook(j.webhook || webhook)
    setLoading(false)
  }

  // Simple bar chart using SVG
  const maxVal = Math.max(...msgChart.map(d => Math.max(d.in, d.out)), 1)
  const chartH = 80
  const barW = msgChart.length > 0 ? Math.min(24, Math.floor(560 / msgChart.length / 2) - 2) : 16

  function timeAgo(iso: string | null) {
    if (!iso) return 'Belum pernah'
    const diff = Date.now() - new Date(iso).getTime()
    const min = Math.floor(diff / 60000)
    if (min < 1) return 'Baru saja'
    if (min < 60) return `${min} menit lalu`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr} jam lalu`
    return `${Math.floor(hr / 24)} hari lalu`
  }

  if (loading) return <div style={{ padding: 40, fontSize: 13, color: '#9CA3AF' }}>Memuat analytics…</div>

  return (
    <div style={{ padding: 'clamp(18px,5vw,32px) clamp(14px,5vw,36px)', maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0D0D0D', letterSpacing: '-0.02em', marginBottom: 3 }}>Analytics</h1>
        <p style={{ fontSize: 13, color: '#6B7280' }}>Performa pesan, broadcast, dan kesehatan sistem — 7 & 30 hari terakhir.</p>
      </div>

      {/* Webhook health */}
      <div style={{ background: webhook.healthy ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${webhook.healthy ? '#BBF7D0' : '#FECACA'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: webhook.healthy ? '#16A34A' : '#DC2626', flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: webhook.healthy ? '#15803D' : '#DC2626', fontWeight: 500 }}>
          Webhook {webhook.healthy ? 'aktif' : 'tidak aktif / belum ada'}
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', marginLeft: 8 }}>
          {webhook.phone && <span style={{ marginRight: 10 }}>{webhook.label || webhook.phone}</span>}
          Terakhir: {timeAgo(webhook.lastWebhookAt)}
        </div>
        {!webhook.healthy && (
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#B45309', background: '#FFFBEB', padding: '4px 10px', borderRadius: 6, border: '1px solid #FDE68A' }}>
            Cek nomor WhatsApp & token di Nomor WhatsApp
          </div>
        )}
      </div>

      {/* Stats cards */}
      <div className="cards-auto" style={{ gap: 12, marginBottom: 24 }}>
        <StatCard label="Total kontak" value={contacts.total} sub={`+${contacts.new7d} minggu ini`} />
        <StatCard label="Broadcast dikirim (30hr)" value={delivery.totalSent} sub={`${delivery.failed} gagal`} danger={delivery.failed > 0} />
        <StatCard label="Delivery rate" value={`${delivery.deliveryRate}%`} sub="dari pesan terkirim" accent />
        <StatCard label="Read rate" value={`${delivery.readRate}%`} sub="dibuka customer" accent />
      </div>

      {/* Message chart */}
      <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0D0D0D', marginBottom: 4 }}>Pesan masuk & keluar — 7 hari</div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16, display: 'flex', gap: 16 }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#16A34A', marginRight: 4 }} />Masuk</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#3B82F6', marginRight: 4 }} />Keluar</span>
        </div>
        {msgChart.length === 0 ? (
          <div style={{ textAlign: 'center', fontSize: 13, color: '#9CA3AF', padding: '24px 0' }}>Belum ada data pesan 7 hari terakhir.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <svg width={Math.max(560, msgChart.length * (barW * 2 + 8) + 40)} height={chartH + 30}>
              {msgChart.map((d, i) => {
                const x = i * (barW * 2 + 8) + 20
                const inH = Math.round((d.in / maxVal) * chartH)
                const outH = Math.round((d.out / maxVal) * chartH)
                return (
                  <g key={d.date}>
                    <rect x={x} y={chartH - inH} width={barW} height={inH} fill="#16A34A" rx={2} opacity={0.85} />
                    <rect x={x + barW + 2} y={chartH - outH} width={barW} height={outH} fill="#3B82F6" rx={2} opacity={0.85} />
                    <text x={x + barW} y={chartH + 16} textAnchor="middle" fontSize={9} fill="#9CA3AF">{d.date.slice(5)}</text>
                  </g>
                )
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Delivery breakdown */}
      <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0D0D0D', marginBottom: 14 }}>Delivery breakdown — 30 hari</div>
        <div className="cards-auto" style={{ gap: 10 }}>
          {[
            { label: 'Terkirim', value: delivery.sent, color: '#6B7280' },
            { label: 'Delivered', value: delivery.delivered, color: '#3B82F6' },
            { label: 'Dibaca', value: delivery.read, color: '#16A34A' },
            { label: 'Gagal', value: delivery.failed, color: '#DC2626' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', padding: '12px 8px', background: '#FAFAFA', borderRadius: 8, border: '1px solid #F0F0F0' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent campaigns */}
      <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F0F0', fontSize: 14, fontWeight: 600, color: '#0D0D0D' }}>
          Broadcast terakhir — 30 hari
        </div>
        {campaigns.length === 0 ? (
          <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>Belum ada broadcast.</div>
        ) : campaigns.map((c, i) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: i < campaigns.length - 1 ? '1px solid #F7F7F7' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#0D0D0D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.body?.slice(0, 60) || '—'}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{new Date(c.created_at).toLocaleDateString('id-ID')}</div>
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', textAlign: 'right', flexShrink: 0 }}>
              <div>{c.sent} terkirim · {c.failed} gagal</div>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: c.status === 'done' ? '#F0FDF4' : '#FFFBEB', color: c.status === 'done' ? '#15803D' : '#B45309', border: `1px solid ${c.status === 'done' ? '#BBF7D0' : '#FDE68A'}` }}>{c.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, accent, danger }: { label: string; value: any; sub?: string; accent?: boolean; danger?: boolean }) {
  const color = danger ? '#DC2626' : accent ? '#16A34A' : '#0D0D0D'
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#0D0D0D', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
