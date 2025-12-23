-- Future-Vote: Options-Umfragen + Prognose/Meinungs-Umfrage (Schema-Erweiterung)
--
-- Ziel:
-- - Questions/Drafts koennen entweder "Prognose" (aufloesbar) oder "Meinungs-Umfrage" (nicht aufloesbar) sein.
-- - Questions/Drafts koennen entweder "binary" (Ja/Nein) oder "options" (2-6 feste Optionen, Single-Choice) sein.
-- - Votes unterstuetzen neben Ja/Nein auch eine Option-Auswahl via `option_id`.
--
-- WICHTIG:
-- - Diese SQL ist idempotent (kann mehrfach ausgefuehrt werden).
-- - RLS Policies danach in `supabase/rls_policies.sql` weiterhin server-only (keine Public Policies fuer Options-Tabellen).
--
-- Ausfuehren:
-- - Supabase Dashboard -> SQL Editor -> Run

begin;

-- ---------------------------------------------------------------------------
-- 1) Questions/Drafts: neue Meta-Felder
-- ---------------------------------------------------------------------------

alter table if exists public.questions
  add column if not exists answer_mode text not null default 'binary',
  add column if not exists is_resolvable boolean not null default true;

alter table if exists public.drafts
  add column if not exists answer_mode text not null default 'binary',
  add column if not exists is_resolvable boolean not null default true;

-- Check-Constraints nachziehen (falls Spalten schon existierten)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'questions_answer_mode_check') then
    alter table public.questions
      add constraint questions_answer_mode_check
      check (answer_mode in ('binary','options'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'drafts_answer_mode_check') then
    alter table public.drafts
      add constraint drafts_answer_mode_check
      check (answer_mode in ('binary','options'));
  end if;
end
$$;

create index if not exists questions_answer_mode_idx
  on public.questions (answer_mode);

create index if not exists drafts_answer_mode_idx
  on public.drafts (answer_mode);

create index if not exists questions_is_resolvable_idx
  on public.questions (is_resolvable);

create index if not exists drafts_is_resolvable_idx
  on public.drafts (is_resolvable);

-- ---------------------------------------------------------------------------
-- 2) Options-Tabellen (2-6)
-- ---------------------------------------------------------------------------

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id text not null references public.questions(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  sort_order integer not null check (sort_order between 1 and 6),
  votes_count integer not null default 0 check (votes_count >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists question_options_unique_question_sort
  on public.question_options (question_id, sort_order);

create unique index if not exists question_options_unique_question_label_ci
  on public.question_options (question_id, lower(label));

create index if not exists question_options_question_sort_idx
  on public.question_options (question_id, sort_order);

create table if not exists public.draft_options (
  id uuid primary key default gen_random_uuid(),
  draft_id text not null references public.drafts(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  sort_order integer not null check (sort_order between 1 and 6),
  votes_count integer not null default 0 check (votes_count >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists draft_options_unique_draft_sort
  on public.draft_options (draft_id, sort_order);

create unique index if not exists draft_options_unique_draft_label_ci
  on public.draft_options (draft_id, lower(label));

create index if not exists draft_options_draft_sort_idx
  on public.draft_options (draft_id, sort_order);

-- RLS aktivieren (server-only; keine Public Policies hier)
alter table public.question_options enable row level security;
alter table public.draft_options enable row level security;

-- ---------------------------------------------------------------------------
-- 3) Votes: option_id + Constraints (binary XOR options)
-- ---------------------------------------------------------------------------

alter table if exists public.votes
  add column if not exists option_id uuid references public.question_options(id) on delete cascade;

-- Fuer Options-Umfragen muss `choice` NULL sein duerfen.
alter table if exists public.votes
  alter column choice drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'votes_choice_or_option_check') then
    alter table public.votes
      add constraint votes_choice_or_option_check
      check (
        (option_id is null and choice in ('yes','no'))
        or
        (option_id is not null and choice is null)
      );
  end if;
end
$$;

create index if not exists votes_option_id_idx
  on public.votes (option_id);

-- ---------------------------------------------------------------------------
-- 4) Aufloesung fuer Options-Prognosen: winner option id
-- ---------------------------------------------------------------------------

alter table if exists public.questions
  add column if not exists resolved_option_id uuid references public.question_options(id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'questions_resolved_oneof_check') then
    alter table public.questions
      add constraint questions_resolved_oneof_check
      check (resolved_outcome is null or resolved_option_id is null);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'questions_resolved_option_requires_options') then
    alter table public.questions
      add constraint questions_resolved_option_requires_options
      check (resolved_option_id is null or (answer_mode = 'options' and is_resolvable = true));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'questions_resolved_outcome_requires_binary') then
    alter table public.questions
      add constraint questions_resolved_outcome_requires_binary
      check (resolved_outcome is null or (answer_mode = 'binary' and is_resolvable = true));
  end if;
end
$$;

create index if not exists questions_resolved_option_id_idx
  on public.questions (resolved_option_id);

commit;

