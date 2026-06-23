-- ============================================================
-- Closari v7 — Migration SQL (FIXED)
-- Run di Supabase SQL Editor sebelum deploy.
-- ============================================================

-- 1) Tambah logo_url ke tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2) Tambah role ke tenant_members (admin / agent)
ALTER TABLE tenant_members
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'admin' CHECK (role IN ('admin', 'agent')),
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Set role admin untuk semua member existing
UPDATE tenant_members SET role = 'admin' WHERE role IS NULL;

-- 3) Tabel invitations
CREATE TABLE IF NOT EXISTS tenant_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  token text NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invites_token ON tenant_invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_tenant ON tenant_invites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON tenant_invites(email);

ALTER TABLE tenant_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invite_tenant_select" ON tenant_invites;
CREATE POLICY "invite_tenant_select" ON tenant_invites FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
);

-- 4) Supabase Storage bucket untuk tenant assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tenant-assets', 'tenant-assets', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "tenant_assets_upload" ON storage.objects;
CREATE POLICY "tenant_assets_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tenant_assets_update" ON storage.objects;
CREATE POLICY "tenant_assets_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tenant_assets_delete" ON storage.objects;
CREATE POLICY "tenant_assets_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tenant_assets_public_read" ON storage.objects;
CREATE POLICY "tenant_assets_public_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'tenant-assets'
);

-- 5) View helper: members lengkap dengan email user
-- FIX: tenant_members tidak punya kolom 'id', pakai user_id sebagai identifier
DROP VIEW IF EXISTS v_tenant_members;
CREATE VIEW v_tenant_members AS
SELECT
  tm.tenant_id,
  tm.user_id,
  tm.role,
  tm.display_name,
  tm.created_at,
  u.email,
  u.last_sign_in_at
FROM tenant_members tm
JOIN auth.users u ON u.id = tm.user_id;
