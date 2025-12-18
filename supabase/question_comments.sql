-- Future-Vote: Kommentare/Diskussion unter Fragen (server-only)
--
-- Ziel:
-- - Eingeloggte, verifizierte Nutzer koennen unter Fragen kommentieren.
-- - Optional: Quelle (URL) + Haltung (Ja/Nein/Neutral).
-- - Keine Public Policies (Service-Role only). Lesen/Schreiben laeuft ueber Server-Routen.
--
-- Ausfuehren:
-- - Supabase Dashboard -> SQL Editor -> Run

begin;

create table if not exists public.question_comments (
  id uuid primary key default gen_random_uuid(),
  question_id text not null references public.questions(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  stance text not null default 'neutral' check (stance in ('yes','no','neutral')),
  body text not null check (char_length(body) between 5 and 2000),
  source_url text,
  created_at timestamptz not null default now()
);

create index if not exists question_comments_question_created_idx
  on public.question_comments (question_id, created_at asc);

create index if not exists question_comments_user_created_idx
  on public.question_comments (user_id, created_at desc);

-- RLS: keine Public Policies (server/service-role only)
alter table public.question_comments enable row level security;

commit;

