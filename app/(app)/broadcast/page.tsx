'use client'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'

type Template = { name: string; status: string; language: string; category: string; components: any[] }
type Campaign = { id: string; kind: string; body: string; total: number; sent: number; failed: number; status: string; created_at: string }
type Recipient = { phone: string; status: string; name?: string }

function fmtDate(s: string) {
  const d = new Date(s)
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function BroadcastPage() {
  const [tab, setTab] = useState<'text' | 'template' | 'history'>('text')
  const [numbers, setNumbers] = useState<any[]>([])
  const [waNumberId, setWaNumberId] = useState('')

  // Text broadcast state
  const [text, setText] = useState('')
  const [engagedOnly, setEngagedOnly] = useState(true)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)

  // Quick-response box builder (2/3/4 opsi balasan)
  const [qrEnabled, setQrEnabled] = useState(false)
  const [qrOptions, setQrOptions] = useState<string[]>(['Ya, mau', 'Nanti dulu'])

  // Template state
  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [templateBusy, setTemplateBusy] = useState(false)
  const [templateResult, setTemplateResult] = useState<any>(null)

  // History state
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [detail, setDetail] = useState<{ campaign: Campaign; recipients: Recipient[] } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    (async () => {
      const res = await authFetch('/api/numbers')
      const j = await res.json()
      setNumbers(j.numbers || [])
      if (j.numbers?.[0]) setWaNumberId(j.numbers[0].id)
    })()
  }, [])

  useEffect(() => {
    if (tab === 'template' && templates.length === 0) {
      setTemplatesLoading(true)
      authFetch('/api/templates').then(r => r.json()).then(j => {
        setTemplates(j.templates || [])
        setTemplatesLoading(false)
      })
    }
    if (tab === 'history') loadHistory()
  }, [tab])

  async function loadHistory() {
    setHistoryLoading(true); setDetail(null)
    const res = await authFetch('/api/broadcast/history')
    const j = await res.json()
    setCampaigns(j.campaigns || [])
    setHistoryLoading(false)
  }

  async function openDetail(id: string) {
    setDetailLoading(true)
    const res = await authFetch(`/api/broadcast/history?id=${id}`)
    const j = await res.json()
    if (res.ok) setDetail({ campaign: j.campaign, recipients: j.recipients || [] })
    setDetailLoading(false)
  }

  // Gabung pesan + quick-response options jadi 1 teks (works dalam window 24 jam)
  function composeText(): string {
    if (!qrEnabled) return text
    const opts = qrOptions.map(o => o.trim()).filter(Boolean)
    if (!opts.length) return text
    const lines = opts.map((o, i) => `${i + 1}. ${o}`).join('\n')
    return `${text}\n\nBalas dengan angka:\n${lines}`
  }

  async function sendText() {
    setBusy(true); setResult(null)
    try {
      const res = await authFetch('/api/broadcast', { method: 'POST', body: JSON.stringify({ wa_number_id: waNumberId, text: composeText(), engagedOnly }) })
      const j = await res.json()
      if (!res.ok) { alert(j.error || 'Gagal'); return }
      setResult(j)
    } finally { setBusy(false) }
  }

  async function sendTemplate() {
    if (!selectedTemplate) return
    setTemplateBusy(true); setTemplateResult(null)
    try {
      const res = await authFetch('/api/templates', { method: 'POST', body: JSON.stringify({ wa_number_id: waNumberId, template_name: selectedTemplate, language_code: 'id', engagedOnly }) })
      const j = await res.json()
      if (!res.ok) { alert(j.error || 'Gagal'); return }
      setTemplateResult(j)
    } finally { setTemplateBusy(false) }
  }

  function setQrCount(n: number) {
    const base = ['Ya, mau', 'Nanti dulu', 'Info lebih lanjut', 'Tidak, terima kasih']
    setQrOptions(base.slice(0, n))
  }

  const approvedTemplates = templates.filter(t => t.status === 'APPROVED')

  return (
    <div style={{ padding: '32px 36px', maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0D0D0D', letterSpacing: '-0.02em', marginBottom: 3 }}>Broadcast</h1>
        <p style={{ fontSize: 13, color: '#6B7280' }}>Kirim pesan ke kontak aktif. Anti-spam aktif: 1 kontak maks 1× / 30 hari.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '1px solid #E5E5E5', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
        {[{ id: 'text', label: 'Teks bebas' }, { id: 'template', label: 'Template resmi' }, { id: 'history', label: 'Riwayat' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: tab === t.id ? 600 : 400, background: tab === t.id ? '#0D0D0D' : '#fff', color: tab === t.id ? '#fff' : '#6B7280', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Nomor selector (sembunyikan di tab history) */}
      {tab !== 'history' && (
        <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, padding: '16px 18px', marginBottom: 12 }}>
          <label style={lbl}>Kirim dari nomor</label>
          <select value={waNumberId} onChange={e => setWaNumberId(e.target.value)} style={inp}>
            {numbers.length === 0 && <option value="">(belum ada nomor)</option>}
            {numbers.map(n => <option key={n.id} value={n.id}>{n.display_phone || n.phone_number_id}{n.label ? ` · ${n.label}` : ''}</option>)}
          </select>
        </div>
      )}

      {tab === 'text' ? (
        <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '18px 18px 0' }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ ...lbl, margin: 0 }}>Pesan</label>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>{text.length} karakter</span>
              </div>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder="Tulis pesan broadcast…" style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
            </div>

            {/* Quick response builder */}
            <div style={{ marginBottom: 16, padding: '12px 14px', background: '#F7F7F7', borderRadius: 8, border: '1px solid #E5E5E5' }}>
              <div onClick={() => setQrEnabled(v => !v)} style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', marginBottom: qrEnabled ? 12 : 0 }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, background: qrEnabled ? '#16A34A' : '#fff', border: qrEnabled ? 'none' : '1.5px solid #D4D4D4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {qrEnabled && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D' }}>Tambah pilihan balasan cepat</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>Customer balas dengan angka (1/2/3…).</div>
                </div>
              </div>
              {qrEnabled && (
                <div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {[2, 3, 4].map(n => (
                      <button key={n} onClick={() => setQrCount(n)}
                        style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                          background: qrOptions.length === n ? '#0D0D0D' : '#fff',
                          color: qrOptions.length === n ? '#fff' : '#6B7280',
                          border: '1px solid #E5E5E5', fontWeight: 500 }}>
                        {n} box
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {qrOptions.map((o, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#9CA3AF', width: 16, textAlign: 'center', flexShrink: 0 }}>{i + 1}.</span>
                        <input value={o} onChange={e => setQrOptions(prev => prev.map((x, idx) => idx === i ? e.target.value : x))}
                          placeholder={`Opsi ${i + 1}`}
                          style={{ flex: 1, padding: '6px 10px', fontSize: 12, border: '1px solid #E5E5E5', borderRadius: 6, outline: 'none', fontFamily: 'inherit', color: '#0D0D0D' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div onClick={() => setEngagedOnly(v => !v)} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', background: '#F7F7F7', borderRadius: 8, border: '1px solid #E5E5E5', marginBottom: 18, cursor: 'pointer' }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1, background: engagedOnly ? '#0D0D0D' : '#fff', border: engagedOnly ? 'none' : '1.5px solid #D4D4D4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {engagedOnly && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D', marginBottom: 2 }}>Hanya ke kontak aktif</div>
                <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>Aktif chat 60 hari. Opt-out & cooldown 30 hari otomatis dibuang.</div>
              </div>
            </div>
          </div>
          <div style={{ padding: '12px 18px', background: '#F7F7F7', borderTop: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Kirim hanya konten yang relevan & bernilai.</p>
            <button onClick={sendText} disabled={busy || !waNumberId || !text.trim()}
              style={{ padding: '9px 20px', background: busy || !waNumberId || !text.trim() ? '#F0F0F0' : '#0D0D0D', color: busy || !waNumberId || !text.trim() ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontWeight: 500, fontSize: 13, cursor: busy || !waNumberId || !text.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {busy ? 'Mengirim…' : 'Kirim broadcast'}
            </button>
          </div>
        </div>
      ) : tab === 'template' ? (
        <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '18px 18px' }}>
            {templatesLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: '#9CA3AF' }}>Memuat template…</div>
            ) : approvedTemplates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D', marginBottom: 6 }}>Belum ada template yang disetujui</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.6 }}>
                  Buat template di Meta Business Manager dan tunggu approval. Template diperlukan untuk kirim pesan ke kontak di luar window 24 jam.
                </div>
              </div>
            ) : (
              <>
                <label style={lbl}>Pilih template</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {approvedTemplates.map(t => (
                    <div key={t.name} onClick={() => setSelectedTemplate(t.name)}
                      style={{ padding: '12px 14px', border: `1px solid ${selectedTemplate === t.name ? '#16A34A' : '#E5E5E5'}`, borderRadius: 8, cursor: 'pointer', background: selectedTemplate === t.name ? '#F0FDF4' : '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D' }}>{t.name}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '2px 7px', borderRadius: 999 }}>APPROVED</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#9CA3AF' }}>{t.category} · {t.language}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          {approvedTemplates.length > 0 && (
            <div style={{ padding: '12px 18px', background: '#F7F7F7', borderTop: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Dikirim ke semua kontak yang tidak opt-out.</p>
              <button onClick={sendTemplate} disabled={templateBusy || !waNumberId || !selectedTemplate}
                style={{ padding: '9px 20px', background: templateBusy || !waNumberId || !selectedTemplate ? '#F0F0F0' : '#0D0D0D', color: templateBusy || !waNumberId || !selectedTemplate ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontWeight: 500, fontSize: 13, cursor: templateBusy || !waNumberId || !selectedTemplate ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {templateBusy ? 'Mengirim…' : 'Kirim template'}
              </button>
            </div>
          )}
        </div>
      ) : (
        // HISTORY
        <div>
          {detail ? (
            <div>
              <button onClick={() => setDetail(null)} style={{ ...btnGhost, marginBottom: 14 }}>← Kembali ke riwayat</button>
              <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, padding: 18, marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>{fmtDate(detail.campaign.created_at)}</div>
                <div style={{ fontSize: 13, color: '#0D0D0D', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: 14, padding: '10px 12px', background: '#FAFAFA', borderRadius: 8, border: '1px solid #F0F0F0' }}>{detail.campaign.body}</div>
                <div style={{ display: 'flex', gap: 24 }}>
                  <Stat label="Terkirim" value={detail.campaign.sent} color="#15803D" />
                  <Stat label="Gagal" value={detail.campaign.failed} color={detail.campaign.failed > 0 ? '#DC2626' : '#9CA3AF'} />
                  <Stat label="Total" value={detail.campaign.total} color="#6B7280" />
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>Daftar penerima ({detail.recipients.length})</div>
              <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, overflow: 'hidden' }}>
                {detail.recipients.map((r, i) => (
                  <div key={i} style={{ padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < detail.recipients.length - 1 ? '1px solid #F7F7F7' : 'none' }}>
                    <div style={{ fontSize: 13, color: '#0D0D0D' }}>{r.name || r.phone}</div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, color: r.status === 'sent' ? '#15803D' : '#DC2626', background: r.status === 'sent' ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${r.status === 'sent' ? '#BBF7D0' : '#FECACA'}` }}>
                      {r.status === 'sent' ? 'Terkirim' : 'Gagal'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : historyLoading ? (
            <div style={{ fontSize: 13, color: '#9CA3AF', padding: 20 }}>Memuat riwayat…</div>
          ) : campaigns.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 13, color: '#9CA3AF', background: '#FAFAFA', borderRadius: 10, border: '1px solid #F0F0F0' }}>
              Belum ada broadcast yang dikirim.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {campaigns.map(c => (
                <div key={c.id} onClick={() => openDetail(c.id)} style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, padding: '14px 16px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontSize: 13, color: '#0D0D0D', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 12 }}>{c.body}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{fmtDate(c.created_at)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
                    <span style={{ color: '#15803D', fontWeight: 600 }}>✓ {c.sent} terkirim</span>
                    {c.failed > 0 && <span style={{ color: '#DC2626', fontWeight: 600 }}>✕ {c.failed} gagal</span>}
                    <span style={{ color: '#9CA3AF' }}>dari {c.total}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {detailLoading && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 10 }}>Memuat detail…</div>}
        </div>
      )}

      {(result || templateResult) && (() => {
        const r = result || templateResult
        return (
          <div style={{ marginTop: 14, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '16px 20px', display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <Stat label="Terkirim" value={r.sent} color="#15803D" />
            <Stat label="Gagal" value={r.failed} color={r.failed > 0 ? '#DC2626' : '#9CA3AF'} />
            <Stat label="Total" value={r.total} color="#6B7280" />
            {typeof r.skipped === 'number' && r.skipped > 0 && <Stat label="Di-skip (cooldown)" value={r.skipped} color="#B45309" />}
          </div>
        )
      })()}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{label}</div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: '#374151', marginBottom: 6, fontWeight: 500 }
const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, color: '#0D0D0D', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
const btnGhost: React.CSSProperties = { padding: '7px 12px', background: '#fff', color: '#6B7280', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
