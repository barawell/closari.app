import Link from 'next/link'

const features = [
  { icon: '🤖', title: 'AI Copilot', desc: 'AI baca maksud customer & kasih saran balasan ke agen — bukan cuma auto-reply. Agen tetap pegang kendali.' },
  { icon: '💬', title: 'Shared Inbox', desc: 'Satu kotak masuk untuk seluruh tim. Banyak nomor, banyak agen, satu tampilan rapi.' },
  { icon: '📣', title: 'Broadcast Aman', desc: 'Opt-out otomatis & filter pelanggan aktif — jaga quality rating, hindari banned.' },
  { icon: '🔌', title: 'Multi-nomor', desc: 'Hubungkan banyak nomor WhatsApp Business resmi lewat Embedded Signup.' },
  { icon: '🧠', title: 'Knowledge Base', desc: 'AI jawab dari info produkmu sendiri. Makin lama makin pintar.' },
  { icon: '🛡️', title: 'Compliance-first', desc: 'Dibangun oleh tim yang ngerasain banned. Guardrail anti-spam dari awal.' },
]

export default function Landing() {
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#111' }}>
      {/* nav */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ fontWeight: 800, fontSize: 22 }}>Closari</div>
        <nav style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <a href="#fitur" style={{ color: '#555', textDecoration: 'none', fontSize: 14 }}>Fitur</a>
          <Link href="/login" style={{ color: '#555', textDecoration: 'none', fontSize: 14 }}>Masuk</Link>
          <Link href="/login" style={{ background: '#111', color: '#fff', padding: '9px 18px', borderRadius: 999, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Coba gratis</Link>
        </nav>
      </header>

      {/* hero */}
      <section style={{ textAlign: 'center', padding: '70px 24px 50px', maxWidth: 820, margin: '0 auto' }}>
        <div style={{ display: 'inline-block', background: '#eef4ff', color: '#2563eb', padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
          Platform WhatsApp Business + AI
        </div>
        <h1 style={{ fontSize: 52, lineHeight: 1.1, margin: '0 0 20px', letterSpacing: -1 }}>
          CS WhatsApp yang dibantu AI,<br />tanpa takut kena banned.
        </h1>
        <p style={{ fontSize: 19, color: '#555', lineHeight: 1.6, maxWidth: 620, margin: '0 auto 32px' }}>
          Closari gabungkan shared inbox, AI copilot, dan broadcast yang compliant dalam satu platform — biar tim kamu balas lebih cepat dan nomor kamu tetap sehat.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link href="/login" style={{ background: '#111', color: '#fff', padding: '14px 28px', borderRadius: 999, textDecoration: 'none', fontSize: 16, fontWeight: 600 }}>Mulai gratis</Link>
          <a href="#fitur" style={{ background: '#fff', color: '#111', border: '1px solid #ddd', padding: '14px 28px', borderRadius: 999, textDecoration: 'none', fontSize: 16, fontWeight: 600 }}>Lihat fitur</a>
        </div>
      </section>

      {/* features */}
      <section id="fitur" style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {features.map(f => (
            <div key={f.title} style={{ border: '1px solid #eee', borderRadius: 16, padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, margin: '0 0 8px' }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* cta */}
      <section style={{ background: '#111', color: '#fff', textAlign: 'center', padding: '64px 24px' }}>
        <h2 style={{ fontSize: 34, margin: '0 0 16px' }}>Siap bikin CS kamu lebih cepat?</h2>
        <p style={{ color: '#bbb', fontSize: 17, marginBottom: 28 }}>Mulai gratis, tanpa kartu kredit.</p>
        <Link href="/login" style={{ background: '#fff', color: '#111', padding: '14px 32px', borderRadius: 999, textDecoration: 'none', fontSize: 16, fontWeight: 700 }}>Coba Closari</Link>
      </section>

      <footer style={{ textAlign: 'center', padding: 28, color: '#999', fontSize: 13 }}>© {new Date().getFullYear()} Closari</footer>
    </div>
  )
}
