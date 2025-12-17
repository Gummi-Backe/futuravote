-- Future-Vote: Demo-/Testdaten fuer "Archiv & Statistiken"
--
-- Zweck:
-- - Fuellt das Archiv mit ein paar "beendeten" (closes_at in der Vergangenheit) Eintraegen,
--   ohne dass sie im Feed auftauchen.
--
-- Hinweis:
-- - Wir setzen `status = 'archived'`, damit die Fragen NICHT im Feed gelistet werden,
--   aber im Archiv trotzdem erscheinen (Archiv filtert nur nach closes_at).
-- - Die Titel sind bewusst als TEST markiert.
--
-- Nutzung in Supabase:
-- - Supabase Dashboard -> SQL Editor -> diesen Block ausfuehren.
-- - Danach `http://localhost:3000/archiv` (oder Prod) neu laden.
--
-- Rueckgaengig machen:
-- - Am Ende dieses Files gibt es ein DELETE-Block.
--
-- Optional (falls `question_resolutions.sql` ausgefuehrt wurde):
-- - Unten gibt es einen UPDATE-Block, um die Test-Fragen als "aufgeloest" zu markieren.

begin;

insert into public.questions (
  id,
  title,
  summary,
  description,
  region,
  category,
  category_icon,
  category_color,
  closes_at,
  yes_votes,
  no_votes,
  views,
  status,
  ranking_score,
  created_at,
  visibility
)
values
  (
    'q_test_archiv_1',
    'TEST (Archiv): Kommt es bis 31.12.2025 zu einem Kabinettsumbau in Deutschland?',
    'Politik · Deutschland',
    'Test-Eintrag fuer das Archiv: Diese Frage ist absichtlich beendet, damit die Archiv-Seite nicht leer wirkt.',
    'Deutschland',
    'Politik',
    '🏛️',
    '#f97316',
    (current_date - 10),
    31,
    19,
    420,
    'archived',
    0,
    (now() - interval '120 days'),
    'public'
  ),
  (
    'q_test_archiv_2',
    'TEST (Archiv): Liegt die Inflationsrate (DE) im November 2025 unter 2,5%?',
    'Wirtschaft · Deutschland',
    'Test-Eintrag fuer das Archiv: Beendete Frage mit Beispiel-Ergebnis (Ja/Nein).',
    'Deutschland',
    'Wirtschaft',
    '💶',
    '#22c55e',
    (current_date - 35),
    14,
    27,
    260,
    'archived',
    0,
    (now() - interval '220 days'),
    'public'
  ),
  (
    'q_test_archiv_3',
    'TEST (Archiv): Erreicht ein europaeisches Team das Finale der Klub-WM 2025?',
    'Sport · Europa',
    'Test-Eintrag fuer das Archiv: Nur zum Ueberpruefen von Layout/Statistiken.',
    'Europa',
    'Sport',
    '⚽',
    '#38bdf8',
    (current_date - 75),
    52,
    12,
    980,
    'archived',
    0,
    (now() - interval '300 days'),
    'public'
  )
on conflict (id) do update
  set title = excluded.title,
      summary = excluded.summary,
      description = excluded.description,
      region = excluded.region,
      category = excluded.category,
      category_icon = excluded.category_icon,
      category_color = excluded.category_color,
      closes_at = excluded.closes_at,
      yes_votes = excluded.yes_votes,
      no_votes = excluded.no_votes,
      views = excluded.views,
      status = excluded.status,
      ranking_score = excluded.ranking_score,
      created_at = excluded.created_at,
      visibility = excluded.visibility;

-- Falls die Aufloesungs-Spalten existieren, markieren wir die Demo-Fragen automatisch als "aufgeloest".
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'questions'
      and column_name = 'resolved_outcome'
  ) then
    update public.questions
    set
      resolved_outcome = case id
        when 'q_test_archiv_1' then 'yes'
        when 'q_test_archiv_2' then 'no'
        when 'q_test_archiv_3' then 'yes'
        else resolved_outcome
      end,
      resolved_at = coalesce(resolved_at, now()),
      resolved_source = coalesce(resolved_source, 'Demo-Test (keine echte Quelle)'),
      resolved_note = coalesce(resolved_note, 'Nur Testdaten fuer Archiv/Erfolgsquote.')
    where id in ('q_test_archiv_1','q_test_archiv_2','q_test_archiv_3');
  end if;
end
$$;

commit;

-- Optional: Test-Fragen als aufgeloest markieren (nur ausfuehren, wenn die Spalten existieren)
-- begin;
-- update public.questions
-- set
--   resolved_outcome = case id
--     when 'q_test_archiv_1' then 'yes'
--     when 'q_test_archiv_2' then 'no'
--     when 'q_test_archiv_3' then 'yes'
--     else resolved_outcome
--   end,
--   resolved_at = now(),
--   resolved_source = 'Demo-Test (keine echte Quelle)',
--   resolved_note = 'Nur Testdaten fuer Archiv/Erfolgsquote.'
-- where id in ('q_test_archiv_1','q_test_archiv_2','q_test_archiv_3');
-- commit;

-- Optional: Votes passend zu den Ja/Nein-Zaehlern einfuegen (damit "Stimmen gesamt"/30T/7T auch realistisch wirken).
-- Hinweis: erzeugt echte Rows in `public.votes` (nur fuer Demo/Tests).
-- begin;
-- insert into public.votes (question_id, session_id, choice, created_at)
-- select 'q_test_archiv_1', 'seed_' || gen_random_uuid()::text, 'yes', (now() - interval '110 days')
-- from generate_series(1, 31);
-- insert into public.votes (question_id, session_id, choice, created_at)
-- select 'q_test_archiv_1', 'seed_' || gen_random_uuid()::text, 'no', (now() - interval '110 days')
-- from generate_series(1, 19);
--
-- insert into public.votes (question_id, session_id, choice, created_at)
-- select 'q_test_archiv_2', 'seed_' || gen_random_uuid()::text, 'yes', (now() - interval '200 days')
-- from generate_series(1, 14);
-- insert into public.votes (question_id, session_id, choice, created_at)
-- select 'q_test_archiv_2', 'seed_' || gen_random_uuid()::text, 'no', (now() - interval '200 days')
-- from generate_series(1, 27);
--
-- insert into public.votes (question_id, session_id, choice, created_at)
-- select 'q_test_archiv_3', 'seed_' || gen_random_uuid()::text, 'yes', (now() - interval '280 days')
-- from generate_series(1, 52);
-- insert into public.votes (question_id, session_id, choice, created_at)
-- select 'q_test_archiv_3', 'seed_' || gen_random_uuid()::text, 'no', (now() - interval '280 days')
-- from generate_series(1, 12);
-- commit;

-- Rueckgaengig machen (optional):
-- begin;
-- delete from public.questions
-- where id in ('q_test_archiv_1','q_test_archiv_2','q_test_archiv_3');
-- commit;
