-- Future-Vote: Private/Link-only Umfragen (Schema-Erweiterung)
--
-- Ziel:
-- - Drafts und Questions koennen "public" oder "link_only" sein.
-- - Bei "link_only" existiert ein nicht erratbarer `share_id` fuer den Share-Link.
--
-- Hinweis:
-- - Danach bitte auch `supabase/rls_policies.sql` ausfuehren (Policies filtern dann auf visibility='public').

begin;

-- Drafts
alter table if exists public.drafts
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'link_only'));

alter table if exists public.drafts
  add column if not exists share_id text;

alter table if exists public.drafts
  drop constraint if exists drafts_share_id_required;

alter table if exists public.drafts
  add constraint drafts_share_id_required
  check (
    (visibility = 'public' and share_id is null)
    or
    (visibility = 'link_only' and share_id is not null)
  );

create unique index if not exists drafts_share_id_unique
  on public.drafts (share_id)
  where share_id is not null;

-- Questions
alter table if exists public.questions
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'link_only'));

alter table if exists public.questions
  add column if not exists share_id text;

-- Optional: Ersteller fuer Owner-only UI (ohne FK, damit keine Typ-Konflikte entstehen)
alter table if exists public.questions
  add column if not exists creator_id text;

create index if not exists questions_creator_id_idx
  on public.questions (creator_id);

alter table if exists public.questions
  drop constraint if exists questions_share_id_required;

alter table if exists public.questions
  add constraint questions_share_id_required
  check (
    (visibility = 'public' and share_id is null)
    or
    (visibility = 'link_only' and share_id is not null)
  );

create unique index if not exists questions_share_id_unique
  on public.questions (share_id)
  where share_id is not null;

commit;
