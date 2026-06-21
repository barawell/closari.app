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
      setCfg((prev: any) => ({ ...prev, ...j.config }))
    })()
  }, [])

  async function save() {
    setBusy(true); setSaved(false)
    try {
      const res = await authFetch('/api/ai-config', { method: 'PUT', body: JSON.stringify(cfg) })
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    } finally { setBusy(false) }
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 600 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0D0D0D', letterSpacing: '-0.02em', marginBottom: 3 }}>AI & Setelan</h1>
        <p style={{ fontSize: 13, color: '#6B7280' }}>Konfigurasi AI auto-reply dan persona untuk workspace ini.</p>
      </div>

      {/* Toggle */}
      <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, padding: '16px 18px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D', marginBottom: 2 }}>AI Auto-reply</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>AI membalas pesan masuk secara otomatis sesuai persona.</div>
        </div>
        <div
          onClick={() => setCfg({ ...cfg, enabled: !cfg.enabled })}
          style={{
            width: 40, height: 22, borderRadius: 999, cursor: 'pointer', flexShrink: 0, position: 'relative',
            background: cfg.enabled ? '#0D0D0D' : '#E5E5E5', transition: 'background 0.2s',
          }}
        >
          <div style={{
            position: 'absolute', top: 3, left: cfg.enabled ? 21 : 3,
            width: 16, height: 16, borderRadius: '50%', background: cfg.enabled ? '#16A34A' : '#fff',
            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          }} />
        </div>
      </div>

      {/* Config */}
      <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, padding: '18px 18px', marginBottom: 14 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Nama persona</label>
          <input value={cfg.persona_name || ''} onChange={e => setCfg({ ...cfg, persona_name: e.target.value })} placeholder="mis. Ara" style={inp} />
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Nama yang digunakan AI saat berinteraksi dengan customer.</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>System prompt</label>
          <textarea value={cfg.system_prompt || ''} onChange={e => setCfg({ ...cfg, system_prompt: e.target.value })} rows={5}
            placeholder="Kamu CS yang ramah untuk [nama bisnis]. Jawab singkat dalam Bahasa Indonesia. Jika tidak tahu, arahkan ke tim manusia."
            style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Model AI</label>
            <input value={cfg.model || ''} onChange={e => setCfg({ ...cfg, model: e.target.value })} style={inp} />
          </div>
          <div style={{ width: 150 }}>
            <label style={lbl}>Cooldown (menit)</label>
            <input type="number" min={0} value={cfg.cooldown_min ?? 0} onChange={e => setCfg({ ...cfg, cooldown_min: e.target.value })} style={inp} />
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Jeda antar auto-reply per kontak.</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={save} disabled={busy} style={{ padding: '9px 20px', background: busy ? '#F0F0F0' : '#0D0D0D', color: busy ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontWeight: 500, fontSize: 13, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {busy ? 'Menyimpan…' : 'Simpan perubahan'}
        </button>
        {saved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#15803D', fontWeight: 500 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" fill="#16A34A"/>
              <path d="M4.5 7L6.5 9L9.5 5.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Tersimpan
          </div>
        )}
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: '#374151', marginBottom: 6, fontWeight: 500 }
const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, color: '#0D0D0D', background: '#F7F7F7', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
