'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'

type Tpl = { name: string; status: string; language: string; category: string; components: any[] }
type Contact = { id: string; phone: string; name?: string; segment: 'loyal' | 'new'; opted_out?: boolean }
type Campaign = { id: string; kind: string; body: string; template_name?: string; category?: string; total: number; sent: number; failed: number; status: string; created_at: string; reject_reason?: string | null }

const COST_PER_MSG = 700 // Rp, estimasi tampilan (sesuaikan dgn tarif Meta-mu)

function fmtRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }
function fmtDate(s: string) { return new Date(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }
function bodyOfTpl(t?: Tpl) { return t ? (t.components || []).find((x: any) => x.type === 'BODY')?.text || '' : '' }
// Hitung jumlah variabel unik {{1}}, {{2}}, dst di body template
function countVars(body: string): number {
  const matches = body.match(/\{\{(\d+)\}\}/g) || []
  const nums = matches.map(m => parseInt(m.replace(/[^0-9]/g, ''), 10)).filter(n => !isNaN(n))
  return nums.length ? Math.max(...nums) : 0
}
// Ganti {{1}} dst dengan nilai params buat preview
function renderTpl(body: string, params: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n) => params[parseInt(n, 10) - 1] || `{{${n}}}`)
}
// Ambil nama depan dari nama lengkap (buat preview variabel otomatis)
function firstName(name?: string | null): string {
  const n = (name || '').trim()
  return n ? n.split(/\s+/)[0] : ''
}
// Sumber tiap variabel: 'nama' = otomatis nama kontak per-penerima, 'manual' = teks tetap
type ParamSrc = 'nama' | 'manual'
// Penerima dengan nama opsional (dipakai contacts/CSV/Excel)
type Recip = { phone: string; name?: string }

// Header kolom yang dianggap "nomor" / "nama" saat parsing CSV/Excel
const PHONE_HEADER = ['phone', 'nomor', 'no_hp', 'nohp', 'no hp', 'hp', 'telp', 'telepon', 'wa', 'whatsapp', 'msisdn', 'number', 'no']
const NAME_HEADER = ['nama', 'name', 'full_name', 'fullname', 'contact', 'kontak', 'pelanggan', 'customer']
function digitsOf(s: any) { return String(s ?? '').replace(/\D/g, '') }
function isPhone(d: string) { return d.length >= 9 && d.length <= 15 }

// Ubah baris-baris sel (2D) → daftar {phone, name}. Deteksi kolom dari header kalau ada,
// kalau tidak → tebak: nomor = sel yang berupa angka valid, nama = sel teks pertama.
function rowsToRecipients(rows: any[][]): Recip[] {
  const clean = rows.map(r => (Array.isArray(r) ? r : [r]).map(c => String(c ?? '').trim())).filter(r => r.some(c => c))
  if (!clean.length) return []
  const head = clean[0].map(h => h.toLowerCase())
  const pIdx = head.findIndex(h => PHONE_HEADER.some(k => h === k || h.includes(k)))
  const nIdx = head.findIndex(h => NAME_HEADER.some(k => h === k || h.includes(k)))
  const hasHeader = pIdx !== -1 || nIdx !== -1
  const body = hasHeader ? clean.slice(1) : clean

  const out: Recip[] = []
  for (const cells of body) {
    let phone = ''
    let name = ''
    if (hasHeader && pIdx !== -1) phone = digitsOf(cells[pIdx])
    if (hasHeader && nIdx !== -1) name = cells[nIdx] || ''
    if (!isPhone(phone)) { const pc = cells.find(c => isPhone(digitsOf(c))); phone = pc ? digitsOf(pc) : '' }
    if (!name) name = cells.find(c => /[A-Za-z]/.test(c) && !isPhone(digitsOf(c))) || ''
    if (isPhone(phone)) out.push({ phone, name: name || undefined })
  }
  // dedupe by phone (pertahankan nama pertama yang ada)
  const map = new Map<string, Recip>()
  for (const r of out) {
    const ex = map.get(r.phone)
    if (!ex || (!ex.name && r.name)) map.set(r.phone, r)
  }
  return Array.from(map.values())
}

export default function BroadcastPage() {
  const [step, setStep] = useState(1)
  const [view, setView] = useState<'wizard' | 'approval' | 'history'>('wizard')

  const [me, setMe] = useState<any>(null)
  const [numbers, setNumbers] = useState<any[]>([])
  const [waNumberId, setWaNumberId] = useState('')

  // Step 1 — compose
  const [mode, setMode] = useState<'text' | 'template'>('text')
  const [text, setText] = useState('')
  const [category, setCategory] = useState('MARKETING')
  const [templates, setTemplates] = useState<Tpl[]>([])
  const [tplName, setTplName] = useState('')
  const [tplParams, setTplParams] = useState<string[]>([])
  const [paramSrc, setParamSrc] = useState<ParamSrc[]>([])   // sumber tiap variabel
  const [nameFallback, setNameFallback] = useState('Kak')    // dipakai kalau nama kontak kosong

  // Step 2 — recipients
  const [rmode, setRmode] = useState<'contacts' | 'csv' | 'manual'>('contacts')
  const [segment, setSegment] = useState<'all' | 'loyal' | 'new'>('all')
  const [engagedOnly, setEngagedOnly] = useState(true)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [csvRows, setCsvRows] = useState<Recip[]>([])
  const [csvInfo, setCsvInfo] = useState('')
  const [manual, setManual] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // submit/queue
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Campaign[]>([])
  const [history, setHistory] = useState<Campaign[]>([])
  const [actingId, setActingId] = useState<string | null>(null)

  const isAdmin = me?.role === 'admin' || me?.role === 'owner'
  const approvedTpls = templates.filter(t => t.status === 'APPROVED')
  const selTpl = approvedTpls.find(t => t.name === tplName)
  const varCount = selTpl ? countVars(bodyOfTpl(selTpl)) : 0

  useEffect(() => {
    (async () => {
      const [nRes, meRes] = await Promise.all([authFetch('/api/numbers'), authFetch('/api/me')])
      const nj = await nRes.json(); setNumbers(nj.numbers || [])
      if (nj.numbers?.[0]) setWaNumberId(nj.numbers[0].id)
      setMe(await meRes.json())
      const tRes = await authFetch('/api/templates'); const tj = await tRes.json()
      setTemplates(tj.templates || [])
    })()
  }, [])

  // load contacts ketika masuk step 2 mode kontak / ganti segmen
  useEffect(() => {
    if (view === 'wizard' && step === 2 && rmode === 'contacts') loadContacts()
  }, [view, step, rmode, segment, engagedOnly])

  useEffect(() => { if (view === 'approval') loadPending() }, [view])
  useEffect(() => { if (view === 'history') loadHistory() }, [view])

  // Default sumber tiap variabel saat template berganti:
  // {{1}} → otomatis (nama kontak), sisanya → teks tetap. User bisa ubah manual.
  useEffect(() => {
    if (!selTpl || varCount === 0) { setParamSrc([]); setTplParams([]); return }
    setParamSrc(Array.from({ length: varCount }, (_, i) => (i === 0 ? 'nama' : 'manual')))
    setTplParams([])
  }, [tplName, varCount])

  async function loadContacts() {
    const params = new URLSearchParams({ segment, ...(engagedOnly ? { engaged: '1' } : {}) })
    const res = await authFetch(`/api/contacts/list?${params}`)
    const j = await res.json()
    setContacts(j.contacts || [])
  }
  async function loadPending() {
    const res = await authFetch('/api/broadcast?status=pending_approval'); const j = await res.json()
    setPending(j.campaigns || [])
  }
  async function loadHistory() {
    const res = await authFetch('/api/broadcast'); const j = await res.json()
    setHistory((j.campaigns || []).filter((c: Campaign) => c.status !== 'pending_approval'))
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter(c => (c.name || '').toLowerCase().includes(q) || c.phone.includes(q))
  }, [contacts, search])

  const pickedCount = useMemo(() => Object.values(picked).filter(Boolean).length, [picked])

  function toggleAll() {
    if (pickedCount === filtered.length) { setPicked({}); return }
    const next: Record<string, boolean> = {}
    filtered.forEach(c => { next[c.id] = true })
    setPicked(next)
  }

  // ── Parse CSV / Excel ──────────────────────────────────────────────
  async function handleFile(f: File) {
    setCsvInfo('Memproses…')
    try {
      const ext = f.name.split('.').pop()?.toLowerCase()
      let recs: Recip[] = []
      if (ext === 'csv') {
        const txt = await f.text()
        const rows = txt.split(/\r?\n/).map(l => l.split(/[,;\t]/))
        recs = rowsToRecipients(rows)
      } else if (ext === 'xlsx' || ext === 'xls') {
        // butuh paket 'xlsx' (npm i xlsx). Dynamic import biar bundle ringan.
        const XLSX = await import('xlsx')
        const buf = await f.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
        recs = rowsToRecipients(rows)
      } else {
        setCsvInfo('Format tidak didukung. Pakai .csv / .xlsx'); return
      }
      setCsvRows(recs)
      const named = recs.filter(r => r.name).length
      setCsvInfo(recs.length
        ? `${recs.length} nomor terbaca dari ${f.name}` + (named ? ` · ${named} ada nama (variabel otomatis siap)` : ' · tidak ada kolom nama')
        : `Tidak ada nomor valid di ${f.name}`)
    } catch (e: any) {
      setCsvInfo('Gagal baca file: ' + (e?.message || 'error') + ' (untuk Excel, jalankan: npm i xlsx)')
    }
  }
  function extractPhones(cells: string[]): string[] {
    return cells.map(c => c.replace(/\D/g, '')).filter(d => d.length >= 9 && d.length <= 15)
  }

  // Penerima final (sesuai mode) — bawa nama kalau ada (kontak / CSV / Excel)
  const finalRecipients = useMemo<Recip[]>(() => {
    if (rmode === 'contacts') return filtered.filter(c => picked[c.id]).map(c => ({ phone: c.phone, name: c.name }))
    if (rmode === 'csv') return csvRows
    return extractPhones(manual.split(/[\n,;\t ]+/)).map(phone => ({ phone }))
  }, [rmode, filtered, picked, csvRows, manual])

  const recipientCount = finalRecipients.length

  // ── Submit ke approval ─────────────────────────────────────────────
  async function submit() {
    setBusy(true)
    try {
      const payload: any = {
        wa_number_id: waNumberId,
        mode, category,
        recipient_mode: rmode,
      }
      if (mode === 'text') payload.text = text
      else { payload.template_name = tplName; payload.language = selTpl?.language || 'id'; payload.template_params = buildParams() }

      if (rmode === 'contacts') {
        // kalau user pilih manual sebagian → kirim daftar; kalau "pilih semua" lewat segmen → biar server hitung
        payload.recipients = finalRecipients
        payload.recipient_mode = 'csv' // perlakukan sbg daftar eksplisit (snapshot pasti)
      } else {
        payload.recipients = finalRecipients
      }

      const res = await authFetch('/api/broadcast', { method: 'POST', body: JSON.stringify(payload) })
      const j = await res.json()
      if (!res.ok) { alert(j.error || 'Gagal'); return }
      alert(`Diajukan ✓ — ${j.eligible_count} penerima. Menunggu approval admin.`)
      // reset
      setStep(1); setText(''); setPicked({}); setCsvRows([]); setManual(''); setCsvInfo(''); setTplParams([]); setParamSrc([])
      setView('approval')
    } finally { setBusy(false) }
  }

  async function approve(id: string) {
    if (!confirm('Approve & kirim sekarang?')) return
    setActingId(id)
    try {
      const res = await authFetch(`/api/broadcast/${id}/approve`, { method: 'POST' }); const j = await res.json()
      if (!res.ok) { alert(j.error || 'Gagal'); return }
      alert(`Terkirim: ${j.sent} · Gagal: ${j.failed} (total ${j.total})`); loadPending()
    } finally { setActingId(null) }
  }
  async function reject(id: string) {
    const reason = prompt('Alasan tolak (opsional):') ?? ''
    setActingId(id)
    try {
      const res = await authFetch(`/api/broadcast/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) })
      if (!res.ok) { const j = await res.json(); alert(j.error || 'Gagal'); return }
      loadPending()
    } finally { setActingId(null) }
  }

  // Nilai final tiap variabel yang dikirim ke server.
  // 'nama' → token "{{nama|<fallback>}}" yang di-resolve per-penerima saat kirim.
  // 'manual' → teks tetap apa adanya.
  function buildParams(): string[] {
    return Array.from({ length: varCount }, (_, i) =>
      paramSrc[i] === 'nama'
        ? `{{nama|${nameFallback.trim() || 'Kak'}}}`
        : (tplParams[i] || ''))
  }
  // Contoh nama buat preview: nama kontak pertama yg ke-load, kalau gak ada pakai fallback.
  const sampleName = firstName(finalRecipients[0]?.name || contacts[0]?.name) || (nameFallback.trim() || 'Kak')
  const previewParams = Array.from({ length: varCount }, (_, i) =>
    paramSrc[i] === 'nama' ? sampleName : (tplParams[i] || `{{${i + 1}}}`))

  // Variabel dianggap "terisi" kalau sumbernya otomatis (nama) ATAU teks manual sudah diisi.
  const varsFilled = varCount === 0 || Array.from({ length: varCount }).every((_, i) =>
    paramSrc[i] === 'nama' || (tplParams[i] || '').trim().length > 0)
  const canNext1 = mode === 'text' ? text.trim().length >= 10 : (!!tplName && varsFilled)
  const canSend = recipientCount > 0 && !!waNumberId && !busy

  return (
    <div className="page-wrap" style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0D0D0D', letterSpacing: '-0.02em', marginBottom: 3 }}>Broadcast</h1>
        <p style={{ fontSize: 13, color: '#6B7280' }}>Susun pesan, pilih penerima, lalu ajukan. Broadcast dikirim setelah di-approve admin.</p>
      </div>

      {/* view switch */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 22, border: '1px solid #E5E5E5', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
        {[{ id: 'wizard', label: 'Buat Broadcast' }, { id: 'approval', label: 'Approval' }, { id: 'history', label: 'Riwayat' }].map(t => (
          <button key={t.id} onClick={() => setView(t.id as any)}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: view === t.id ? 600 : 400, background: view === t.id ? '#0D0D0D' : '#fff', color: view === t.id ? '#fff' : '#6B7280', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t.label}{t.id === 'approval' && pending.length > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: '#16A34A', color: '#fff', padding: '1px 6px', borderRadius: 999 }}>{pending.length}</span>}
          </button>
        ))}
      </div>

      {view === 'wizard' && (
        <>
          {/* Stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            {['Pesan', 'Penerima', 'Konfirmasi'].map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 999, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', background: step >= i + 1 ? '#16A34A' : '#F0F0F0', color: step >= i + 1 ? '#fff' : '#9CA3AF' }}>{i + 1}</div>
                  <span style={{ fontSize: 13, fontWeight: step === i + 1 ? 600 : 400, color: step >= i + 1 ? '#0D0D0D' : '#9CA3AF' }}>{s}</span>
                </div>
                {i < 2 && <div style={{ width: 28, height: 1, background: '#E5E5E5' }} />}
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, padding: 20 }}>
            {/* nomor pengirim */}
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Kirim dari nomor</label>
              <select value={waNumberId} onChange={e => setWaNumberId(e.target.value)} style={inp}>
                {numbers.length === 0 && <option value="">(belum ada nomor)</option>}
                {numbers.map(n => <option key={n.id} value={n.id}>{n.display_phone || n.phone_number_id}{n.label ? ` · ${n.label}` : ''}</option>)}
              </select>
            </div>

            {step === 1 && (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {[{ id: 'text', label: 'Teks bebas (dalam 24 jam)' }, { id: 'template', label: 'Template (luar 24 jam)' }].map(m => (
                    <div key={m.id} onClick={() => setMode(m.id as any)}
                      style={{ flex: 1, padding: '12px 14px', border: `1px solid ${mode === m.id ? '#16A34A' : '#E5E5E5'}`, borderRadius: 8, cursor: 'pointer', background: mode === m.id ? '#F0FDF4' : '#fff', fontSize: 13, fontWeight: 500, color: '#0D0D0D' }}>
                      {m.label}
                    </div>
                  ))}
                </div>

                {mode === 'text' ? (
                  <>
                    <label style={lbl}>Pesan</label>
                    <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder="Tulis pesan broadcast…" style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{text.length} karakter · min 10</div>
                  </>
                ) : (
                  <>
                    <label style={lbl}>Pilih template (APPROVED)</label>
                    {approvedTpls.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#9CA3AF', padding: '12px 0' }}>Belum ada template approved. Buat di menu Template dulu.</div>
                    ) : (
                      <select value={tplName} onChange={e => { setTplName(e.target.value); setTplParams([]) }} style={inp}>
                        <option value="">— pilih —</option>
                        {approvedTpls.map(t => <option key={t.name} value={t.name}>{t.name} — {t.category}</option>)}
                      </select>
                    )}
                    {selTpl && varCount > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <label style={lbl}>Isi variabel template</label>
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>
                          Template ini punya {varCount} variabel. Pilih <b>Nama kontak</b> biar otomatis terisi nama tiap penerima (per-orang), atau <b>Teks tetap</b> kalau mau satu nilai sama buat semua.
                        </div>
                        {Array.from({ length: varCount }).map((_, i) => (
                          <div key={i} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ fontSize: 12, color: '#6B7280', minWidth: 38 }}>{`{{${i + 1}}}`}</span>
                              <select
                                value={paramSrc[i] || 'manual'}
                                onChange={e => {
                                  const next = [...paramSrc]; next[i] = e.target.value as ParamSrc; setParamSrc(next)
                                }}
                                style={{ ...inp, maxWidth: 190, flexShrink: 0 }}>
                                <option value="nama">Nama kontak (otomatis)</option>
                                <option value="manual">Teks tetap</option>
                              </select>
                              {paramSrc[i] === 'nama' ? (
                                <span style={{ fontSize: 12, color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '7px 11px', borderRadius: 7, flex: 1 }}>
                                  Otomatis → nama depan tiap penerima
                                </span>
                              ) : (
                                <input
                                  value={tplParams[i] || ''}
                                  onChange={e => { const next = [...tplParams]; next[i] = e.target.value; setTplParams(next) }}
                                  placeholder={`Nilai untuk {{${i + 1}}}`}
                                  style={{ ...inp, flex: 1 }}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                        {paramSrc.some(s => s === 'nama') && (
                          <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>Kalau nama kosong, pakai:</span>
                            <input value={nameFallback} onChange={e => setNameFallback(e.target.value)} placeholder="Kak" style={{ ...inp, maxWidth: 140 }} />
                          </div>
                        )}
                      </div>
                    )}
                    {selTpl && (
                      <div style={{ marginTop: 12, padding: '12px 14px', background: '#FAFAFA', border: '1px solid #F0F0F0', borderRadius: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', marginBottom: 6, letterSpacing: '0.05em' }}>PREVIEW{paramSrc.some(s => s === 'nama') ? ` · contoh "${sampleName}"` : ''}</div>
                        <div style={{ fontSize: 13, color: '#0D0D0D', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{renderTpl(bodyOfTpl(selTpl), previewParams)}</div>
                      </div>
                    )}
                  </>
                )}

                <div style={{ marginTop: 16 }}>
                  <label style={lbl}>Kategori</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inp, maxWidth: 240 }}>
                    <option value="MARKETING">MARKETING</option>
                    <option value="UTILITY">UTILITY</option>
                  </select>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div style={{ display: 'flex', gap: 0, marginBottom: 16, border: '1px solid #E5E5E5', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
                  {[{ id: 'contacts', label: 'Dari Kontak' }, { id: 'csv', label: 'Upload CSV/Excel' }, { id: 'manual', label: 'Manual' }].map(m => (
                    <button key={m.id} onClick={() => setRmode(m.id as any)}
                      style={{ padding: '8px 16px', fontSize: 13, fontWeight: rmode === m.id ? 600 : 400, background: rmode === m.id ? '#0D0D0D' : '#fff', color: rmode === m.id ? '#fff' : '#6B7280', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {m.label}
                    </button>
                  ))}
                </div>

                {rmode === 'contacts' && (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama / nomor…" style={{ ...inp, flex: 1, minWidth: 180 }} />
                      <select value={segment} onChange={e => setSegment(e.target.value as any)} style={{ ...inp, maxWidth: 150 }}>
                        <option value="all">Semua segmen</option>
                        <option value="loyal">Loyal</option>
                        <option value="new">New</option>
                      </select>
                      <button onClick={toggleAll} style={{ padding: '9px 14px', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                        {pickedCount === filtered.length && filtered.length > 0 ? 'Batal pilih' : `Pilih semua (${filtered.length})`}
                      </button>
                    </div>
                    <label onClick={() => setEngagedOnly(v => !v)} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, cursor: 'pointer', fontSize: 12, color: '#6B7280' }}>
                      <span style={{ width: 15, height: 15, borderRadius: 4, background: engagedOnly ? '#0D0D0D' : '#fff', border: engagedOnly ? 'none' : '1.5px solid #D4D4D4', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        {engagedOnly && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </span>
                      Hanya kontak aktif 60 hari (disarankan, biar quality rating aman)
                    </label>
                    <div style={{ border: '1px solid #E5E5E5', borderRadius: 8, maxHeight: 320, overflowY: 'auto' }}>
                      {filtered.length === 0 ? (
                        <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>Tidak ada kontak.</div>
                      ) : filtered.map(c => (
                        <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid #F7F7F7', cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!picked[c.id]} onChange={e => setPicked(p => ({ ...p, [c.id]: e.target.checked }))} />
                          <span style={{ flex: 1, fontSize: 13, color: '#0D0D0D' }}>{c.name || c.phone}</span>
                          <span style={{ fontSize: 12, color: '#9CA3AF' }}>{c.phone}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 999, color: c.segment === 'loyal' ? '#15803D' : '#6D28D9', background: c.segment === 'loyal' ? '#F0FDF4' : '#F5F3FF', border: `1px solid ${c.segment === 'loyal' ? '#BBF7D0' : '#DDD6FE'}` }}>{c.segment === 'loyal' ? 'Loyal' : 'New'}</span>
                        </label>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>Dipilih: <b>{pickedCount}</b> nomor</div>
                  </>
                )}

                {rmode === 'csv' && (
                  <div>
                    <div onClick={() => fileRef.current?.click()} style={{ border: '1.5px dashed #D4D4D4', borderRadius: 10, padding: '28px 16px', textAlign: 'center', cursor: 'pointer', background: '#FAFAFA' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D', marginBottom: 4 }}>Klik untuk pilih file CSV / Excel</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF' }}>Kolom <b>nomor</b> (phone/nomor/hp) &amp; <b>nama</b> (nama/name) otomatis dideteksi. Kalau ada kolom nama, variabel template bisa keisi otomatis per-orang.</div>
                    </div>
                    <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                    {csvInfo && <div style={{ marginTop: 10, fontSize: 13, color: csvRows.length ? '#15803D' : '#B45309' }}>{csvInfo}</div>}
                  </div>
                )}

                {rmode === 'manual' && (
                  <div>
                    <label style={lbl}>Tempel nomor (pisahkan baris / koma)</label>
                    <textarea value={manual} onChange={e => setManual(e.target.value)} rows={6} placeholder={'08123456789\n08987654321\n628111222333'} style={{ ...inp, resize: 'vertical', fontFamily: 'monospace' }} />
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>Terbaca: <b>{finalRecipients.length}</b> nomor valid</div>
                  </div>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <div className="grid-4" style={{ marginBottom: 18 }}>
                  <Box label="PENERIMA" value={String(recipientCount)} />
                  <Box label="KATEGORI" value={category} />
                  <Box label="BIAYA / PESAN" value={fmtRp(COST_PER_MSG)} />
                  <Box label="TOTAL EST." value={fmtRp(recipientCount * COST_PER_MSG)} accent />
                </div>
                <div style={{ padding: '12px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 12, color: '#15803D', marginBottom: 16 }}>
                  Penerima opt-out otomatis dibuang. Broadcast ini masuk antrian <b>approval</b> dulu — admin yang menekan kirim.
                </div>
                <div style={{ padding: '12px 14px', background: '#FAFAFA', border: '1px solid #F0F0F0', borderRadius: 8, fontSize: 13, color: '#0D0D0D', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {mode === 'text' ? text : `Template: ${tplName}\n\n${renderTpl(bodyOfTpl(selTpl), previewParams)}`}
                </div>
              </>
            )}

            {/* nav */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, borderTop: '1px solid #F0F0F0', paddingTop: 16 }}>
              <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} style={{ ...btnGhost, opacity: step === 1 ? 0.4 : 1 }}>← Kembali</button>
              {step < 3 ? (
                <button onClick={() => setStep(s => s + 1)} disabled={step === 1 ? !canNext1 : recipientCount === 0}
                  style={{ padding: '9px 22px', background: (step === 1 ? canNext1 : recipientCount > 0) ? '#0D0D0D' : '#F0F0F0', color: (step === 1 ? canNext1 : recipientCount > 0) ? '#fff' : '#9CA3AF', border: 'none', borderRadius: 7, fontWeight: 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Lanjut →
                </button>
              ) : (
                <button onClick={submit} disabled={!canSend}
                  style={{ padding: '9px 24px', background: !canSend ? '#F0F0F0' : '#16A34A', color: !canSend ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: !canSend ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {busy ? 'Mengajukan…' : `Ajukan broadcast (${recipientCount})`}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {view === 'approval' && (
        <div>
          {!isAdmin && <div style={{ marginBottom: 12, padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 12, color: '#92400E' }}>Kamu bukan admin — tombol approve/reject nonaktif.</div>}
          {pending.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 13, color: '#9CA3AF', background: '#FAFAFA', borderRadius: 10, border: '1px solid #F0F0F0' }}>Tidak ada broadcast menunggu approval.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pending.map(c => (
                <div key={c.id} style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', padding: '2px 8px', borderRadius: 999 }}>MENUNGGU APPROVAL · {c.category}</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{fmtDate(c.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#0D0D0D', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: 10, padding: '10px 12px', background: '#FAFAFA', borderRadius: 8, border: '1px solid #F0F0F0' }}>{c.template_name ? `Template: ${c.template_name}` : c.body}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>Penerima: <b style={{ color: '#0D0D0D' }}>{c.total}</b> · Est. {fmtRp(c.total * COST_PER_MSG)}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => reject(c.id)} disabled={!isAdmin || actingId === c.id} style={{ padding: '7px 14px', background: '#fff', color: !isAdmin ? '#D4D4D4' : '#DC2626', border: `1px solid ${!isAdmin ? '#F0F0F0' : '#FECACA'}`, borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: !isAdmin ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Tolak</button>
                      <button onClick={() => approve(c.id)} disabled={!isAdmin || actingId === c.id} style={{ padding: '7px 16px', background: !isAdmin ? '#F0F0F0' : '#16A34A', color: !isAdmin ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: !isAdmin ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{actingId === c.id ? 'Mengirim…' : 'Approve & Kirim'}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'history' && (
        history.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 13, color: '#9CA3AF', background: '#FAFAFA', borderRadius: 10, border: '1px solid #F0F0F0' }}>Belum ada riwayat.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(c => (
              <div key={c.id} style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, color: '#0D0D0D', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 12 }}>{c.template_name ? `Template: ${c.template_name}` : c.body}</div>
                  <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{fmtDate(c.created_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
                  {c.status === 'rejected'
                    ? <span style={{ color: '#DC2626', fontWeight: 600 }}>✕ Ditolak{c.reject_reason ? ` · ${c.reject_reason}` : ''}</span>
                    : <><span style={{ color: '#15803D', fontWeight: 600 }}>✓ {c.sent} terkirim</span>{c.failed > 0 && <span style={{ color: '#DC2626', fontWeight: 600 }}>✕ {c.failed} gagal</span>}<span style={{ color: '#9CA3AF' }}>dari {c.total}</span></>}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

function Box({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 10, background: accent ? '#F0FDF4' : '#FAFAFA', border: `1px solid ${accent ? '#BBF7D0' : '#F0F0F0'}` }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: accent ? '#15803D' : '#0D0D0D', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: '#374151', marginBottom: 6, fontWeight: 500 }
const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, color: '#0D0D0D', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
const btnGhost: React.CSSProperties = { padding: '9px 16px', background: '#fff', color: '#6B7280', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
