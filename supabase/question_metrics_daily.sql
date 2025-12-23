-- Future-Vote: Trend Etappe 2 (skalierbar)
--
-- Ziel:
-- - Views/Ranking/Vote-Splits als Zeitreihe per Snapshots (daily),
--   damit Trends auch bei sehr vielen Votes performant bleiben.
--
-- Setup:
-- 1) Dieses SQL in Supabase SQL Editor ausfuehren
-- 2) Danach in Vercel einen Cron auf `/api/cron/question-metrics` einrichten (siehe Repo-Docs)

begin;

create table if not exists public.question_metrics_daily (
  question_id text not null,
  day date not null,
  yes_votes integer not null default 0,
  no_votes integer not null default 0,
  -- Optional: Snapshots (werden vom Cron gesetzt). NULL = noch kein Snapshot fuer diesen Tag.
  views integer,
  ranking_score double precision,
  updated_at timestamptz not null default now(),
  primary key (question_id, day)
);

create index if not exists question_metrics_daily_day_idx
  on public.question_metrics_daily (day);

-- Server-only: keine Public Policies (Service-Role only)
alter table public.question_metrics_daily enable row level security;

-- Options-Umfragen: Votes pro Option/Tag (damit Trend ohne Roh-Votes skalieren kann)
create table if not exists public.question_option_metrics_daily (
  question_id text not null,
  option_id uuid not null references public.question_options(id) on delete cascade,
  day date not null,
  votes integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (question_id, option_id, day)
);

create index if not exists question_option_metrics_daily_day_idx
  on public.question_option_metrics_daily (day);

alter table public.question_option_metrics_daily enable row level security;

-- Refresh-Funktion: aggregiert Votes (letzte N Tage) + schreibt heutigen Views/Ranking Snapshot
create or replace function public.refresh_question_metrics_daily(days_back integer default 120)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  start_date date := ((now() at time zone 'UTC')::date - greatest(1, coalesce(days_back, 120)));
  votes_rows int := 0;
  option_rows int := 0;
  snap_rows int := 0;
begin
  -- Votes -> daily aggregates (yes/no)
  insert into public.question_metrics_daily (question_id, day, yes_votes, no_votes, updated_at)
  select
    v.question_id,
    (v.created_at at time zone 'UTC')::date as day,
    sum(case when v.choice = 'yes' then 1 else 0 end)::int as yes_votes,
    sum(case when v.choice = 'no' then 1 else 0 end)::int as no_votes,
    now()
  from public.votes v
  where v.created_at >= (start_date::timestamptz)
  group by v.question_id, (v.created_at at time zone 'UTC')::date
  on conflict (question_id, day) do update
    set yes_votes = excluded.yes_votes,
        no_votes = excluded.no_votes,
        updated_at = now();

  get diagnostics votes_rows = row_count;

  -- Options-Votes -> daily aggregates (pro option_id)
  insert into public.question_option_metrics_daily (question_id, option_id, day, votes, updated_at)
  select
    v.question_id,
    v.option_id,
    (v.created_at at time zone 'UTC')::date as day,
    count(*)::int as votes,
    now()
  from public.votes v
  where v.created_at >= (start_date::timestamptz)
    and v.option_id is not null
  group by v.question_id, v.option_id, (v.created_at at time zone 'UTC')::date
  on conflict (question_id, option_id, day) do update
    set votes = excluded.votes,
        updated_at = now();

  get diagnostics option_rows = row_count;

  -- Views/Ranking Snapshot fuer "heute" (UTC)
  insert into public.question_metrics_daily (question_id, day, yes_votes, no_votes, views, ranking_score, updated_at)
  select
    q.id,
    (now() at time zone 'UTC')::date as day,
    0,
    0,
    q.views,
    q.ranking_score,
    now()
  from public.questions q
  on conflict (question_id, day) do update
    set views = excluded.views,
        ranking_score = excluded.ranking_score,
        updated_at = now();

  get diagnostics snap_rows = row_count;

  return jsonb_build_object(
    'ok', true,
    'daysBack', coalesce(days_back, 120),
    'startDateUtc', start_date::text,
    'votesRowsUpserted', votes_rows,
    'optionRowsUpserted', option_rows,
    'snapshotRowsUpserted', snap_rows
  );
end;
$$;

revoke all on function public.refresh_question_metrics_daily(integer) from public;
grant execute on function public.refresh_question_metrics_daily(integer) to service_role;

commit;
