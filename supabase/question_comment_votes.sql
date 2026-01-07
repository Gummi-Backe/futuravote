-- Future-Vote: Votes auf Kommentare (Daumen hoch/runter) (server-only)
--
-- Ziel:
-- - Eingeloggte Nutzer können Kommentare bewerten (👍/👎).
-- - Pro Nutzer & Kommentar nur eine Stimme (togglebar).
-- - Keine Public Policies (Service-Role only). Lesen/Schreiben läuft über Server-Routen.
-- - Aggregierte Zähler über View `question_comment_vote_counts`.
--
-- Ausführen:
-- - Supabase Dashboard -> SQL Editor -> Run

begin;

create table if not exists public.question_comment_votes (
  comment_id uuid not null references public.question_comments(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  vote text not null check (vote in ('up','down')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists question_comment_votes_comment_idx
  on public.question_comment_votes (comment_id);

create index if not exists question_comment_votes_user_idx
  on public.question_comment_votes (user_id);

create index if not exists question_comment_votes_vote_idx
  on public.question_comment_votes (vote);

create or replace view public.question_comment_vote_counts as
select
  comment_id,
  count(*) filter (where vote = 'up') as up_votes,
  count(*) filter (where vote = 'down') as down_votes
from public.question_comment_votes
group by comment_id;

-- RLS: keine Public Policies (server/service-role only)
alter table public.question_comment_votes enable row level security;

commit;

