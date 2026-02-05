-- Future-Vote: Admin Settings (server-only)
--
-- Ziel:
-- - Zentrale Schwellwerte (z.B. Auto-Quarantäne bei Meldungen, Review-Schwellen) in der DB speichern,
--   damit sie ohne Redeploy anpassbar sind.
-- - Keine Public Policies (Service-Role only). Lesen/Schreiben läuft über Server-Routen.
--
-- Ausführen:
-- Supabase Dashboard -> SQL Editor -> Run

begin;

create table if not exists public.admin_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists admin_settings_updated_at_idx
  on public.admin_settings (updated_at desc);

alter table public.admin_settings enable row level security;

commit;

