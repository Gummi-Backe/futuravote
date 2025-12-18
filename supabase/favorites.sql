-- Future-Vote: Favoriten/Watchlist (server-only)
--
-- Ziel:
-- - Eingeloggte Nutzer koennen Fragen als Favorit speichern.
-- - Keine oeffentlichen Policies (Service-Role only).
--
-- Ausfuehren:
-- - Supabase Dashboard -> SQL Editor -> Run

begin;

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  question_id text not null references public.questions(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists favorites_unique_user_question
  on public.favorites (user_id, question_id);

create index if not exists favorites_user_created_at_idx
  on public.favorites (user_id, created_at desc);

-- RLS: keine Public Policies (server/service-role only)
alter table public.favorites enable row level security;

commit;

