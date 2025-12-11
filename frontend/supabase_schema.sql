-- Supabase / Postgres Schema fuer Future-Vote
-- Diese Definition orientiert sich 1:1 am aktuellen SQLite-Schema
-- aus src/app/data/db.ts. Du kannst sie im Supabase-SQL-Editor ausfuehren.

-- Fragen, die bereits in der oeffentlichen Abstimmung sind
create table if not exists public.questions (
  id             text primary key,
  title          text not null,
  summary        text not null,
  description    text,
  region         text,
  image_url      text,
  image_credit   text,
  category       text not null,
  category_icon  text not null,
  category_color text not null,
  closes_at      date not null,
  yes_votes      integer not null default 0,
  no_votes       integer not null default 0,
  views          integer not null default 0,
  status         text,
  ranking_score  double precision not null default 0,
  created_at     timestamptz not null default now()
);

-- Einzelne Votes pro Session / Nutzer
create table if not exists public.votes (
  question_id text not null references public.questions(id) on delete cascade,
  session_id  text not null,
  choice      text not null,
  created_at  timestamptz not null default now(),
  primary key (question_id, session_id)
);

-- Drafts im Review-Bereich
create table if not exists public.drafts (
  id              text primary key,
  title           text not null,
  description     text,
  region          text,
  image_url       text,
  image_credit    text,
  category        text not null,
  votes_for       integer not null default 0,
  votes_against   integer not null default 0,
  time_left_hours integer not null default 72,
  target_closes_at date,
  status          text not null default 'open',
  created_at      timestamptz not null default now()
);

-- Registrierte Nutzer
create table if not exists public.users (
  id            text primary key,
  email         text not null unique,
  password_hash text not null,
  display_name  text not null,
  role          text not null default 'user',
  created_at    timestamptz not null default now()
);

-- Falls die Spalte fuer die Standard-Region noch fehlt, nachtraeglich anlegen
alter table if exists public.users
  add column if not exists default_region text;

-- Login-Sessions fuer Nutzer
create table if not exists public.user_sessions (
  id         text primary key,
  user_id    text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
