-- Future-Vote: Private Poll Results - E-Mail Outbox (server-side only)
--
-- Ziel:
-- - Wenn eine private Umfrage (visibility='link_only') endet, bekommt der Ersteller automatisch das Ergebnis per E-Mail.
-- - Diese Tabelle verhindert doppelte E-Mails (idempotent).
-- - Kein public access: nur serverseitig (Service Role) verwenden.

begin;

create table if not exists public.private_poll_result_emails (
  question_id text primary key references public.questions(id) on delete cascade,
  creator_id text references public.users(id) on delete set null,
  to_email text not null,
  share_id text,
  closes_at date,
  yes_votes integer not null default 0,
  no_votes integer not null default 0,
  sent_at timestamptz not null default now()
);

create index if not exists private_poll_result_emails_creator_id_idx
  on public.private_poll_result_emails (creator_id);

create index if not exists private_poll_result_emails_sent_at_idx
  on public.private_poll_result_emails (sent_at);

alter table public.private_poll_result_emails enable row level security;

commit;

