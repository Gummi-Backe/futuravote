-- FutureVote Phase 0: persistente Limits, atomare Stimmen/Reviews und Sessions.
-- Vor dem dazugehoerigen App-Deploy einmal im Supabase SQL Editor ausfuehren.

begin;

-- Der Free-Tarif hat keine geplanten Backups. Diese einmaligen Snapshots bleiben
-- ausserhalb des exponierten public-Schemas und ermoeglichen eine manuelle
-- Wiederherstellung der Daten, die diese Migration veraendert.
create schema if not exists migration_backups;
revoke all on schema migration_backups from public, anon, authenticated;

create table if not exists migration_backups.phase0_votes_20260809
  as table public.votes;
create table if not exists migration_backups.phase0_questions_20260809
  as table public.questions;
create table if not exists migration_backups.phase0_question_options_20260809
  as table public.question_options;
create table if not exists migration_backups.phase0_user_sessions_20260809
  as table public.user_sessions;

alter table migration_backups.phase0_votes_20260809 enable row level security;
alter table migration_backups.phase0_questions_20260809 enable row level security;
alter table migration_backups.phase0_question_options_20260809 enable row level security;
alter table migration_backups.phase0_user_sessions_20260809 enable row level security;

revoke all on all tables in schema migration_backups from public, anon, authenticated;

alter table if exists public.drafts
  add column if not exists decision_source text
  check (decision_source in ('community', 'admin'));

create table if not exists public.api_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  hit_count integer not null default 0 check (hit_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;

create or replace function public.consume_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_row public.api_rate_limits%rowtype;
  safe_limit integer := greatest(1, coalesce(p_limit, 1));
  safe_window integer := greatest(1, coalesce(p_window_seconds, 1));
  elapsed_seconds integer;
begin
  if random() < 0.01 then
    delete from public.api_rate_limits
    where updated_at < now() - interval '30 days';
  end if;

  insert into public.api_rate_limits (key_hash, window_started_at, hit_count, updated_at)
  values (p_key_hash, now(), 0, now())
  on conflict (key_hash) do nothing;

  select * into current_row
  from public.api_rate_limits
  where key_hash = p_key_hash
  for update;

  elapsed_seconds := greatest(0, floor(extract(epoch from (now() - current_row.window_started_at)))::integer);

  if elapsed_seconds >= safe_window then
    update public.api_rate_limits
    set window_started_at = now(), hit_count = 1, updated_at = now()
    where key_hash = p_key_hash;
    return query select true, 0;
  elsif current_row.hit_count >= safe_limit then
    return query select false, greatest(1, safe_window - elapsed_seconds);
  else
    update public.api_rate_limits
    set hit_count = hit_count + 1, updated_at = now()
    where key_hash = p_key_hash;
    return query select true, 0;
  end if;
end;
$$;

revoke all on table public.api_rate_limits from public, anon, authenticated;
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

alter table if exists public.user_sessions
  add column if not exists expires_at timestamptz;

update public.user_sessions
set expires_at = now() + interval '30 days'
where expires_at is null;

alter table if exists public.user_sessions
  alter column expires_at set default (now() + interval '30 days'),
  alter column expires_at set not null;

-- Bestehende Mehrfachstimmen pro Account bereinigen, danach DB-seitig verhindern.
with ranked as (
  select
    ctid,
    row_number() over (
      partition by question_id, user_id
      order by created_at desc nulls last
    ) as rn
  from public.votes
  where user_id is not null
)
delete from public.votes v
using ranked r
where v.ctid = r.ctid and r.rn > 1;

create unique index if not exists votes_unique_question_user
  on public.votes (question_id, user_id)
  where user_id is not null;

-- Zaehler nach dem Deduplizieren aus den Rohstimmen neu aufbauen.
update public.questions q
set yes_votes = coalesce((select count(*) from public.votes v where v.question_id = q.id and v.choice = 'yes'), 0),
    no_votes = coalesce((select count(*) from public.votes v where v.question_id = q.id and v.choice = 'no'), 0);

update public.question_options qo
set votes_count = coalesce((select count(*) from public.votes v where v.option_id = qo.id), 0);

create or replace function public.cast_question_vote(
  p_question_id text,
  p_session_id text,
  p_user_id text,
  p_choice text,
  p_option_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  question_row public.questions%rowtype;
begin
  select * into question_row
  from public.questions
  where id = p_question_id
  for update;

  if not found then
    raise exception 'question_not_found';
  end if;

  -- Das angegebene Enddatum ist einschliesslich; geschlossen wird erst am Folgetag.
  if coalesce(question_row.status, '') = 'archived' or question_row.closes_at::date < current_date then
    raise exception 'question_closed';
  end if;

  if p_user_id is not null and exists (
    select 1 from public.votes where question_id = p_question_id and user_id = p_user_id
  ) then
    return true;
  end if;

  if exists (
    select 1 from public.votes where question_id = p_question_id and session_id = p_session_id
  ) then
    return true;
  end if;

  if coalesce(question_row.answer_mode, 'binary') = 'options' then
    if p_option_id is null or p_choice is not null or not exists (
      select 1 from public.question_options where id = p_option_id and question_id = p_question_id
    ) then
      raise exception 'invalid_option';
    end if;

    insert into public.votes (question_id, session_id, user_id, choice, option_id, created_at)
    values (p_question_id, p_session_id, p_user_id, null, p_option_id, now());

    update public.question_options
    set votes_count = votes_count + 1
    where id = p_option_id;
  else
    if p_choice is null or p_choice not in ('yes', 'no') or p_option_id is not null then
      raise exception 'invalid_choice';
    end if;

    insert into public.votes (question_id, session_id, user_id, choice, option_id, created_at)
    values (p_question_id, p_session_id, p_user_id, p_choice, null, now());

    update public.questions
    set yes_votes = yes_votes + case when p_choice = 'yes' then 1 else 0 end,
        no_votes = no_votes + case when p_choice = 'no' then 1 else 0 end
    where id = p_question_id;
  end if;

  return false;
exception
  when unique_violation then
    return true;
end;
$$;

revoke all on function public.cast_question_vote(text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.cast_question_vote(text, text, text, text, uuid) to service_role;

alter table if exists public.draft_reviews
  add column if not exists reviewer_user_id text;

create unique index if not exists draft_reviews_unique_draft_user
  on public.draft_reviews (draft_id, reviewer_user_id)
  where reviewer_user_id is not null;

create or replace function public.cast_draft_review(
  p_draft_id text,
  p_session_id text,
  p_reviewer_user_id text,
  p_choice text
)
returns table(votes_for integer, votes_against integer, already_voted boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  draft_row public.drafts%rowtype;
  next_votes_for integer;
  next_votes_against integer;
begin
  if p_reviewer_user_id is null or p_choice not in ('good', 'bad') then
    raise exception 'invalid_review';
  end if;

  select * into draft_row
  from public.drafts
  where id = p_draft_id
  for update;

  if not found then
    raise exception 'draft_not_found';
  end if;

  if draft_row.creator_id is not null and draft_row.creator_id = p_reviewer_user_id then
    raise exception 'self_review_not_allowed';
  end if;

  if coalesce(draft_row.status, 'open') <> 'open' then
    return query select coalesce(draft_row.votes_for, 0), coalesce(draft_row.votes_against, 0), true;
    return;
  end if;

  if draft_row.created_at::timestamptz + interval '72 hours' <= now() then
    raise exception 'review_expired';
  end if;

  if exists (
    select 1 from public.draft_reviews
    where draft_id = p_draft_id and reviewer_user_id = p_reviewer_user_id
  ) then
    return query select coalesce(draft_row.votes_for, 0), coalesce(draft_row.votes_against, 0), true;
    return;
  end if;

  insert into public.draft_reviews (draft_id, session_id, reviewer_user_id, choice)
  values (p_draft_id, p_session_id, p_reviewer_user_id, p_choice);

  update public.drafts as d
  set votes_for = d.votes_for + case when p_choice = 'good' then 1 else 0 end,
      votes_against = d.votes_against + case when p_choice = 'bad' then 1 else 0 end
  where d.id = p_draft_id
  returning d.votes_for, d.votes_against
  into next_votes_for, next_votes_against;

  return query select coalesce(next_votes_for, 0), coalesce(next_votes_against, 0), false;
exception
  when unique_violation then
    return query select coalesce(draft_row.votes_for, 0), coalesce(draft_row.votes_against, 0), true;
end;
$$;

revoke all on function public.cast_draft_review(text, text, text, text) from public, anon, authenticated;
grant execute on function public.cast_draft_review(text, text, text, text) to service_role;

create or replace function public.increment_question_views(p_question_id text)
returns integer
language sql
security definer
set search_path = pg_catalog, public
as $$
  update public.questions
  set views = coalesce(views, 0) + 1
  where id = p_question_id
  returning views;
$$;

revoke all on function public.increment_question_views(text) from public, anon, authenticated;
grant execute on function public.increment_question_views(text) to service_role;

create unique index if not exists reports_unique_per_user_item
  on public.reports (kind, item_id, reporter_user_id)
  where status = 'open' and reporter_user_id is not null;

commit;
