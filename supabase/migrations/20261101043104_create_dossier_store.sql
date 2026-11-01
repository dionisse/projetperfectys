/*
# Create dossier store table

1. New Tables
- `dossier_store`: one row per accounting folder (dossier) of the PERFECTO prototype.
  - `dossier_id` (text, primary key): identifier of the folder as used by the app.
  - `payload` (jsonb, not null): the complete saved state of that folder.
  - `updated_at` (timestamptz): last save time.

2. Security
- Row level security is enabled.
- The prototype has no sign-in screen, so the anon key reads and writes rows directly.
  Access is therefore open to anyone holding the app's public key. This is acceptable only for the demo;
  it must be replaced with owner-scoped policies once real sign-in exists.
- Grants are limited to SELECT, INSERT and UPDATE for anon and authenticated (no DELETE).

3. Important notes
- Statements are idempotent and safe to re-run.
- No existing data is modified or removed.
*/

CREATE TABLE IF NOT EXISTS dossier_store (
  dossier_id text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dossier_store ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON dossier_store TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_dossier_store" ON dossier_store;
CREATE POLICY "anon_select_dossier_store" ON dossier_store FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_dossier_store" ON dossier_store;
CREATE POLICY "anon_insert_dossier_store" ON dossier_store FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_dossier_store" ON dossier_store;
CREATE POLICY "anon_update_dossier_store" ON dossier_store FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
