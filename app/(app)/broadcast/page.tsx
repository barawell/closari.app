'use client'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'

type Template = { name: string; status: string; language: string; category: string; components: any[] }

export default function BroadcastPage() {
  const [tab, setTab] = useState<'text' | 'template'>('text')
  const [numbers, setNumbers] = useState<any[]>([])
  const [waNumberId, setWaNumberId] = useState('')

  // Text broadcast state
  const [text, setText] = useState('')
  const [engagedOnly, setEngagedOnly] = useState(true)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)

  // Template state
  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [templateBusy, setTemplateBusy] = useState(false)
  const [templateResult, setTemplateResult] = useState<any>(null)

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
  }, [tab])

  async function sendText() {
    setBusy(true); setResult(null)
    try {
      const res = await authFetch('/api/broadcast', { method: 'POST', body: JSON.stringify({ wa_number_id: waNumberId, text, engagedOnly }) })
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

  const approvedTemplates = templates.filter(t => t.status === 'APPROVED')

  return (
    <div style={{ padding: '32px 36px', maxWidth: 660 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0D0D0D', letterSpacing: '-0.02em', marginBottom: 3 }}>Broadcast</h1>
        <p style={{ fontSize: 13, color: '#6B7280' }}>Kirim pesan ke kontak aktif. Pastikan pesan relevan dan bernilai.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '1px solid #E5E5E5', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
        {[{ id: 'text', label: 'Teks bebas' }, { id: 'template', label: 'Template resmi' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: tab === t.id ? 600 : 400, background: tab === t.id ? '#0D0D0D' : '#fff', color: tab === t.id ? '#fff' : '#6B7280', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t.label}
            {t.id === 'template' && <span style={{ marginLeft: 6, fontSize: 10, background: '#16A34A', color: '#fff', padding: '1px 6px', borderRadius: 999, fontWeight: 600 }}>Jangkauan penuh</span>}
          </button>
        ))}
      </div>

      {/* Nomor selector */}
      <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, padding: '16px 18px', marginBottom: 12 }}>
        <label style={lbl}>Kirim dari nomor</label>
        <select value={waNumberId} onChange={e => setWaNumberId(e.target.value)} style={inp}>
          {numbers.length === 0 && <option value="">(belum ada nomor)</option>}
          {numbers.map(n => <option key={n.id} value={n.id}>{n.display_phone || n.phone_number_id}{n.label ? ` · ${n.label}` : ''}</option>)}
        </select>
      </div>

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
            <div onClick={() => setEngagedOnly(v => !v)} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', background: '#F7F7F7', borderRadius: 8, border: '1px solid #E5E5E5', marginBottom: 18, cursor: 'pointer' }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1, background: engagedOnly ? '#0D0D0D' : '#fff', border: engagedOnly ? 'none' : '1.5px solid #D4D4D4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {engagedOnly && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D', marginBottom: 2 }}>Hanya ke kontak aktif</div>
                <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>Aktif chat 60 hari. Opt-out otomatis dibuang.</div>
              </div>
            </div>
          </div>
          <div style={{ padding: '12px 18px', background: '#F7F7F7', borderTop: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Hanya ke kontak aktif 24 jam terakhir.</p>
            <button onClick={sendText} disabled={busy || !waNumberId || !text.trim()}
              style={{ padding: '9px 20px', background: busy || !waNumberId || !text.trim() ? '#F0F0F0' : '#0D0D0D', color: busy || !waNumberId || !text.trim() ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontWeight: 500, fontSize: 13, cursor: busy || !waNumberId || !text.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {busy ? 'Mengirim…' : 'Kirim broadcast'}
            </button>
          </div>
        </div>
      ) : (
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
      )}

      {(result || templateResult) && (() => {
        const r = result || templateResult
        return (
          <div style={{ marginTop: 14, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '16px 20px', display: 'flex', gap: 28 }}>
            {[{ label: 'Terkirim', value: r.sent, color: '#15803D' }, { label: 'Gagal', value: r.failed, color: r.failed > 0 ? '#DC2626' : '#9CA3AF' }, { label: 'Total', value: r.total, color: '#6B7280' }].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: '#374151', marginBottom: 6, fontWeight: 500 }
const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, color: '#0D0D0D', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
