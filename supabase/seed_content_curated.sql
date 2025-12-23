-- Future-Vote: Seed-Content (kuratiert) fuer einen nicht-leeren Feed
--
-- Ziel:
-- - Ein kleines Startpaket an lauffaehigen Fragen/Umfragen, damit der Feed nach Deploy nicht leer wirkt.
-- - Mischung aus Prognosen (binary) und Meinungs-Umfragen (options).
--
-- WICHTIG:
-- - Nur ausfuehren, wenn du wirklich Start-Content in der DB willst.
-- - Das Script ist idempotent (kann mehrfach laufen).
-- - Rueckgaengig machen: ganz unten gibt es ein DELETE.
--
-- Ausfuehren:
-- - Supabase Dashboard -> SQL Editor -> Run
--
-- Voraussetzungen (optional, aber empfohlen):
-- - `supabase/poll_options.sql` (answer_mode/is_resolvable + question_options)
-- - `supabase/question_resolutions.sql` (resolution_criteria/resolution_source/resolution_deadline)

begin;

-- ---------------------------------------------------------------------------
-- 1) Fragen/Umfragen anlegen (minimaler Kern)
-- ---------------------------------------------------------------------------

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
    'q_seed_politik_1',
    'Kommt es bis Ende 2026 zu einer vorgezogenen Bundestagswahl?',
    'Politik · Deutschland',
    'Prognosefrage: Wird der Bundestag vor dem regulaeren Wahltermin aufgeloest und eine Neuwahl angesetzt?',
    'Deutschland',
    'Politik',
    '🏛️',
    '#f97316',
    (current_date + 180),
    0,
    0,
    0,
    null,
    0,
    (now() - interval '1 day'),
    'public'
  ),
  (
    'q_seed_politik_2',
    'Wie bewerten Sie die Arbeit der aktuellen Bundesregierung?',
    'Politik · Deutschland',
    'Meinungs-Umfrage: Eine kurze Einschätzung ohne spaetere Aufloesung. Ergebnisse sind live sichtbar.',
    'Deutschland',
    'Politik',
    '🏛️',
    '#f97316',
    (current_date + 60),
    0,
    0,
    0,
    null,
    0,
    (now() - interval '2 days'),
    'public'
  ),

  (
    'q_seed_wirtschaft_1',
    'Liegt die Inflationsrate in Deutschland im Dezember 2026 unter 3,0%?',
    'Wirtschaft · Deutschland',
    'Prognosefrage: Bezieht sich auf die offizielle Inflationsrate (VPI) fuer Dezember 2026.',
    'Deutschland',
    'Wirtschaft',
    '💹',
    '#22c55e',
    (current_date + 240),
    0,
    0,
    0,
    null,
    0,
    (now() - interval '3 days'),
    'public'
  ),
  (
    'q_seed_wirtschaft_2',
    'Was ist aktuell Ihr groesstes finanzielles Thema?',
    'Wirtschaft · Deutschland',
    'Meinungs-Umfrage: Welche finanzielle Sorge/Frage beschaeftigt Sie gerade am meisten?',
    'Deutschland',
    'Wirtschaft',
    '💹',
    '#22c55e',
    (current_date + 45),
    0,
    0,
    0,
    null,
    0,
    (now() - interval '4 days'),
    'public'
  ),

  (
    'q_seed_tech_1',
    'Wird die EU bis Ende 2026 neue verbindliche Regeln fuer generative KI beschliessen?',
    'Tech · Europa',
    'Prognosefrage: Gemeint sind neue, zusaetzliche verbindliche Vorgaben speziell fuer generative KI (ueber bestehende Gesetze hinaus).',
    'Europa',
    'Tech',
    '🤖',
    '#6366f1',
    (current_date + 180),
    0,
    0,
    0,
    null,
    0,
    (now() - interval '2 days'),
    'public'
  ),
  (
    'q_seed_tech_2',
    'Welche KI-Anwendung nutzen Sie am haeufigsten?',
    'Tech · Global',
    'Meinungs-Umfrage: Wofuer setzen Sie KI im Alltag oder Beruf am ehesten ein?',
    'Global',
    'Tech',
    '🤖',
    '#6366f1',
    (current_date + 45),
    0,
    0,
    0,
    null,
    0,
    (now() - interval '1 day'),
    'public'
  ),

  (
    'q_seed_klima_1',
    'Wird Deutschland sein Klimaziel 2030 (gesetzlich) erreichen?',
    'Klima · Deutschland',
    'Prognosefrage: Gemeint ist das gesetzliche Ziel/der Zielpfad fuer 2030 (je nach aktueller Gesetzeslage).',
    'Deutschland',
    'Klima',
    '🌱',
    '#16a34a',
    (current_date + 365),
    0,
    0,
    0,
    null,
    0,
    (now() - interval '5 days'),
    'public'
  ),
  (
    'q_seed_klima_2',
    'Welche Massnahme gegen den Klimawandel hat fuer Sie Prioritaet?',
    'Klima · Deutschland',
    'Meinungs-Umfrage: Was sollte politisch/gesellschaftlich als Erstes angegangen werden?',
    'Deutschland',
    'Klima',
    '🌱',
    '#16a34a',
    (current_date + 60),
    0,
    0,
    0,
    null,
    0,
    (now() - interval '6 days'),
    'public'
  ),

  (
    'q_seed_gesellschaft_1',
    'Sinkt die Zustimmung zur Demokratie in Deutschland bis Ende 2026?',
    'Gesellschaft · Deutschland',
    'Prognosefrage: Bezieht sich auf wiederkehrende repraesentative Umfragen (Trend in mehreren Erhebungen).',
    'Deutschland',
    'Gesellschaft',
    '👥',
    '#eab308',
    (current_date + 180),
    0,
    0,
    0,
    null,
    0,
    (now() - interval '7 days'),
    'public'
  ),
  (
    'q_seed_gesellschaft_2',
    'Wie zufrieden sind Sie aktuell mit dem gesellschaftlichen Zusammenhalt?',
    'Gesellschaft · Deutschland',
    'Meinungs-Umfrage: Ihr persoenlicher Eindruck im Alltag.',
    'Deutschland',
    'Gesellschaft',
    '👥',
    '#eab308',
    (current_date + 45),
    0,
    0,
    0,
    null,
    0,
    (now() - interval '2 days'),
    'public'
  ),

  (
    'q_seed_sport_1',
    'Gewinnt Deutschland bei der Fussball-EM 2028 mindestens das Halbfinale?',
    'Sport · Europa',
    'Prognosefrage: Deutschland erreicht mindestens das Halbfinale (Top 4).',
    'Europa',
    'Sport',
    '🏅',
    '#06b6d4',
    (current_date + 365),
    0,
    0,
    0,
    null,
    0,
    (now() - interval '4 days'),
    'public'
  ),
  (
    'q_seed_sport_2',
    'Welche Sportart verfolgen Sie am haeufigsten?',
    'Sport · Deutschland',
    'Meinungs-Umfrage: Was schauen/lesen Sie regelmaessig?',
    'Deutschland',
    'Sport',
    '🏅',
    '#06b6d4',
    (current_date + 60),
    0,
    0,
    0,
    null,
    0,
    (now() - interval '3 days'),
    'public'
  ),

  (
    'q_seed_welt_1',
    'Kommt es bis Ende 2026 zu einem neuen grossen Handelsabkommen zwischen EU und USA?',
    'Welt · Global',
    'Prognosefrage: Ein offiziell verkuendetes, neues oder deutlich erweitertes Handelsabkommen zwischen EU und USA.',
    'Global',
    'Welt',
    '🌍',
    '#3b82f6',
    (current_date + 180),
    0,
    0,
    0,
    null,
    0,
    (now() - interval '8 days'),
    'public'
  ),
  (
    'q_seed_welt_2',
    'Welche internationale Entwicklung besorgt Sie aktuell am meisten?',
    'Welt · Global',
    'Meinungs-Umfrage: Eine persoenliche Einschätzung ohne Aufloesung.',
    'Global',
    'Welt',
    '🌍',
    '#3b82f6',
    (current_date + 45),
    0,
    0,
    0,
    null,
    0,
    (now() - interval '1 day'),
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

-- ---------------------------------------------------------------------------
-- 2) Falls Options-Feature aktiv: answer_mode/is_resolvable + Optionen setzen
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='questions' and column_name='answer_mode'
  ) then
    -- Prognosen (binary)
    update public.questions
      set answer_mode='binary', is_resolvable=true
      where id in (
        'q_seed_politik_1','q_seed_wirtschaft_1','q_seed_tech_1','q_seed_klima_1','q_seed_gesellschaft_1','q_seed_sport_1','q_seed_welt_1'
      );

    -- Meinungs-Umfragen (options)
    update public.questions
      set answer_mode='options', is_resolvable=false
      where id in (
        'q_seed_politik_2','q_seed_wirtschaft_2','q_seed_tech_2','q_seed_klima_2','q_seed_gesellschaft_2','q_seed_sport_2','q_seed_welt_2'
      );
  end if;
end
$$;

do $$
begin
  if to_regclass('public.question_options') is null then
    return;
  end if;

  -- Optionen idempotent neu aufbauen (damit Labels/Sortierung sauber sind).
  delete from public.question_options
    where question_id in (
      'q_seed_politik_2','q_seed_wirtschaft_2','q_seed_tech_2','q_seed_klima_2','q_seed_gesellschaft_2','q_seed_sport_2','q_seed_welt_2'
    );

  insert into public.question_options (question_id, label, sort_order, votes_count)
  values
    ('q_seed_politik_2','Sehr gut',1,0),
    ('q_seed_politik_2','Eher gut',2,0),
    ('q_seed_politik_2','Neutral',3,0),
    ('q_seed_politik_2','Eher schlecht',4,0),
    ('q_seed_politik_2','Sehr schlecht',5,0),

    ('q_seed_wirtschaft_2','Inflation',1,0),
    ('q_seed_wirtschaft_2','Mieten/Wohnen',2,0),
    ('q_seed_wirtschaft_2','Energiepreise',3,0),
    ('q_seed_wirtschaft_2','Steuern/Abgaben',4,0),
    ('q_seed_wirtschaft_2','Job/Gehaltsentwicklung',5,0),
    ('q_seed_wirtschaft_2','Sonstiges',6,0),

    ('q_seed_tech_2','Recherche/Information',1,0),
    ('q_seed_tech_2','Text schreiben/zusammenfassen',2,0),
    ('q_seed_tech_2','Programmieren',3,0),
    ('q_seed_tech_2','Bilder erstellen',4,0),
    ('q_seed_tech_2','Planung/Organisation',5,0),
    ('q_seed_tech_2','Nutze ich kaum',6,0),

    ('q_seed_klima_2','Energie (Netze/Erneuerbare)',1,0),
    ('q_seed_klima_2','Verkehr',2,0),
    ('q_seed_klima_2','Industrie',3,0),
    ('q_seed_klima_2','Gebaeude/Waerme',4,0),
    ('q_seed_klima_2','Landwirtschaft',5,0),
    ('q_seed_klima_2','Konsum/Abfall',6,0),

    ('q_seed_gesellschaft_2','Sehr zufrieden',1,0),
    ('q_seed_gesellschaft_2','Eher zufrieden',2,0),
    ('q_seed_gesellschaft_2','Neutral',3,0),
    ('q_seed_gesellschaft_2','Eher unzufrieden',4,0),
    ('q_seed_gesellschaft_2','Sehr unzufrieden',5,0),

    ('q_seed_sport_2','Fussball',1,0),
    ('q_seed_sport_2','Handball',2,0),
    ('q_seed_sport_2','Basketball',3,0),
    ('q_seed_sport_2','Tennis',4,0),
    ('q_seed_sport_2','Motorsport',5,0),
    ('q_seed_sport_2','Sonstiges',6,0),

    ('q_seed_welt_2','Krieg/Konflikte',1,0),
    ('q_seed_welt_2','Wirtschaft/Rezession',2,0),
    ('q_seed_welt_2','Klima/Katastrophen',3,0),
    ('q_seed_welt_2','Migration',4,0),
    ('q_seed_welt_2','Technologie/KI',5,0),
    ('q_seed_welt_2','Sonstiges',6,0);
end
$$;

-- ---------------------------------------------------------------------------
-- 3) Falls Aufloesungs-Spalten existieren: Regeln/Quelle/Deadline setzen
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public' and table_name='questions' and column_name='resolution_criteria'
  ) then
    return;
  end if;

  update public.questions
  set
    resolution_criteria = case id
      when 'q_seed_politik_1' then 'Offizielle Bekanntgabe einer vorgezogenen Bundestagswahl (Aufloesung des Bundestags oder Neuwahl-Termin) vor 31.12.2026.'
      when 'q_seed_wirtschaft_1' then 'Die offizielle Inflationsrate (VPI) fuer Dezember 2026 liegt unter 3,0%.'
      when 'q_seed_tech_1' then 'Die EU veroeffentlicht/beschliesst neue verbindliche Regeln speziell fuer generative KI bis 31.12.2026.'
      when 'q_seed_klima_1' then 'Offizielle Berichte/Status der Bundesregierung oder zustaendige Stellen bestaetigen das Erreichen des 2030-Ziels (oder das Verfehlen).'
      when 'q_seed_gesellschaft_1' then 'Mehrere repraesentative Umfragen (mind. 2 Quellen) zeigen bis 31.12.2026 einen klaren Rueckgang in der Zustimmung zur Demokratie im Vergleich zum Startwert 2025.'
      when 'q_seed_sport_1' then 'Deutschland erreicht bei der Fussball-EM 2028 mindestens das Halbfinale.'
      when 'q_seed_welt_1' then 'EU und USA verkuenden ein neues oder deutlich erweitertes Handelsabkommen offiziell bis 31.12.2026.'
      else resolution_criteria
    end,
    resolution_source = case id
      when 'q_seed_politik_1' then 'Bundestag / Bundesregierung (offizielle Mitteilungen)'
      when 'q_seed_wirtschaft_1' then 'Destatis (Statistisches Bundesamt)'
      when 'q_seed_tech_1' then 'EU (EUR-Lex / Kommission / Parlament) + serioese Medien'
      when 'q_seed_klima_1' then 'Bundesregierung / UBA (Umweltbundesamt) / offizieller Bericht'
      when 'q_seed_gesellschaft_1' then 'Mehrere repraesentative Umfragen (z.B. Infratest dimap, Allensbach, Forschungsinstitute)'
      when 'q_seed_sport_1' then 'UEFA / offizieller Turnierplan + Ergebnislisten'
      when 'q_seed_welt_1' then 'EU Kommission + USTR / offizielle Mitteilungen'
      else resolution_source
    end,
    resolution_deadline = case id
      when 'q_seed_politik_1' then (current_date + 210)
      when 'q_seed_wirtschaft_1' then (current_date + 270)
      when 'q_seed_tech_1' then (current_date + 210)
      when 'q_seed_klima_1' then (current_date + 390)
      when 'q_seed_gesellschaft_1' then (current_date + 210)
      when 'q_seed_sport_1' then (current_date + 390)
      when 'q_seed_welt_1' then (current_date + 210)
      else resolution_deadline
    end
  where id in (
    'q_seed_politik_1','q_seed_wirtschaft_1','q_seed_tech_1','q_seed_klima_1','q_seed_gesellschaft_1','q_seed_sport_1','q_seed_welt_1'
  );
end
$$;

commit;

-- Rueckgaengig machen (optional):
-- begin;
-- delete from public.questions
-- where id like 'q_seed_%';
-- commit;

