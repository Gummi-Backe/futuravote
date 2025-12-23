-- Future-Vote: Demo-Aktivitaet (Votes/Reviews/Reports/Analytics)
--
-- Ziel:
-- - Realistische Testdaten erzeugen, als haetten ~20-50 Personen abgestimmt.
-- - Damit lassen sich Feed, Kacheln, Detail-Trends, Review-Board, Admin-Queues und Analytics testen.
--
-- Voraussetzungen (empfohlen):
-- - `supabase/poll_options.sql` (Options-Umfragen)
-- - `supabase/votes_hardening.sql` (votes.id + Constraints)
-- - `supabase/rls_policies.sql` (RLS baseline)
--
-- Ausfuehren:
-- - Supabase Dashboard -> SQL Editor -> Run
--
-- Idempotent:
-- - Dieses Script loescht vorher seine eigenen Demo-Rows (prefix `seed_demo_`), dann fuegt es neu ein.
--
-- Hinweis:
-- - Es werden KEINE neuen User angelegt (user_id bleibt NULL), damit nichts mit Auth kollidiert.
-- - Wenn du Rangliste/Punkte mit echten user_id testen willst, sag Bescheid – dann seedet man gezielt Test-Users.

begin;

-- ---------------------------------------------------------------------------
-- 0) Demo-Sessions erzeugen
-- ---------------------------------------------------------------------------

create temporary table if not exists _seed_sessions (
  session_id text primary key
);

truncate _seed_sessions;

insert into _seed_sessions (session_id)
select 'seed_demo_' || gen_random_uuid()::text
from generate_series(1, 60);

-- ---------------------------------------------------------------------------
-- 1) Alte Demo-Daten entfernen (nur dieses Script)
-- ---------------------------------------------------------------------------

delete from public.analytics_events where session_id like 'seed_demo_%';
delete from public.reports where reporter_session_id like 'seed_demo_%';
delete from public.draft_reviews where session_id like 'seed_demo_%';
delete from public.votes where session_id like 'seed_demo_%';

-- ---------------------------------------------------------------------------
-- 2) Votes fuer Fragen erzeugen (20-50 pro Frage)
--    - verteilt ueber die letzten 30 Tage (Trend/Charts wirken "echt")
-- ---------------------------------------------------------------------------

do $$
declare
  q record;
  vote_count integer;
  opt_count integer;
begin
  for q in
    select id, answer_mode
    from public.questions
    where visibility = 'public'
      and (
        id like 'q_seed_%'
        or id like 'q_test_archiv_%'
        or id like 'q_demo_resolved_%'
      )
  loop
    vote_count := 20 + floor(random() * 31)::int; -- 20..50

    if coalesce(q.answer_mode, 'binary') = 'options' then
      select count(*) into opt_count
      from public.question_options
      where question_id = q.id;

      -- Wenn Optionen fehlen, ueberspringen wir (sonst verletzt es die XOR-Constraint).
      if opt_count < 2 then
        continue;
      end if;

      insert into public.votes (question_id, session_id, user_id, choice, option_id, created_at)
      select
        q.id,
        s.session_id,
        null,
        null,
        (
          select qo.id
          from public.question_options qo
          where qo.question_id = q.id
          order by random()
          limit 1
        ),
        (now() - (random() * interval '30 days') - (random() * interval '12 hours'))
      from (
        select session_id
        from _seed_sessions
        order by random()
        limit vote_count
      ) s;
    else
      insert into public.votes (question_id, session_id, user_id, choice, option_id, created_at)
      select
        q.id,
        s.session_id,
        null,
        case when random() < 0.55 then 'yes' else 'no' end,
        null,
        (now() - (random() * interval '30 days') - (random() * interval '12 hours'))
      from (
        select session_id
        from _seed_sessions
        order by random()
        limit vote_count
      ) s;
    end if;

    -- Views etwas anheben (Feed wirkt belebter)
    update public.questions
    set views = greatest(coalesce(views, 0), (250 + floor(random() * 2600))::int)
    where id = q.id;
  end loop;
end
$$;

-- Aggregierte Zaehler konsistent machen (falls du vorher manuell seedest/loeschst)
-- 2a) Binary: yes/no in questions nach votes berechnen
update public.questions q
set
  yes_votes = coalesce(v.yes_votes, 0),
  no_votes = coalesce(v.no_votes, 0)
from (
  select
    question_id,
    sum(case when choice = 'yes' then 1 else 0 end) as yes_votes,
    sum(case when choice = 'no' then 1 else 0 end) as no_votes
  from public.votes
  where question_id in (
    select id
    from public.questions
    where visibility = 'public'
      and (
        id like 'q_seed_%'
        or id like 'q_test_archiv_%'
        or id like 'q_demo_resolved_%'
      )
  )
  group by question_id
) v
where q.id = v.question_id
  and coalesce(q.answer_mode, 'binary') = 'binary';

-- 2b) Options: votes_count in question_options nach votes berechnen
update public.question_options qo
set votes_count = coalesce(v.cnt, 0)
from (
  select qo2.id, count(v2.*) as cnt
  from public.question_options qo2
  left join public.votes v2 on v2.option_id = qo2.id
  where qo2.question_id in (
    select id
    from public.questions
    where visibility = 'public' and answer_mode = 'options'
      and (
        id like 'q_seed_%'
        or id like 'q_test_archiv_%'
        or id like 'q_demo_resolved_%'
      )
  )
  group by qo2.id
) v
where qo.id = v.id;

-- ---------------------------------------------------------------------------
-- 3) Draft-Reviews seed'en (Review-Bereich wirkt aktiv)
-- ---------------------------------------------------------------------------

do $$
declare
  d record;
  review_count integer;
begin
  for d in
    select id
    from public.drafts
    where visibility = 'public'
      and coalesce(status, 'open') = 'open'
  loop
    review_count := 8 + floor(random() * 16)::int; -- 8..23

    insert into public.draft_reviews (draft_id, session_id, choice, created_at)
    select
      d.id,
      s.session_id,
      case when random() < 0.65 then 'good' else 'bad' end,
      (now() - (random() * interval '10 days'))
    from (
      select session_id
      from _seed_sessions
      order by random()
      limit review_count
    ) s;
  end loop;
end
$$;

-- Draft-Zaehler konsistent machen (votes_for/votes_against aus draft_reviews)
update public.drafts d
set
  votes_for = coalesce(r.good, 0),
  votes_against = coalesce(r.bad, 0)
from (
  select
    draft_id,
    sum(case when choice = 'good' then 1 else 0 end) as good,
    sum(case when choice = 'bad' then 1 else 0 end) as bad
  from public.draft_reviews
  group by draft_id
) r
where d.id = r.draft_id;

-- ---------------------------------------------------------------------------
-- 4) Reports seed'en (Admin-Queue hat Beispiele)
-- ---------------------------------------------------------------------------

insert into public.reports (kind, item_id, item_title, reason, message, page_url, reporter_session_id, reporter_user_id, status, created_at)
select
  'question',
  q.id,
  q.title,
  'other',
  'Demo-Report: bitte pruefen (Testdaten).',
  '/questions/' || q.id,
  (select session_id from _seed_sessions order by random() limit 1),
  null,
  'open',
  now() - interval '2 days'
from public.questions q
where q.visibility = 'public'
  and q.id like 'q_seed_%'
limit 1;

insert into public.reports (kind, item_id, item_title, reason, message, page_url, reporter_session_id, reporter_user_id, status, created_at)
select
  'draft',
  d.id,
  d.title,
  'spam',
  'Demo-Report: wirkt wie Spam (Testdaten).',
  '/?tab=review',
  (select session_id from _seed_sessions order by random() limit 1),
  null,
  'open',
  now() - interval '1 day'
from public.drafts d
where d.visibility = 'public'
limit 1;

-- ---------------------------------------------------------------------------
-- 5) Analytics Events seed'en (Admin-Analytics zeigt Aktivitaet)
-- ---------------------------------------------------------------------------

insert into public.analytics_events (event, path, referrer, session_id, user_id, meta, created_at)
select
  e.event,
  e.path,
  null,
  s.session_id,
  null,
  e.meta,
  now() - (random() * interval '6 days')
from _seed_sessions s
cross join (
  values
    ('visit','/', '{}'::jsonb),
    ('vote_question','/', jsonb_build_object('demo', true)),
    ('open_question','/questions/q_seed_politik_1', jsonb_build_object('demo', true)),
    ('share','/questions/q_seed_politik_1', jsonb_build_object('demo', true))
) as e(event, path, meta)
where random() < 0.35;

commit;

-- Rueckgaengig machen (optional):
-- begin;
-- delete from public.analytics_events where session_id like 'seed_demo_%';
-- delete from public.reports where reporter_session_id like 'seed_demo_%';
-- delete from public.draft_reviews where session_id like 'seed_demo_%';
-- delete from public.votes where session_id like 'seed_demo_%';
-- commit;
