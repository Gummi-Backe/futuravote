-- Future-Vote: Community-Aufloesungs-Vorschlaege (server-only)
--
-- Ziel:
-- - Nutzer koennen nach Ende einer oeffentlichen Frage das echte Ergebnis vorschlagen:
--   Outcome (Ja/Nein) + Quelle (URL) + optionaler Hinweis.
-- - Ab einer Schwelle kann daraus ein Admin-Queue-Eintrag erzeugt werden.
--
-- Ausfuehren:
-- - Supabase Dashboard -> SQL Editor -> Run

begin;

create table if not exists public.question_resolution_proposals (
  id uuid primary key default gen_random_uuid(),
  question_id text not null references public.questions(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  suggested_outcome text not null check (suggested_outcome in ('yes','no')),
  source_url text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists question_resolution_proposals_unique_user_question
  on public.question_resolution_proposals (question_id, user_id);

create index if not exists question_resolution_proposals_question_created_idx
  on public.question_resolution_proposals (question_id, created_at desc);

create index if not exists question_resolution_proposals_user_created_idx
  on public.question_resolution_proposals (user_id, created_at desc);

-- RLS: keine Public Policies (server/service-role only)
alter table public.question_resolution_proposals enable row level security;

commit;

