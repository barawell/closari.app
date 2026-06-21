# Closari — Platform WhatsApp Business multi-tenant + AI

MVP lengkap: auth, onboarding tenant, shared inbox (agen balas), AI auto-reply per-tenant,
kelola nomor (Embedded Signup + tambah manual), broadcast compliant.

## Setup
```bash
npm install
cp .env.example .env.local   # isi nilainya (lihat di bawah)
npm run dev                  # http://localhost:3000
```

## Env vars (.env.local + Vercel)
| Var | Dari mana | Wajib |
|---|---|---|
| SUPABASE_URL | Supabase → Settings → API (Project URL) | ya |
| SUPABASE_SERVICE_ROLE_KEY | Supabase → Settings → API (service_role) — RAHASIA | ya |
| NEXT_PUBLIC_SUPABASE_URL | sama dgn SUPABASE_URL | ya |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase → Settings → API (anon) | ya |
| WA_VERIFY_TOKEN | string acak bebas, samain di Meta | ya |
| META_APP_SECRET | App Closari → Settings → Basic | ya |
| ANTHROPIC_API_KEY | console.anthropic.com — RAHASIA | ya (utk AI) |
| FB_APP_ID / FB_APP_SECRET | App Closari → Settings → Basic | utk Embedded Signup |
| NEXT_PUBLIC_FB_APP_ID / NEXT_PUBLIC_FB_CONFIG_ID | App Closari (config Embedded Signup) | utk Embedded Signup |

## Alur pakai
1. Jalankan `closari-schema.sql` di Supabase (sekali).
2. `npm run dev` → buka app → **Daftar** akun → **buat workspace** (tenant).
3. **Nomor** → "Tambah manual (test)" pakai test number Meta (phone_number_id, waba_id, token)
   — atau "Connect WhatsApp" kalau Embedded Signup udah aktif.
4. Pasang webhook di Meta: Callback `https://<app>/api/wa/webhook`, verify token = `WA_VERIFY_TOKEN`, subscribe `messages`.
5. **AI & Setelan** → nyalain AI, isi persona + system prompt.
6. Kirim pesan ke nomor → muncul di **Inbox**, AI balas otomatis (kalau nyala), agen bisa balas manual.
7. **Broadcast** → kirim ke pelanggan aktif (opt-out otomatis dibuang).

## Yang butuh setup eksternal (baru "nyala" setelah itu)
- **Embedded Signup**: butuh App Review Meta + config_id. Sebelum itu, pakai "Tambah manual".
- **Pembayaran/subscription**: scaffold tabel `subscriptions` udah ada; integrasi Midtrans/DOKU menyusul.
