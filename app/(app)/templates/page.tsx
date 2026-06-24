'use client'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'

type Tpl = { id?: string; name: string; status: string; language: string; category: string; components: any[] }
type Btn = { type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url?: string; phone?: string }

const CATS = [
  { id: 'MARKETING', label: 'Marketing', desc: 'Promo, penawaran, info produk' },
  { id: 'UTILITY', label: 'Utility', desc: 'Update pesanan, notifikasi transaksi' },
  { id: 'AUTHENTICATION', label: 'Auth', desc: 'Kode OTP / verifikasi' },
]

function statusColor(s: string) {
  const u = (s || '').toUpperCase()
  if (u === 'APPROVED') return { c: '#15803D', bg: '#F0FDF4', b: '#BBF7D0' }
  if (u === 'REJECTED') return { c: '#DC2626', bg: '#FEF2F2', b: '#FECACA' }
  return { c: '#B45309', bg: '#FFFBEB', b: '#FDE68A' } // PENDING / lain
}

function bodyOf(t: Tpl): string {
  const c = (t.components || []).find((x: any) => x.type === 'BODY')
  return c?.text || ''
}

export default function TemplatesPage() {
  const [tab, setTab] = useState<'list' | 'create'>('list')
  const [templates, setTemplates] = useState<Tpl[]>([])
  const [loading, setLoading] = useState(false)

  // form
  const [name, setName] = useState('')
  const [category, setCategory] = useState('MARKETING')
  const [language, setLanguage] = useState('id')
  const [headerText, setHeaderText] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [footerText, setFooterText] = useState('')
  const [examples, setExamples] = useState<string[]>([])
  const [buttons, setButtons] = useState<Btn[]>([])
  const [busy, setBusy] = useState(false)
  const [okMsg, setOkMsg] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => { loadList() }, [])

  // sinkronkan jumlah field contoh dengan jumlah {{n}} di body
  useEffect(() => {
    const n = (bodyText.match(/\{\{\s*\d+\s*\}\}/g) || []).length
    setExamples(prev => {
      const next = [...prev]
      next.length = n
      for (let i = 0; i < n; i++) if (next[i] === undefined) next[i] = ''
      return next
    })
  }, [bodyText])

  async function loadList() {
    setLoading(true)
    const res = await authFetch('/api/templates/manage')
    const j = await res.json()
    setTemplates(j.templates || [])
    setLoading(false)
  }

  async function syncFromMeta() {
    setSyncing(true)
    try {
      const res = await authFetch('/api/templates/sync', { method: 'POST' })
      const j = await res.json()
      if (res.ok) {
        setOkMsg(`Sync selesai — ${j.synced} template diperbarui dari Meta.`)
        await loadList()
      } else { alert(j.error || 'Gagal sync') }
    } finally { setSyncing(false) }
  }

  function addButton(type: Btn['type']) {
    if (buttons.length >= 3) return
    setButtons(prev => [...prev, { type, text: '' }])
  }
  function updateButton(i: number, patch: Partial<Btn>) {
    setButtons(prev => prev.map((b, idx) => idx === i ? { ...b, ...patch } : b))
  }
  function removeButton(i: number) {
    setButtons(prev => prev.filter((_, idx) => idx !== i))
  }

  function resetForm() {
    setName(''); setCategory('MARKETING'); setLanguage('id')
    setHeaderText(''); setBodyText(''); setFooterText('')
    setExamples([]); setButtons([])
  }

  async function submit() {
    setBusy(true); setOkMsg('')
    try {
      const res = await authFetch('/api/templates/manage', {
        method: 'POST',
        body: JSON.stringify({
          name, language, category,
          body_text: bodyText,
          body_examples: examples,
          header_text: headerText || undefined,
          footer_text: footerText || undefined,
          buttons: buttons.length ? buttons : undefined,
        }),
      })
      const j = await res.json()
      if (!res.ok) { alert(j.error || 'Gagal'); return }
      setOkMsg(`Template "${j.name}" diajukan ke Meta (status: ${j.status}). Review biasanya beberapa menit.`)
      resetForm()
      loadList()
      setTab('list')
    } finally { setBusy(false) }
  }

  async function del(name: string) {
    if (!confirm(`Hapus template "${name}"?`)) return
    const res = await authFetch(`/api/templates/manage?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
    const j = await res.json()
    if (!res.ok) { alert(j.error || 'Gagal'); return }
    loadList()
  }

  const nameValid = /^[a-z0-9_]+$/.test(name) && name.length > 0
  const canSubmit = nameValid && bodyText.trim().length > 0 && !busy

  return (
    <div style={{ padding: '32px 36px', maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0D0D0D', letterSpacing: '-0.02em', marginBottom: 3 }}>Template WhatsApp</h1>
        <p style={{ fontSize: 13, color: '#6B7280' }}>Ajukan template langsung dari sini — tanpa buka Meta Business Manager. Meta review otomatis.</p>
        <button onClick={syncFromMeta} disabled={syncing} style={{ marginTop: 8, padding: '6px 14px', fontSize: 12, fontWeight: 500, background: '#fff', color: syncing ? '#9CA3AF' : '#374151', border: '1px solid #E5E5E5', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}>
          {syncing ? '↻ Sync…' : '↻ Sync status dari Meta'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '1px solid #E5E5E5', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
        {[{ id: 'list', label: 'Daftar template' }, { id: 'create', label: '+ Buat baru' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: tab === t.id ? 600 : 400, background: tab === t.id ? '#0D0D0D' : '#fff', color: tab === t.id ? '#fff' : '#6B7280', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t.label}
          </button>
        ))}
      </div>

      {okMsg && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, fontSize: 13, color: '#15803D' }}>{okMsg}</div>
      )}

      {tab === 'list' ? (
        loading ? (
          <div style={{ fontSize: 13, color: '#9CA3AF', padding: 20 }}>Memuat template…</div>
        ) : templates.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 13, color: '#9CA3AF', background: '#FAFAFA', borderRadius: 10, border: '1px solid #F0F0F0' }}>
            Belum ada template. Klik <b>+ Buat baru</b> untuk mengajukan.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {templates.map(t => {
              const sc = statusColor(t.status)
              return (
                <div key={t.name + t.language} style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D' }}>{t.name}</span>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>{t.category} · {t.language}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: sc.c, background: sc.bg, border: `1px solid ${sc.b}`, padding: '2px 8px', borderRadius: 999 }}>{(t.status || '').toUpperCase()}</span>
                      <button onClick={() => del(t.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 12, fontFamily: 'inherit' }}>Hapus</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{bodyOf(t)}</div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        // CREATE FORM
        <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Nama template</label>
              <input value={name} onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="contoh: promo_akhir_bulan" style={inp} />
              {!nameValid && name.length > 0 && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Hanya huruf kecil, angka, underscore.</div>}
            </div>
            <div>
              <label style={lbl}>Bahasa</label>
              <select value={language} onChange={e => setLanguage(e.target.value)} style={inp}>
                <option value="id">Indonesia (id)</option>
                <option value="en">English (en)</option>
                <option value="en_US">English US (en_US)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Kategori</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {CATS.map(c => (
                <div key={c.id} onClick={() => setCategory(c.id)}
                  style={{ flex: 1, padding: '10px 12px', border: `1px solid ${category === c.id ? '#16A34A' : '#E5E5E5'}`, borderRadius: 8, cursor: 'pointer', background: category === c.id ? '#F0FDF4' : '#fff' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0D0D0D' }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{c.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Header (opsional, teks)</label>
            <input value={headerText} onChange={e => setHeaderText(e.target.value)} placeholder="Judul singkat di atas pesan" style={inp} maxLength={60} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Body pesan</label>
            <textarea value={bodyText} onChange={e => setBodyText(e.target.value)} rows={5}
              placeholder={'Tulis isi pesan. Pakai {{1}}, {{2}} untuk bagian yang berubah-ubah.\nContoh: Halo {{1}}, pesanan {{2}} kamu sudah dikirim.'}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
            {examples.length > 0 && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: '#F7F7F7', borderRadius: 8, border: '1px solid #E5E5E5' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 8 }}>Contoh nilai variabel (wajib untuk review Meta)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {examples.map((ex, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#9CA3AF', flexShrink: 0, width: 36 }}>{`{{${i + 1}}}`}</span>
                      <input value={ex} onChange={e => setExamples(prev => prev.map((x, idx) => idx === i ? e.target.value : x))}
                        placeholder={`contoh nilai untuk {{${i + 1}}}`}
                        style={{ flex: 1, padding: '6px 10px', fontSize: 12, border: '1px solid #E5E5E5', borderRadius: 6, outline: 'none', fontFamily: 'inherit', color: '#0D0D0D' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Footer (opsional)</label>
            <input value={footerText} onChange={e => setFooterText(e.target.value)} placeholder="Teks kecil di bawah pesan, mis. nama brand" style={inp} maxLength={60} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>Tombol (opsional, maks 3)</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: buttons.length ? 10 : 0 }}>
              <button onClick={() => addButton('QUICK_REPLY')} disabled={buttons.length >= 3} style={btnSmall}>+ Balasan cepat</button>
              <button onClick={() => addButton('URL')} disabled={buttons.length >= 3} style={btnSmall}>+ Link URL</button>
              <button onClick={() => addButton('PHONE_NUMBER')} disabled={buttons.length >= 3} style={btnSmall}>+ Telepon</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {buttons.map((b, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', background: '#F7F7F7', borderRadius: 8, border: '1px solid #E5E5E5' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', width: 70, flexShrink: 0 }}>
                    {b.type === 'QUICK_REPLY' ? 'BALASAN' : b.type === 'URL' ? 'URL' : 'TELEPON'}
                  </span>
                  <input value={b.text} onChange={e => updateButton(i, { text: e.target.value })} placeholder="Teks tombol"
                    style={{ flex: 1, padding: '6px 10px', fontSize: 12, border: '1px solid #E5E5E5', borderRadius: 6, outline: 'none', fontFamily: 'inherit', color: '#0D0D0D' }} maxLength={25} />
                  {b.type === 'URL' && (
                    <input value={b.url || ''} onChange={e => updateButton(i, { url: e.target.value })} placeholder="https://…"
                      style={{ flex: 1.4, padding: '6px 10px', fontSize: 12, border: '1px solid #E5E5E5', borderRadius: 6, outline: 'none', fontFamily: 'inherit', color: '#0D0D0D' }} />
                  )}
                  {b.type === 'PHONE_NUMBER' && (
                    <input value={b.phone || ''} onChange={e => updateButton(i, { phone: e.target.value })} placeholder="+628…"
                      style={{ flex: 1.2, padding: '6px 10px', fontSize: 12, border: '1px solid #E5E5E5', borderRadius: 6, outline: 'none', fontFamily: 'inherit', color: '#0D0D0D' }} />
                  )}
                  <button onClick={() => removeButton(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 16, lineHeight: 1, padding: '0 4px' }}>×</button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F0F0F0', paddingTop: 16 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Status: PENDING → APPROVED/REJECTED dari Meta.</p>
              <button type="button" onClick={() => setShowPreview(v => !v)} style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', background: showPreview ? '#F0FDF4' : '#fff', color: showPreview ? '#15803D' : '#374151', border: '1px solid #E5E5E5', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {showPreview ? '✕ Tutup' : '👁 Preview WA'}
              </button>
            </div>
            <button onClick={submit} disabled={!canSubmit}
              style={{ padding: '9px 20px', background: !canSubmit ? '#F0F0F0' : '#0D0D0D', color: !canSubmit ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontWeight: 500, fontSize: 13, cursor: !canSubmit ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {busy ? 'Mengajukan…' : 'Ajukan ke Meta'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function WaPreview({ header, body, footer, buttons, examples }: { header: string; body: string; footer: string; buttons: any[]; examples: string[] }) {
  const rendered = body.replace(/\{\{(\d+)\}\}/g, (_: string, n: string) => examples[parseInt(n) - 1] || `{{${n}}}`)
  return (
    <div style={{ marginTop: 20, background: '#E5DDD5', borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview — tampilan di WhatsApp</div>
      <div style={{ maxWidth: 300 }}>
        <div style={{ background: '#fff', borderRadius: '0 10px 10px 10px', padding: '10px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.12)' }}>
          {header && <div style={{ fontSize: 14, fontWeight: 700, color: '#0D0D0D', marginBottom: 6 }}>{header}</div>}
          <div style={{ fontSize: 13, color: '#111', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {rendered || <span style={{ color: '#9CA3AF' }}>Isi body dulu…</span>}
          </div>
          {footer && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>{footer}</div>}
          <div style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'right', marginTop: 4 }}>
            {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ✓✓
          </div>
        </div>
        {buttons.filter(b => b.text).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
            {buttons.filter(b => b.text).map((b, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#0A97AE', fontWeight: 500, textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                {b.type === 'URL' ? '🔗 ' : b.type === 'PHONE_NUMBER' ? '📞 ' : '↩ '}{b.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: '#374151', marginBottom: 6, fontWeight: 500 }
const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, color: '#0D0D0D', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
const btnSmall: React.CSSProperties = { padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', background: '#fff', color: '#374151', border: '1px solid #E5E5E5', fontWeight: 500 }
