-- Future-Vote: Baseline-RLS fuer Supabase
--
-- Ziel:
-- - `questions` und `drafts` duerfen oeffentlich gelesen werden.
-- - `votes`, `users`, `user_sessions`, `email_verifications` sind NICHT oeffentlich.
--   (Zugriffe erfolgen serverseitig mit Service-Role-Key.)

begin;

-- RLS aktivieren
alter table if exists public.questions enable row level security;
alter table if exists public.drafts enable row level security;
alter table if exists public.votes enable row level security;
alter table if exists public.users enable row level security;
alter table if exists public.user_sessions enable row level security;
alter table if exists public.email_verifications enable row level security;
alter table if exists public.draft_reviews enable row level security;
alter table if exists public.password_resets enable row level security;

-- Idempotent: Policies neu anlegen
drop policy if exists "Public read questions" on public.questions;
create policy "Public read questions"
on public.questions
for select
using (true);

drop policy if exists "Public read drafts" on public.drafts;
create policy "Public read drafts"
on public.drafts
for select
using (true);

commit;
