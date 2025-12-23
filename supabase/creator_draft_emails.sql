-- Future-Vote: Creator Notifications for Draft decisions (server-side only)
--
-- Ziel:
-- - Ersteller (creator_id) von Drafts bekommen optional eine E-Mail,
--   wenn ihr Draft im Review-Bereich angenommen oder abgelehnt wurde.
-- - Outbox-Tabelle verhindert doppelte E-Mails (idempotent).
-- - Kein public access: nur serverseitig (Service Role) verwenden.
--
-- Ausfuehren:
-- - Supabase Dashboard -> SQL Editor -> Run

begin;

create table if not exists public.creator_draft_decision_emails (
  draft_id text primary key references public.drafts(id) on delete cascade,
  creator_id text references public.users(id) on delete set null,
  to_email text not null,
  decision text not null check (decision in ('accepted','rejected')),
  question_id text,
  share_id text,
  sent_at timestamptz not null default now()
);

create index if not exists creator_draft_decision_emails_creator_id_idx
  on public.creator_draft_decision_emails (creator_id);

create index if not exists creator_draft_decision_emails_sent_at_idx
  on public.creator_draft_decision_emails (sent_at);

alter table public.creator_draft_decision_emails enable row level security;

commit;

