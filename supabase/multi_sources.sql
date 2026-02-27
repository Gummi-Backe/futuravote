-- Future-Vote: Mehrere Quellen pro Frage/Draft/Update
--
-- Ziel:
-- - Bei Prognosen mehrere Aufloesungsquellen speichern (`resolution_sources`).
-- - Bei Frage-Updates mehrere Quellen speichern (`source_urls`).
-- - Bestehende Einzelquelle (`resolution_source` / `source_url`) bleibt kompatibel.
--
-- Ausfuehren:
-- - Supabase Dashboard -> SQL Editor -> Run

begin;

alter table if exists public.questions
  add column if not exists resolution_sources text[] not null default '{}'::text[];

alter table if exists public.drafts
  add column if not exists resolution_sources text[] not null default '{}'::text[];

alter table if exists public.question_updates
  add column if not exists source_urls text[] not null default '{}'::text[];

-- Backfill: falls nur Einzelquelle vorhanden ist, in Array uebernehmen.
update public.questions
set resolution_sources = case
  when coalesce(array_length(resolution_sources, 1), 0) > 0 then resolution_sources
  when btrim(coalesce(resolution_source, '')) <> '' then array[btrim(resolution_source)]::text[]
  else '{}'::text[]
end;

update public.drafts
set resolution_sources = case
  when coalesce(array_length(resolution_sources, 1), 0) > 0 then resolution_sources
  when btrim(coalesce(resolution_source, '')) <> '' then array[btrim(resolution_source)]::text[]
  else '{}'::text[]
end;

update public.question_updates
set source_urls = case
  when coalesce(array_length(source_urls, 1), 0) > 0 then source_urls
  when btrim(coalesce(source_url, '')) <> '' then array[btrim(source_url)]::text[]
  else '{}'::text[]
end;

commit;

