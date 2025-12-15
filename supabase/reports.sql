-- Future-Vote: Reports / Moderation Queue
--
-- Ziel:
-- - Nutzer koennen Fragen/Drafts melden (Spam/Beleidigung/etc.), auch bei privaten Link-Umfragen.
-- - Reports sind nicht oeffentlich lesbar (server/service-role only).
--
-- Setup:
-- 1) Dieses SQL in Supabase SQL Editor ausfuehren
-- 2) Danach (falls noch nicht passiert) `supabase/rls_policies.sql` ausfuehren

begin;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('question', 'draft')),
  item_id text not null,
  item_title text,
  share_id text,
  reason text not null check (reason in ('spam', 'abuse', 'hate', 'misinfo', 'copyright', 'other')),
  message text,
  page_url text,
  reporter_session_id text not null,
  reporter_user_id text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists reports_created_at_idx
  on public.reports (created_at desc);

create index if not exists reports_item_idx
  on public.reports (kind, item_id);

create index if not exists reports_status_idx
  on public.reports (status, created_at desc);

-- Prevent spamming the same item repeatedly from the same session.
create unique index if not exists reports_unique_per_session_item
  on public.reports (kind, item_id, reporter_session_id)
  where status = 'open';

-- Server-only: keine Public Policies (Service-Role only)
alter table public.reports enable row level security;

commit;
