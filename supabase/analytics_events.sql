-- Future-Vote: Analytics Events (Basis, server-only)
--
-- Ziel:
-- - Minimale Kennzahlen (Visits, Votes, Shares, Registrierungen) speichern,
--   um Engpaesse und Nutzung zu verstehen.
-- - Keine Public Policies (Service-Role only). Lesen/Schreiben laeuft ueber Server-Routen.
-- - Datenschutz: keine IP, keine E-Mail; nur session_id (anonym), optional user_id, und Meta (klein).
--
-- Ausfuehren:
-- - Supabase Dashboard -> SQL Editor -> Run

begin;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  path text,
  referrer text,
  session_id text not null,
  user_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

create index if not exists analytics_events_event_created_at_idx
  on public.analytics_events (event, created_at desc);

create index if not exists analytics_events_path_idx
  on public.analytics_events (path);

create index if not exists analytics_events_session_idx
  on public.analytics_events (session_id, created_at desc);

create index if not exists analytics_events_user_idx
  on public.analytics_events (user_id, created_at desc);

-- RLS: keine Public Policies (server/service-role only)
alter table public.analytics_events enable row level security;

commit;

