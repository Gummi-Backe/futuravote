-- Future-Vote: Private Poll "Ending Soon" - E-Mail Outbox (server-side only)
--
-- Ziel:
-- - Optional: Wenn eine private Umfrage (visibility='link_only') bald endet, kann der Ersteller eine Erinnerung bekommen.
-- - Diese Tabelle verhindert doppelte Erinnerungen (idempotent).
-- - Kein public access: nur serverseitig (Service Role) verwenden.
--
-- Ausfuehren:
-- - Supabase Dashboard -> SQL Editor -> Run

begin;

create table if not exists public.private_poll_reminder_emails (
  question_id text primary key references public.questions(id) on delete cascade,
  creator_id text references public.users(id) on delete set null,
  to_email text not null,
  share_id text,
  closes_at date,
  sent_at timestamptz not null default now()
);

create index if not exists private_poll_reminder_emails_creator_id_idx
  on public.private_poll_reminder_emails (creator_id);

create index if not exists private_poll_reminder_emails_sent_at_idx
  on public.private_poll_reminder_emails (sent_at);

alter table public.private_poll_reminder_emails enable row level security;

commit;

