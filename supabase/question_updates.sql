-- Future-Vote: Updates zu Fragen/Prognosen
--
-- Ziel:
-- - Ersteller einer Frage kann spaeter Updates mit optionaler Quelle posten.
-- - Updates sind oeffentlich im Frage-Detail sichtbar.
-- - Schreiben/Lesen laeuft ueber Server-Routen (Service-Role), keine Public-Policies.
--
-- Ausfuehren:
-- - Supabase Dashboard -> SQL Editor -> Run

begin;

create table if not exists public.question_updates (
  id uuid primary key default gen_random_uuid(),
  question_id text not null references public.questions(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  body text not null check (char_length(body) between 10 and 8000),
  source_url text,
  created_at timestamptz not null default now()
);

create index if not exists question_updates_question_created_idx
  on public.question_updates (question_id, created_at desc);

create index if not exists question_updates_user_created_idx
  on public.question_updates (user_id, created_at desc);

alter table public.question_updates enable row level security;

commit;

