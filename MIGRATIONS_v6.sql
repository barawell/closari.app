-- ============================================================
-- Closari v6 — Migration SQL
-- Run di Supabase SQL Editor sebelum deploy.
-- ============================================================

-- 1) Tambah kolom Knowledge Base + Repeat Order Mode ke ai_configs
ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS persona_role text,
  ADD COLUMN IF NOT EXISTS business_info text,
  ADD COLUMN IF NOT EXISTS products_info text,
  ADD COLUMN IF NOT EXISTS faq_info text,
  ADD COLUMN IF NOT EXISTS policy_info text,
  ADD COLUMN IF NOT EXISTS repeat_order_mode boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS repeat_order_days_threshold integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS repeat_order_message text;

-- 2) Tambah notes + tags ke wa_contacts (untuk CRM panel)
ALTER TABLE wa_contacts
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS first_contact_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_order_at timestamptz;

-- 3) Quick Replies (canned responses)
CREATE TABLE IF NOT EXISTS quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shortcut text NOT NULL,        -- contoh: "harga", "tanya-alamat"
  title text NOT NULL,           -- judul yg ditampilkan
  body text NOT NULL,            -- isi pesan
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quick_replies_tenant ON quick_replies(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quick_replies_shortcut ON quick_replies(tenant_id, shortcut);

ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "qr_tenant_select" ON quick_replies;
CREATE POLICY "qr_tenant_select" ON quick_replies FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
);

-- 4) Conversation tags (labels)
ALTER TABLE wa_conversations
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS assignee_user_id uuid,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

-- 5) Helper view: kontak dengan jumlah pesan & last_message
CREATE OR REPLACE VIEW v_contacts_enriched AS
SELECT
  c.*,
  (SELECT count(*) FROM wa_messages m WHERE m.contact_id = c.id) AS total_messages,
  (SELECT count(*) FROM wa_conversations conv WHERE conv.contact_id = c.id) AS total_conversations
FROM wa_contacts c;
