-- Future-Vote: Creator Notifications for public questions (server-side only)
--
-- Ziel:
-- - Ersteller (creator_id) oeffentlicher Fragen bekommen optional E-Mails:
--   - wenn die Abstimmung endet (closes_at erreicht)
--   - wenn die Frage spaeter aufgeloest wurde (resolved_outcome gesetzt)
-- - Outbox-Tabellen verhindern doppelte E-Mails (idempotent).
-- - Kein public access: nur serverseitig (Service Role) verwenden.
--
-- Ausfuehren:
-- - Supabase Dashboard -> SQL Editor -> Run

begin;

create table if not exists public.creator_question_ended_emails (
  question_id text primary key references public.questions(id) on delete cascade,
  creator_id text references public.users(id) on delete set null,
  to_email text not null,
  closes_at date,
  sent_at timestamptz not null default now()
);

create index if not exists creator_question_ended_emails_creator_id_idx
  on public.creator_question_ended_emails (creator_id);

create index if not exists creator_question_ended_emails_sent_at_idx
  on public.creator_question_ended_emails (sent_at);

alter table public.creator_question_ended_emails enable row level security;

create table if not exists public.creator_question_resolved_emails (
  question_id text primary key references public.questions(id) on delete cascade,
  creator_id text references public.users(id) on delete set null,
  to_email text not null,
  resolved_at timestamptz,
  resolved_outcome text,
  sent_at timestamptz not null default now()
);

create index if not exists creator_question_resolved_emails_creator_id_idx
  on public.creator_question_resolved_emails (creator_id);

create index if not exists creator_question_resolved_emails_sent_at_idx
  on public.creator_question_resolved_emails (sent_at);

alter table public.creator_question_resolved_emails enable row level security;

commit;

