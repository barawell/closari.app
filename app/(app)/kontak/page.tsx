'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'
import { BrandLoader } from '@/app/Loader'

type Contact = { id: string; phone: string; name?: string; segment: 'loyal' | 'new'; opted_out?: boolean }

export default function KontakPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [segment, setSegment] = useState<'all' | 'loyal' | 'new'>('all')
  const [search, setSearch] = useState('')

  // import
  const [importing, setImporting] = useState(false)
  const [importInfo, setImportInfo] = useState('')
  const [preview, setPreview] = useState<{ phone: string; name?: string }[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [segment])

  async function load() {
    setLoading(true)
    const params = new URLSearchParams({ segment })
    const res = await authFetch(`/api/contacts/list?${params}`)
    const j = await res.json()
    setContacts(j.contacts || [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter(c => (c.name || '').toLowerCase().includes(q) || c.phone.includes(q))
  }, [contacts, search])

  const stats = useMemo(() => ({
    total: contacts.length,
    loyal: contacts.filter(c => c.segment === 'loyal').length,
    optout: contacts.filter(c => c.opted_out).length,
  }), [contacts])

  // ── Parse file → preview ───────────────────────────────────────────
  async function handleFile(f: File) {
    setImportInfo('Memproses…'); setPreview([])
    try {
      const ext = f.name.split('.').pop()?.toLowerCase()
      let rows: { phone: string; name?: string }[] = []
      if (ext === 'csv') {
        rows = parseCsvRows(await f.text())
      } else if (ext === 'xlsx' || ext === 'xls') {
        const XLSX = await import('xlsx')
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const arr: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 })
        rows = rowsFromMatrix(arr)
      } else { setImportInfo('Format tidak didukung. Pakai .csv / .xlsx'); return }

      // dedupe by phone
      const map = new Map<string, { phone: string; name?: string }>()
      for (const r of rows) { const p = digits(r.phone); if (p.length >= 9) map.set(p, { phone: p, name: r.name }) }
      const uniq = Array.from(map.values())
      setPreview(uniq)
      setImportInfo(`${uniq.length} nomor valid terbaca dari ${f.name}`)
    } catch (e: any) {
      setImportInfo('Gagal baca file: ' + (e?.message || 'error') + ' (Excel butuh: npm i xlsx)')
    }
  }
  function digits(s: any) { return String(s ?? '').replace(/\D/g, '') }
  function parseCsvRows(txt: string): { phone: string; name?: string }[] {
    const lines = txt.split(/\r?\n/).filter(Boolean)
    if (!lines.length) return []
    // deteksi header
    const head = lines[0].toLowerCase()
    const hasHeader = /phone|nomor|hp|no|name|nama/.test(head)
    const body = hasHeader ? lines.slice(1) : lines
    const cols = hasHeader ? head.split(/[,;\t]/).map(s => s.trim()) : []
    const phoneIdx = cols.findIndex(c => /phone|nomor|hp|no/.test(c))
    const nameIdx = cols.findIndex(c => /name|nama/.test(c))
    return body.map(line => {
      const cells = line.split(/[,;\t]/)
      if (hasHeader && phoneIdx >= 0) return { phone: cells[phoneIdx] || '', name: nameIdx >= 0 ? cells[nameIdx] : undefined }
      // tanpa header: tebak kolom pertama nomor
      const phoneCell = cells.find(c => digits(c).length >= 9) || cells[0]
      const nameCell = cells.find(c => digits(c).length < 9 && c.trim() && c !== phoneCell)
      return { phone: phoneCell || '', name: nameCell }
    }).filter(r => digits(r.phone).length >= 9)
  }
  function rowsFromMatrix(arr: any[]): { phone: string; name?: string }[] {
    if (!arr.length) return []
    const first = (arr[0] || []).map((x: any) => String(x).toLowerCase())
    const hasHeader = first.some((c: string) => /phone|nomor|hp|name|nama/.test(c))
    const phoneIdx = hasHeader ? first.findIndex((c: string) => /phone|nomor|hp|no/.test(c)) : -1
    const nameIdx = hasHeader ? first.findIndex((c: string) => /name|nama/.test(c)) : -1
    const body = hasHeader ? arr.slice(1) : arr
    return body.map((row: any[]) => {
      if (hasHeader && phoneIdx >= 0) return { phone: String(row[phoneIdx] ?? ''), name: nameIdx >= 0 ? String(row[nameIdx] ?? '') : undefined }
      const phoneCell = (row || []).map(String).find((c: string) => digits(c).length >= 9) || String(row?.[0] ?? '')
      const nameCell = (row || []).map(String).find((c: string) => digits(c).length < 9 && c.trim() && c !== phoneCell)
      return { phone: phoneCell, name: nameCell }
    }).filter(r => digits(r.phone).length >= 9)
  }

  async function doImport() {
    if (!preview.length) return
    setImporting(true)
    try {
      const res = await authFetch('/api/contacts/import', { method: 'POST', body: JSON.stringify({ contacts: preview }) })
      const j = await res.json()
      if (!res.ok) { alert(j.error || 'Gagal import'); return }
      alert(`Import selesai: ${j.imported} kontak${j.invalid ? ` · ${j.invalid} dilewati` : ''}`)
      setPreview([]); setImportInfo(''); if (fileRef.current) fileRef.current.value = ''
      load()
    } finally { setImporting(false) }
  }

  async function toggleOptout(c: Contact) {
    const next = !c.opted_out
    setContacts(prev => prev.map(x => x.id === c.id ? { ...x, opted_out: next } : x))
    await authFetch(`/api/contacts/${c.id}`, { method: 'PUT', body: JSON.stringify({ opted_out: next }) })
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 880 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0D0D0D', letterSpacing: '-0.02em', marginBottom: 3 }}>Kontak</h1>
        <p style={{ fontSize: 13, color: '#6B7280' }}>Kelola daftar kontak & import massal dari CSV/Excel untuk broadcast.</p>
      </div>

      {/* stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Total kontak" value={stats.total} />
        <Stat label="Loyal" value={stats.loyal} accent />
        <Stat label="Opt-out" value={stats.optout} danger />
      </div>

      {/* import card */}
      <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, padding: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0D0D0D', marginBottom: 4 }}>Import kontak</div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>File CSV / Excel. Kolom <b>phone/nomor/hp</b> (wajib) & <b>name/nama</b> (opsional) otomatis dideteksi.</div>
        <div onClick={() => fileRef.current?.click()} style={{ border: '1.5px dashed #D4D4D4', borderRadius: 10, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', background: '#FAFAFA' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D', marginBottom: 2 }}>Klik untuk pilih file .csv / .xlsx</div>
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>Nomor 08… / 62… otomatis dinormalisasi ke 62…</div>
        </div>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        {importInfo && <div style={{ marginTop: 10, fontSize: 13, color: preview.length ? '#15803D' : '#B45309' }}>{importInfo}</div>}
        {preview.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: '#6B7280' }}>Siap import <b style={{ color: '#0D0D0D' }}>{preview.length}</b> kontak (duplikat ditimpa).</div>
            <button onClick={doImport} disabled={importing} style={{ padding: '9px 20px', background: importing ? '#F0F0F0' : '#16A34A', color: importing ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{importing ? 'Mengimport…' : `Import ${preview.length} kontak`}</button>
          </div>
        )}
      </div>

      {/* filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama / nomor…" style={{ ...inp, flex: 1, minWidth: 200 }} />
        <select value={segment} onChange={e => setSegment(e.target.value as any)} style={{ ...inp, maxWidth: 160 }}>
          <option value="all">Semua segmen</option>
          <option value="loyal">Loyal</option>
          <option value="new">New</option>
        </select>
      </div>

      {/* list */}
      <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <BrandLoader />
        ) : filtered.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>Belum ada kontak. Import dari CSV/Excel di atas.</div>
        ) : (
          <>
            <div style={{ display: 'flex', padding: '10px 16px', borderBottom: '1px solid #F0F0F0', fontSize: 11, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.03em' }}>
              <div style={{ flex: 1 }}>NAMA</div>
              <div style={{ width: 160 }}>NOMOR</div>
              <div style={{ width: 70 }}>SEGMEN</div>
              <div style={{ width: 90, textAlign: 'right' }}>STATUS</div>
            </div>
            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
              {filtered.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid #F7F7F7' }}>
                  <div style={{ flex: 1, fontSize: 13, color: '#0D0D0D' }}>{c.name || <span style={{ color: '#9CA3AF' }}>—</span>}</div>
                  <div style={{ width: 160, fontSize: 13, color: '#6B7280' }}>{c.phone}</div>
                  <div style={{ width: 70 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 999, color: c.segment === 'loyal' ? '#15803D' : '#6D28D9', background: c.segment === 'loyal' ? '#F0FDF4' : '#F5F3FF', border: `1px solid ${c.segment === 'loyal' ? '#BBF7D0' : '#DDD6FE'}` }}>{c.segment === 'loyal' ? 'Loyal' : 'New'}</span>
                  </div>
                  <div style={{ width: 90, textAlign: 'right' }}>
                    <button onClick={() => toggleOptout(c)} title="Klik untuk ubah status langganan"
                      style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                        color: c.opted_out ? '#DC2626' : '#15803D', background: c.opted_out ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${c.opted_out ? '#FECACA' : '#BBF7D0'}` }}>
                      {c.opted_out ? 'Opt-out' : 'Aktif'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 10 }}>Menampilkan {filtered.length} dari {contacts.length} kontak.</div>
    </div>
  )
}

function Stat({ label, value, accent, danger }: { label: string; value: number; accent?: boolean; danger?: boolean }) {
  const color = danger ? '#DC2626' : accent ? '#15803D' : '#0D0D0D'
  const bg = danger ? '#FEF2F2' : accent ? '#F0FDF4' : '#FAFAFA'
  const bd = danger ? '#FECACA' : accent ? '#BBF7D0' : '#F0F0F0'
  return (
    <div style={{ padding: '14px 16px', borderRadius: 10, background: bg, border: `1px solid ${bd}` }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{label}</div>
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, color: '#0D0D0D', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
