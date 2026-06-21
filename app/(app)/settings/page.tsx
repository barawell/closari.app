'use client'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/client-fetch'

export default function SettingsPage() {
  const [cfg, setCfg] = useState<any>({
    enabled: false, persona_name: '', system_prompt: '',
    model: 'claude-haiku-4-5', cooldown_min: 0,
  })
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
    <div style={{ padding: '32px 40px', maxWidth: 640 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: 4 }}>AI & Setelan</h1>
        <p style={{ fontSize: 14, color: '#64748B' }}>Konfigurasi AI auto-reply dan persona untuk workspace ini.</p>
      </div>

      {/* Toggle AI */}
      <div style={{
        background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16,
        padding: 20, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>AI Auto-reply</div>
            <div style={{ fontSize: 13, color: '#64748B' }}>AI membalas pesan masuk secara otomatis sesuai persona yang dikonfigurasi.</div>
          </div>
          <div
            onClick={() => setCfg({ ...cfg, enabled: !cfg.enabled })}
            style={{
              width: 44, height: 24, borderRadius: 999, cursor: 'pointer', flexShrink: 0,
              background: cfg.enabled ? '#0A0F1E' : '#E2E8F0',
              position: 'relative', transition: 'background 0.2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 3, left: cfg.enabled ? 23 : 3,
              width: 18, height: 18, borderRadius: '50%',
              background: cfg.enabled ? '#00D97E' : '#fff',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
        </div>
      </div>

      {/* Config */}
      <div style={{
        background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16,
        padding: 24, marginBottom: 16,
      }}>
        <div style={{ marginBottom: 18 }}>
          <label style={lbl}>Nama persona</label>
          <input
            value={cfg.persona_name || ''}
            onChange={e => setCfg({ ...cfg, persona_name: e.target.value })}
            placeholder="mis. Ara"
            style={inp}
          />
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
            Nama yang dipakai AI saat memperkenalkan diri ke customer.
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={lbl}>System prompt</label>
          <textarea
            value={cfg.system_prompt || ''}
            onChange={e => setCfg({ ...cfg, system_prompt: e.target.value })}
            rows={6}
            placeholder="Kamu CS yang ramah untuk [nama bisnis]. Jawab singkat dalam Bahasa Indonesia. Jika tidak tahu, arahkan ke tim manusia…"
            style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Model AI</label>
            <input
              value={cfg.model || ''}
              onChange={e => setCfg({ ...cfg, model: e.target.value })}
              style={inp}
            />
          </div>
          <div style={{ width: 160 }}>
            <label style={lbl}>Cooldown (menit)</label>
            <input
              type="number" min={0}
              value={cfg.cooldown_min ?? 0}
              onChange={e => setCfg({ ...cfg, cooldown_min: e.target.value })}
              style={inp}
            />
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
              Jeda antar auto-reply per kontak.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={save} disabled={busy}
          style={{
            padding: '11px 24px',
            background: busy ? '#F1F5F9' : '#0A0F1E',
            color: busy ? '#CBD5E1' : '#fff',
            border: 0, borderRadius: 8, fontWeight: 700, fontSize: 14,
            cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {busy ? 'Menyimpan…' : 'Simpan perubahan'}
        </button>
        {saved && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: '#065F46', fontWeight: 500,
          }}>
            <span style={{ color: '#00D97E' }}>✓</span> Tersimpan
          </div>
        )}
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 13, color: '#374151', marginBottom: 6, fontWeight: 500 }
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  border: '1px solid #E2E8F0', borderRadius: 8,
  fontSize: 14, color: '#0F172A', background: '#F8FAFC',
  boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none',
}
