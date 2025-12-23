-- Future-Vote: Frage-Aufloesungs-Vorschlaege (Queue, server-only)
--
-- Ziel:
-- - Taeglicher Cron kann fuer abgelaufene, noch nicht aufgeloeste Fragen
--   KI-Vorschlaege (Ja/Nein/Unknown + Quellen) speichern.
-- - Admin sieht diese Vorschlaege in einer Queue und kann sie bestaetigen/verwerfen.
--
-- Ausfuehren:
-- - Supabase Dashboard -> SQL Editor -> Run

begin;

-- Erweiterung: Vorschlaege koennen aus "ai" (Perplexity) oder "community" stammen.
-- Wenn du dieses File erneut ausfuehrst, werden neue Spalten/Indizes idempotent nachgezogen.

create table if not exists public.question_resolution_suggestions (
  id uuid primary key default gen_random_uuid(),
  question_id text not null references public.questions(id) on delete cascade,
  source_kind text not null default 'ai' check (source_kind in ('ai','community')),
  created_by_user_id text references public.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','applied','dismissed','failed')),
  suggested_outcome text not null default 'unknown' check (suggested_outcome in ('yes','no','unknown')),
  suggested_option_id uuid references public.question_options(id) on delete set null,
  confidence integer not null default 0 check (confidence between 0 and 100),
  note text,
  sources text[] not null default '{}'::text[],
  model text,
  raw_response text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now()
);

-- Falls die Tabelle schon existiert (alte Version): Spalten nachziehen
alter table if exists public.question_resolution_suggestions
  add column if not exists source_kind text,
  add column if not exists created_by_user_id text,
  add column if not exists suggested_option_id uuid;

do $$
begin
  -- source_kind default/check nachziehen (nur wenn Spalte existiert und Constraint fehlt)
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'question_resolution_suggestions'
      and column_name = 'source_kind'
  ) then
    update public.question_resolution_suggestions
      set source_kind = coalesce(source_kind, 'ai')
      where source_kind is null;

    if not exists (select 1 from pg_constraint where conname = 'question_resolution_suggestions_source_kind_check') then
      alter table public.question_resolution_suggestions
        add constraint question_resolution_suggestions_source_kind_check
        check (source_kind in ('ai','community'));
    end if;

    alter table public.question_resolution_suggestions
      alter column source_kind set default 'ai';
  end if;
end
$$;

-- suggested_option_id ist optional (fuer Options-Prognosen).
-- Wenn ein suggested_option_id gesetzt ist, muss suggested_outcome = 'unknown' sein.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'question_resolution_suggestions_outcome_or_option_check') then
    alter table public.question_resolution_suggestions
      add constraint question_resolution_suggestions_outcome_or_option_check
      check (
        (suggested_option_id is null)
        or
        (suggested_option_id is not null and suggested_outcome = 'unknown')
      );
  end if;
end
$$;

-- Pro Frage maximal ein "pending" Vorschlag pro Quelle (ai/community)
drop index if exists question_resolution_suggestions_unique_pending;
create unique index if not exists question_resolution_suggestions_unique_pending_kind
  on public.question_resolution_suggestions (question_id, source_kind)
  where status = 'pending';

create index if not exists question_resolution_suggestions_status_created_idx
  on public.question_resolution_suggestions (status, created_at desc);

create index if not exists question_resolution_suggestions_question_idx
  on public.question_resolution_suggestions (question_id);

create index if not exists question_resolution_suggestions_suggested_option_id_idx
  on public.question_resolution_suggestions (suggested_option_id);

-- RLS: keine Public Policies (server/service-role only)
alter table public.question_resolution_suggestions enable row level security;

commit;
