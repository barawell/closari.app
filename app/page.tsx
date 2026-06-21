import Link from 'next/link'

const features = [
  {
    tag: 'AI Copilot',
    headline: 'AI baca konteks, kamu tetap pegang kendali.',
    desc: 'Copilot analisis maksud customer & saran balasan real-time — bukan auto-reply buta yang bikin pelanggan frustrasi.',
  },
  {
    tag: 'Shared Inbox',
    headline: 'Satu inbox, seluruh tim, semua nomor.',
    desc: 'Banyak agen bisa balas dari satu tampilan. Tidak ada pesan terlewat, tidak ada dobel balas.',
  },
  {
    tag: 'Broadcast Aman',
    headline: 'Blast tanpa takut quality rating turun.',
    desc: 'Opt-out otomatis, filter kontak aktif, rate yang Meta-friendly. Dibangun oleh tim yang pernah kena banned.',
  },
  {
    tag: 'Multi-nomor',
    headline: 'Semua nomor, satu dashboard.',
    desc: 'Connect banyak nomor WA Business resmi lewat Embedded Signup. Pisahkan brand, satukan operasi.',
  },
  {
    tag: 'Knowledge Base',
    headline: 'AI jawab dari info produkmu sendiri.',
    desc: 'Feed konteks produk ke AI — makin lama makin relevan, makin jarang eskalasi ke manusia.',
  },
  {
    tag: 'Compliance-first',
    headline: 'Guardrail anti-spam dari hari pertama.',
    desc: 'Cooldown, engaged-only filter, dan audit trail built-in. Nomor kamu tetap sehat, bisnis tetap jalan.',
  },
]

const steps = [
  { n: '01', label: 'Connect nomor', desc: 'Hubungkan nomor WA Business resmi dalam 2 menit lewat Embedded Signup.' },
  { n: '02', label: 'Invite tim', desc: 'Tambah agen CS ke workspace. Semua langsung bisa akses inbox.' },
  { n: '03', label: 'Aktifkan AI', desc: 'Set persona & system prompt. Copilot langsung aktif di setiap percakapan.' },
]

export default function Landing() {
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#0F172A', background: '#F0FDF4' }}>

      {/* NAV */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,15,30,0.96)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #1E293B',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#fff', letterSpacing: '-0.03em' }}>
            Clos<span style={{ color: '#00D97E' }}>ari</span>
          </div>
          <nav style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href="#fitur" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: 14, padding: '6px 12px' }}>Fitur</a>
            <a href="#cara-kerja" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: 14, padding: '6px 12px' }}>Cara kerja</a>
            <Link href="/login" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: 14, padding: '6px 12px' }}>Masuk</Link>
            <Link href="/login" style={{
              background: '#00D97E', color: '#0A0F1E', padding: '8px 18px',
              borderRadius: 999, textDecoration: 'none', fontSize: 14, fontWeight: 700,
            }}>Coba gratis</Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section style={{ background: '#0A0F1E', padding: '100px 24px 90px', textAlign: 'center' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#00D97E18', border: '1px solid #00D97E44',
            color: '#00D97E', padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, marginBottom: 32,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D97E', display: 'inline-block' }} />
            Platform WhatsApp Business + AI
          </div>

          <h1 style={{
            fontSize: 58, lineHeight: 1.08, fontWeight: 800,
            letterSpacing: '-0.04em', color: '#fff', marginBottom: 24,
          }}>
            CS WhatsApp yang dibantu AI,{' '}
            <br />
            <span style={{ position: 'relative', display: 'inline-block' }}>
              <span style={{
                color: '#EF4444', textDecoration: 'line-through',
                textDecorationColor: '#EF444488', textDecorationThickness: 3,
              }}>takut banned</span>
            </span>
            {' '}sudah{' '}
            <span style={{ color: '#00D97E' }}>lewat.</span>
          </h1>

          <p style={{ fontSize: 18, color: '#94A3B8', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 40px' }}>
            Closari gabungkan shared inbox, AI copilot, dan broadcast yang compliant —
            biar tim kamu balas lebih cepat dan nomor tetap sehat.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" style={{
              background: '#00D97E', color: '#0A0F1E', padding: '14px 32px',
              borderRadius: 999, textDecoration: 'none', fontSize: 16, fontWeight: 700,
            }}>Mulai gratis</Link>
            <a href="#fitur" style={{
              background: 'transparent', color: '#fff', border: '1px solid #1E293B',
              padding: '14px 32px', borderRadius: 999, textDecoration: 'none', fontSize: 16, fontWeight: 600,
            }}>Lihat fitur</a>
          </div>
        </div>

        {/* MOCK INBOX PREVIEW */}
        <div style={{
          maxWidth: 860, margin: '64px auto 0',
          background: '#111827', borderRadius: 16,
          border: '1px solid #1E293B',
          overflow: 'hidden',
          boxShadow: '0 40px 80px #00000066',
        }}>
          {/* window chrome */}
          <div style={{ background: '#0A0F1E', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #1E293B' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#00D97E' }} />
            <span style={{ marginLeft: 12, fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>closari.id/inbox</span>
          </div>
          {/* mock inbox body */}
          <div style={{ display: 'flex', height: 320 }}>
            {/* sidebar */}
            <div style={{ width: 220, borderRight: '1px solid #1E293B', padding: 12 }}>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Percakapan</div>
              {[
                { name: 'Budi Santoso', msg: 'Mau tanya soal harga...', time: '2m', active: true },
                { name: 'Rina Dewi', msg: 'Pesanan udah dikirim?', time: '15m', active: false },
                { name: 'Ahmad Fauzi', msg: 'Ok makasih kak!', time: '1j', active: false },
              ].map((c) => (
                <div key={c.name} style={{
                  padding: '8px 10px', borderRadius: 8, marginBottom: 4,
                  background: c.active ? '#1E293B' : 'transparent',
                  cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0' }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: '#475569' }}>{c.time}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.msg}</div>
                </div>
              ))}
            </div>
            {/* chat */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', marginBottom: 16 }}>Budi Santoso <span style={{ color: '#475569', fontWeight: 400' }}>· 6281234567890</span></div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ alignSelf: 'flex-start', background: '#1E293B', color: '#CBD5E1', padding: '8px 12px', borderRadius: 10, fontSize: 13, maxWidth: '70%' }}>
                  Halo kak, mau tanya soal harga paket premium dong
                </div>
                <div style={{ alignSelf: 'flex-end', background: '#00D97E18', border: '1px solid #00D97E33', color: '#A7F3D0', padding: '8px 12px', borderRadius: 10, fontSize: 13, maxWidth: '70%' }}>
                  <div style={{ fontSize: 10, color: '#00D97E', marginBottom: 4, fontWeight: 600 }}>✨ Saran AI</div>
                  Halo Kak Budi! Paket Premium Closari mulai dari Rp299rb/bln, include unlimited nomor & AI copilot. Mau aku kirim detail lengkapnya?
                </div>
              </div>
              <div style={{ marginTop: 12, background: '#1E293B', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#475569' }}>
                Tulis balasan…
              </div>
            </div>
            {/* copilot */}
            <div style={{ width: 200, borderLeft: '1px solid #1E293B', padding: 12 }}>
              <div style={{ fontSize: 11, color: '#00D97E', fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                ✨ Copilot
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Maksud</div>
              <div style={{ fontSize: 12, color: '#94A3B8', background: '#1E293B', padding: 8, borderRadius: 6, marginBottom: 10 }}>
                Tanya harga paket
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Saran</div>
              <div style={{ fontSize: 12, color: '#A7F3D0', background: '#00D97E11', border: '1px solid #00D97E22', padding: 8, borderRadius: 6 }}>
                Kirim info harga + CTA demo
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="fitur" style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#00D97E', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Fitur</div>
          <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', color: '#0F172A' }}>
            Semua yang kamu butuhkan,<br />tidak lebih, tidak kurang.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {features.map((f) => (
            <div key={f.tag} style={{
              background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16,
              padding: '28px 28px 24px', transition: 'border-color 0.2s, box-shadow 0.2s',
            }}>
              <div style={{
                display: 'inline-block', fontSize: 11, fontWeight: 700,
                color: '#00D97E', background: '#F0FDF4', border: '1px solid #BBF7D0',
                padding: '3px 10px', borderRadius: 999, letterSpacing: '0.06em',
                textTransform: 'uppercase', marginBottom: 14,
              }}>{f.tag}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 8, lineHeight: 1.3, letterSpacing: '-0.02em' }}>{f.headline}</h3>
              <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="cara-kerja" style={{ background: '#0A0F1E', padding: '96px 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#00D97E', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Cara kerja</div>
          <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', marginBottom: 56 }}>
            Dari nol ke jalan dalam 10 menit.
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {steps.map((s, i) => (
              <div key={s.n} style={{ display: 'flex', gap: 24, alignItems: 'flex-start', textAlign: 'left', position: 'relative', paddingBottom: i < steps.length - 1 ? 40 : 0 }}>
                {i < steps.length - 1 && (
                  <div style={{ position: 'absolute', left: 20, top: 44, width: 1, height: 'calc(100% - 4px)', background: '#1E293B' }} />
                )}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', background: '#00D97E18',
                  border: '1px solid #00D97E44', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, color: '#00D97E', flexShrink: 0,
                }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: '#F0FDF4', padding: '96px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-0.03em', color: '#0F172A', marginBottom: 16 }}>
            Siap jaga nomor kamu tetap{' '}
            <span style={{ color: '#00D97E' }}>sehat?</span>
          </h2>
          <p style={{ color: '#64748B', fontSize: 17, marginBottom: 32, lineHeight: 1.6 }}>Mulai gratis. Tidak perlu kartu kredit.</p>
          <Link href="/login" style={{
            display: 'inline-block', background: '#0A0F1E', color: '#fff',
            padding: '16px 36px', borderRadius: 999, textDecoration: 'none',
            fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em',
          }}>Coba Closari gratis</Link>
        </div>
      </section>

      <footer style={{ background: '#0A0F1E', borderTop: '1px solid #1E293B', textAlign: 'center', padding: '28px 24px', color: '#475569', fontSize: 13 }}>
        <span style={{ color: '#fff', fontWeight: 700 }}>Clos<span style={{ color: '#00D97E' }}>ari</span></span>
        {' '}· © {new Date().getFullYear()} · Dibangun dengan ❤️ di Indonesia
      </footer>
    </div>
  )
}
