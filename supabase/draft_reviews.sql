-- Future-Vote: Draft reviews (anonymous, session-bound)
--
-- Goal:
-- - Prevent multiple reviews for the same draft within the same anonymous session.
-- - Keep the review data server-side only (service role key), protected by RLS.

begin;

create table if not exists public.draft_reviews (
  id uuid primary key default gen_random_uuid(),
  draft_id text not null references public.drafts(id) on delete cascade,
  session_id text not null,
  choice text not null check (choice in ('good','bad')),
  created_at timestamptz not null default now()
);

create unique index if not exists draft_reviews_unique_draft_session
  on public.draft_reviews (draft_id, session_id);

-- RLS: no public policies (server/service-role only)
alter table public.draft_reviews enable row level security;

commit;
