'use client'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'

export default function SettingsPage() {
  const [cfg, setCfg] = useState<any>({ enabled: false, persona_name: '', system_prompt: '', model: 'claude-haiku-4-5', cooldown_min: 0 })
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    (async () => {
      const res = await authFetch('/api/ai-config')
      const j = await res.json()
      setCfg({ ...cfg, ...j.config })
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save() {
    setBusy(true); setSaved(false)
    try {
      const res = await authFetch('/api/ai-config', { method: 'PUT', body: JSON.stringify(cfg) })
      if (res.ok) setSaved(true)
    } finally { setBusy(false) }
  }

  return (
    <div style={{ padding: 32, maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>AI & Setelan</h1>

      <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, fontSize: 15 }}>
        <input type="checkbox" checked={!!cfg.enabled} onChange={e => setCfg({ ...cfg, enabled: e.target.checked })} />
        <b>Aktifkan AI auto-reply</b>
      </label>

      <label style={lbl}>Nama persona</label>
      <input value={cfg.persona_name || ''} onChange={e => setCfg({ ...cfg, persona_name: e.target.value })} placeholder="mis. Bara" style={inp} />

      <label style={lbl}>System prompt (instruksi AI)</label>
      <textarea value={cfg.system_prompt || ''} onChange={e => setCfg({ ...cfg, system_prompt: e.target.value })} rows={6}
        placeholder="Kamu CS yang ramah… jawab singkat dalam Bahasa Indonesia…" style={{ ...inp, resize: 'vertical' }} />

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Model</label>
          <input value={cfg.model || ''} onChange={e => setCfg({ ...cfg, model: e.target.value })} style={inp} />
        </div>
        <div style={{ width: 160 }}>
          <label style={lbl}>Cooldown (menit)</label>
          <input type="number" value={cfg.cooldown_min ?? 0} onChange={e => setCfg({ ...cfg, cooldown_min: e.target.value })} style={inp} />
        </div>
      </div>

      <button onClick={save} disabled={busy} style={{ marginTop: 18, padding: '11px 20px', background: '#111', color: '#fff', border: 0, borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
        {busy ? '...' : 'Simpan'}
      </button>
      {saved && <span style={{ marginLeft: 12, color: '#070', fontSize: 14 }}>Tersimpan ✓</span>}
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 13, color: '#666', marginBottom: 6, marginTop: 12 }
const inp: React.CSSProperties = { width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }
