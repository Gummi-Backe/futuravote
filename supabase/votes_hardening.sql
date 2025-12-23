-- Future-Vote: Votes-Hardening (id + Constraints fuer binary/options)
--
-- Ziel:
-- - `votes` bekommt einen stabilen Primary Key (`id`), damit Abfragen nie von einer fehlenden id-Spalte abhängen.
-- - DB-seitig Absicherung: pro (question_id, session_id) genau eine Stimme.
-- - DB-seitig Absicherung: entweder `choice` (yes/no) ODER `option_id` (Options-Umfrage).
--
-- Ausfuehren:
-- - Supabase Dashboard -> SQL Editor -> Run
--
-- Hinweis:
-- - Das Script ist idempotent (kann mehrfach laufen).
-- - Es entfernt ggf. doppelte Stimmen pro (question_id, session_id) und behält dabei die neueste (created_at).

begin;

-- 1) Primary Key (uuid) ergaenzen, falls nicht vorhanden
alter table if exists public.votes
  add column if not exists id uuid;

alter table if exists public.votes
  alter column id set default gen_random_uuid();

-- Bestehende Rows backfillen
update public.votes
set id = gen_random_uuid()
where id is null;

-- Primary Key nur setzen, wenn noch keiner existiert
do $$
begin
  if to_regclass('public.votes') is null then
    return;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.votes'::regclass
      and contype = 'p'
  ) then
    alter table public.votes
      alter column id set not null;
    alter table public.votes
      add constraint votes_pkey primary key (id);
  end if;
end
$$;

-- 2) choice muss NULL sein duerfen (Options-Umfrage)
alter table if exists public.votes
  alter column choice drop not null;

-- 3) Dedupe: pro (question_id, session_id) nur die neueste Row behalten (idempotent)
with ranked as (
  select
    ctid,
    row_number() over (
      partition by question_id, session_id
      order by created_at desc nulls last
    ) as rn
  from public.votes
)
delete from public.votes v
using ranked r
where v.ctid = r.ctid
  and r.rn > 1;

-- 4) Unique Index: eine Stimme pro Frage+Session
create unique index if not exists votes_unique_question_session
  on public.votes (question_id, session_id);

-- 5) Constraint: choice XOR option_id
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

commit;

