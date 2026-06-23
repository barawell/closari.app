import Link from 'next/link'
import LiveDemo from './LiveDemo'

const features = [
  { tag: 'Shared Inbox', headline: 'Satu inbox untuk seluruh tim.', desc: 'Semua nomor, semua agen, satu tampilan terpadu — realtime. Tidak ada pesan terlewat, tidak ada dobel balas.' },
  { tag: 'Aira AI', headline: 'AI yang balas otomatis & sarankan respons.', desc: 'Aira baca konteks percakapan, balas customer otomatis 24 jam, dan kasih saran balasan ke agen. Kontrol tetap di tangan kamu.' },
  { tag: 'Foto & Dokumen', headline: 'Kirim & terima foto, invoice, dokumen.', desc: 'Terima foto/forward dari customer dan balas dengan invoice, katalog, atau dokumen apa pun — langsung dari inbox.' },
  { tag: 'Broadcast', headline: 'Kirim massal tanpa khawatir kena banned.', desc: 'Filter kontak aktif, opt-out otomatis, cooldown 30 hari per kontak, dan rate aman untuk jaga quality rating nomor.' },
  { tag: 'Follow Up', headline: 'Tidak ada customer yang terlupakan.', desc: 'Status "Terkontak" otomatis, klasifikasi customer (loyal/baru/prospek), dan catatan aktivitas follow-up harian.' },
  { tag: 'Multi-nomor', headline: 'Banyak nomor, satu dashboard.', desc: 'Connect banyak nomor WA Business resmi lewat Embedded Signup dalam hitungan menit.' },
]

export default function Landing() {
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#0D0D0D', background: '#fff' }}>

      {/* NAV */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #E5E5E5' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em', color: '#0D0D0D', display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src="/logo.png" alt="Closari" width={20} height={20} style={{ display: "block", borderRadius: 5 }} />
            Closari
          </div>
          <nav style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <a href="#demo" style={{ color: '#6B7280', textDecoration: 'none', fontSize: 14, padding: '6px 12px', borderRadius: 6 }}>Demo</a>
            <a href="#fitur" style={{ color: '#6B7280', textDecoration: 'none', fontSize: 14, padding: '6px 12px', borderRadius: 6 }}>Fitur</a>
            <Link href="/login" style={{ color: '#6B7280', textDecoration: 'none', fontSize: 14, padding: '6px 12px', borderRadius: 6 }}>Masuk</Link>
            <Link href="/login" style={{ background: '#0D0D0D', color: '#fff', padding: '7px 16px', borderRadius: 7, textDecoration: 'none', fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em' }}>Mulai gratis</Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '80px 24px 64px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #E5E5E5', borderRadius: 999, padding: '5px 14px 5px 8px', marginBottom: 28, fontSize: 13, color: '#6B7280' }}>
          <span style={{ background: '#16A34A', color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, letterSpacing: '0.02em' }}>BARU</span>
          Realtime inbox — pesan masuk otomatis tanpa refresh
        </div>

        <h1 style={{ fontSize: 56, lineHeight: 1.1, fontWeight: 700, letterSpacing: '-0.04em', color: '#0D0D0D', marginBottom: 20, maxWidth: 700, margin: '0 auto 20px' }}>
          Platform WhatsApp Business{' '}
          <span style={{ color: '#16A34A' }}>untuk tim CS modern.</span>
        </h1>

        <p style={{ fontSize: 17, color: '#6B7280', lineHeight: 1.65, maxWidth: 500, margin: '0 auto 36px' }}>
          Shared inbox, AI copilot, dan broadcast yang aman — dalam satu platform yang didesain untuk tim yang serius.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <Link href="/login" style={{ background: '#0D0D0D', color: '#fff', padding: '11px 24px', borderRadius: 8, textDecoration: 'none', fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em' }}>Mulai gratis</Link>
          <a href="#demo" style={{ background: '#fff', color: '#0D0D0D', border: '1px solid #E5E5E5', padding: '11px 24px', borderRadius: 8, textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>Coba demo</a>
        </div>
        <p style={{ fontSize: 12, color: '#9CA3AF' }}>Tidak perlu kartu kredit · Setup 10 menit</p>
      </section>

      {/* LIVE DEMO */}
      <section id="demo" style={{ background: '#F7F7F7', borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', padding: '64px 24px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#16A34A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Live Demo</div>
            <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', color: '#0D0D0D', marginBottom: 10 }}>Coba sendiri, sekarang.</h2>
            <p style={{ fontSize: 14, color: '#6B7280' }}>Kirim pesan ke inbox demo di bawah dan lihat Aira AI baca konteks & sarankan balasan terbaik.</p>
          </div>
          <LiveDemo />
        </div>
      </section>

      {/* FEATURES */}
      <section id="fitur" style={{ maxWidth: 1080, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#16A34A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Fitur</div>
          <h2 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em', color: '#0D0D0D', maxWidth: 480 }}>Semua yang kamu butuhkan. Tidak lebih.</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: '#E5E5E5', border: '1px solid #E5E5E5', borderRadius: 12, overflow: 'hidden' }}>
          {features.map((f) => (
            <div key={f.tag} style={{ background: '#fff', padding: '28px 28px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#16A34A', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>{f.tag}</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0D0D0D', marginBottom: 8, lineHeight: 1.4, letterSpacing: '-0.02em' }}>{f.headline}</h3>
              <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ background: '#F7F7F7', borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '80px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#16A34A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Cara kerja</div>
              <h2 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em', color: '#0D0D0D', marginBottom: 36, lineHeight: 1.2 }}>Jalan dalam 10 menit.</h2>
              {[
                { n: '1', label: 'Connect nomor', desc: 'Hubungkan nomor WA Business resmi lewat Embedded Signup.' },
                { n: '2', label: 'Invite tim', desc: 'Tambah agen CS. Semua langsung bisa akses shared inbox.' },
                { n: '3', label: 'Aktifkan Aira AI', desc: 'Set persona & instruksi AI. Aira langsung balas otomatis & bantu agen di setiap percakapan.' },
              ].map((s, i) => (
                <div key={s.n} style={{ display: 'flex', gap: 16, marginBottom: i < 2 ? 24 : 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: 1, background: '#0D0D0D', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{s.n}</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#0D0D0D', marginBottom: 4, letterSpacing: '-0.01em' }}>{s.label}</div>
                    <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, padding: 32, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { label: 'Waktu setup', value: '< 10 menit' },
                { label: 'Kartu kredit', value: 'Tidak perlu' },
                { label: 'Kontrak', value: 'Tidak ada' },
                { label: 'Batas pesan', value: 'Tidak terbatas' },
                { label: 'Support', value: 'Via WhatsApp' },
              ].map((r, i, arr) => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < arr.length - 1 ? '1px solid #F0F0F0' : 'none' }}>
                  <span style={{ fontSize: 14, color: '#6B7280' }}>{r.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#0D0D0D' }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: '#0D0D0D', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', marginBottom: 14, lineHeight: 1.15 }}>
            Mulai hari ini.<br />
            <span style={{ color: '#16A34A' }}>Gratis, tanpa komitmen.</span>
          </h2>
          <p style={{ color: '#6B7280', fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
            Bergabung dengan tim CS yang sudah pakai Closari untuk balas lebih cepat dan jaga nomor tetap aman.
          </p>
          <Link href="/login" style={{ display: 'inline-block', background: '#fff', color: '#0D0D0D', padding: '12px 28px', borderRadius: 8, textDecoration: 'none', fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
            Coba Closari gratis
          </Link>
        </div>
      </section>

      <footer style={{ background: '#0D0D0D', borderTop: '1px solid #1F1F1F', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src="/logo.png" alt="Closari" width={16} height={16} style={{ display: "block", borderRadius: 5 }} />
          Closari
        </div>
        <div style={{ fontSize: 12, color: '#6B7280' }}>© {new Date().getFullYear()} Closari. Dibuat di Indonesia.</div>
      </footer>
    </div>
  )
}
