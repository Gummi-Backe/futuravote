-- Future-Vote: Manuelle Aufloesung von Fragen (Basis fuer Archiv-Erfolgsquote)
--
-- Ziel:
-- - Wir speichern das "tatsaechliche Ergebnis" einer Frage (ja/nein) + Quelle/Notiz.
-- - Daraus kann die Archiv-Seite spaeter die Erfolgsquote der Community berechnen.
--
-- Ausfuehren:
-- - Supabase Dashboard -> SQL Editor -> Run

begin;

alter table if exists public.questions
  add column if not exists resolution_criteria text,
  add column if not exists resolution_source text,
  add column if not exists resolution_deadline timestamptz,
  add column if not exists resolved_outcome text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_source text,
  add column if not exists resolved_note text;

alter table if exists public.drafts
  add column if not exists resolution_criteria text,
  add column if not exists resolution_source text,
  add column if not exists resolution_deadline timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_resolved_outcome_check'
  ) then
    alter table public.questions
      add constraint questions_resolved_outcome_check
      check (resolved_outcome is null or resolved_outcome in ('yes','no'));
  end if;
end
$$;

create index if not exists questions_resolved_at_idx
  on public.questions (resolved_at);

create index if not exists questions_resolution_deadline_idx
  on public.questions (resolution_deadline);

commit;
