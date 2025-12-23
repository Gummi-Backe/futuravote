-- Future-Vote: DB Reset (Content/Activity leeren, Accounts behalten)
--
-- Ziel:
-- - Alle inhaltlichen Daten loeschen (Fragen, Umfragen, Votes, Drafts, Reviews, Kommentare, Reports, Analytics, Queues).
-- - Nutzerkonten behalten: `users` und `user_sessions` werden NICHT geloescht.
-- - Optional: `notification_preferences` behalten (Standard: behalten).
--
-- Ausfuehren:
-- - Supabase Dashboard -> SQL Editor -> Run
--
-- WICHTIG:
-- - Das ist destruktiv (Daten sind weg). Vorher ggf. ein Backup/Export machen.
-- - Dieses Script loescht nur Inhalte, nicht das Schema (keine Tabellen werden gedroppt).

begin;

-- (Optional) User-Settings behalten:
-- - notification_preferences enthaelt nur Einstellungen pro User.
-- - favorites wird durch Loeschen von questions ggf. ohnehin geleert (FK on delete cascade).
-- Wenn du ALLES leeren willst inkl. notification_preferences, fuege sie unten in TRUNCATE mit ein.

-- Content/Activity/Queues leeren (robust: nur Tabellen truncaten, die existieren)
do $$
declare
  t text;
  tables text[] := array[
    'analytics_events',
    'creator_question_ended_emails',
    'creator_question_resolved_emails',
    'creator_draft_decision_emails',
    'private_poll_result_emails',
    'private_poll_reminder_emails',
    'password_resets',
    'email_verifications',
    'reports',
    'question_resolution_suggestions',
    'question_resolution_proposals',
    'question_comments',
    'question_metrics_daily',
    'votes',
    'question_options',
    'draft_reviews',
    'draft_options',
    'drafts',
    'favorites',
    'questions'
  ];
begin
  foreach t in array tables loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('truncate table public.%I restart identity cascade;', t);
    end if;
  end loop;
end
$$;

-- Optional: auch User-Settings leeren (auskommentieren, wenn gewuenscht)
-- do $$
-- begin
--   if to_regclass('public.notification_preferences') is not null then
--     execute 'truncate table public.notification_preferences restart identity cascade;';
--   end if;
-- end
-- $$;

commit;

-- Quick-Check (optional, nach dem Run):
-- select
--   (select count(*) from public.questions) as questions,
--   (select count(*) from public.question_options) as question_options,
--   (select count(*) from public.votes) as votes,
--   (select count(*) from public.drafts) as drafts,
--   (select count(*) from public.draft_reviews) as draft_reviews,
--   (select count(*) from public.reports) as reports,
--   (select count(*) from public.analytics_events) as analytics_events,
--   (select count(*) from public.users) as users,
--   (select count(*) from public.user_sessions) as user_sessions;
