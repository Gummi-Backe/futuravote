-- Future-Vote: Demo-/Testdaten fuer "aufgeloeste" Fragen
--
-- Zweck:
-- - Erzeugt ein paar bereits entschiedene Fragen, damit man
--   - Archiv/Erfolgsquote
--   - Success-Card (Teilen)
--   - Rangliste (nur wenn auch echte Votes mit user_id existieren)
--   testen kann.
--
-- Nutzung in Supabase:
-- - Supabase Dashboard -> SQL Editor -> diesen Block ausfuehren.
-- - Danach im Browser z.B. `/archiv` oder die Detailseite oeffnen.
--
-- Rueckgaengig machen:
-- - Am Ende dieses Files gibt es ein DELETE-Block.

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
    'q_demo_resolved_1',
    'TEST (aufgeloest): Wird das Deutschlandticket bis 31.12.2025 teurer?',
    'Wirtschaft - Deutschland',
    'Demo-Frage fuer Tests: bereits beendet und mit Ergebnis eingetragen.',
    'Deutschland',
    'Wirtschaft',
    '💶',
    '#22c55e',
    (current_date - 12),
    38,
    22,
    120,
    'archived',
    0,
    (now() - interval '160 days'),
    'public'
  ),
  (
    'q_demo_resolved_2',
    'TEST (aufgeloest): Erreicht ein afrikanisches Team bei der WM 2026 das Halbfinale?',
    'Sport - Global',
    'Demo-Frage fuer Tests: bereits beendet und mit Ergebnis eingetragen.',
    'Global',
    'Sport',
    '⚽',
    '#06b6d4',
    (current_date - 30),
    12,
    41,
    260,
    'archived',
    0,
    (now() - interval '220 days'),
    'public'
  ),
  (
    'q_demo_resolved_3',
    'TEST (aufgeloest): Startet Artemis II bis 31.12.2026?',
    'Tech - Welt',
    'Demo-Frage fuer Tests: bereits beendet und mit Ergebnis eingetragen.',
    'Welt',
    'Tech',
    '🤖',
    '#6366f1',
    (current_date - 3),
    57,
    19,
    640,
    'archived',
    0,
    (now() - interval '120 days'),
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

-- Falls die Aufloesungs-Spalten existieren, markieren wir die Demo-Fragen als "aufgeloest".
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
      resolution_criteria = coalesce(resolution_criteria, 'Demo-Test: Ergebnis wurde manuell gesetzt.'),
      resolution_source = coalesce(resolution_source, 'Demo-Test (keine echte Quelle)'),
      resolution_deadline = coalesce(resolution_deadline, now() - interval '1 day'),
      resolved_outcome = case id
        when 'q_demo_resolved_1' then 'yes'
        when 'q_demo_resolved_2' then 'no'
        when 'q_demo_resolved_3' then 'yes'
        else resolved_outcome
      end,
      resolved_at = coalesce(resolved_at, now() - interval '1 day'),
      resolved_source = coalesce(resolved_source, 'https://example.com (Demo)'),
      resolved_note = coalesce(resolved_note, 'Nur Testdaten fuer Archiv/Success-Card.')
    where id in ('q_demo_resolved_1','q_demo_resolved_2','q_demo_resolved_3');
  end if;
end
$$;

commit;

-- Rueckgaengig machen (optional):
-- begin;
-- delete from public.questions
-- where id in ('q_demo_resolved_1','q_demo_resolved_2','q_demo_resolved_3');
-- commit;
