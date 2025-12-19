-- Future-Vote: Notification Preferences (server-only)
--
-- Ziel:
-- - Nutzer koennen im Profil steuern, welche optionalen Benachrichtigungen sie per E-Mail erhalten.
-- - WICHTIG: Das betrifft NICHT "Pflicht"-E-Mails wie Verifikation/Passwort-Reset.
-- - Keine Public Policies: Lesen/Schreiben nur serverseitig (Service Role).
--
-- Ausfuehren:
-- - Supabase Dashboard -> SQL Editor -> Run

begin;

create table if not exists public.notification_preferences (
  user_id text primary key references public.users(id) on delete cascade,
  all_emails_enabled boolean not null default true,
  private_poll_results boolean not null default true,
  private_poll_ending_soon boolean not null default false,
  creator_public_question_ended boolean not null default true,
  creator_public_question_resolved boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists notification_preferences_updated_at_idx
  on public.notification_preferences (updated_at desc);

alter table public.notification_preferences enable row level security;

commit;
