-- Future-Vote: OAuth fuer Custom GPT (Account-Linking, server-only)
--
-- Ziel:
-- - OAuth Authorization Codes + Tokens fuer Account-Linking (z.B. ChatGPT Actions OAuth)
-- - Tokens sind opaque (nur Hashes in DB), schnell widerrufbar, server/service-role only
--
-- Ausfuehren:
-- - Supabase Dashboard -> SQL Editor -> Run
--
-- Hinweis:
-- - RLS ist aktiv, aber es gibt bewusst keine Public Policies (server-only).

begin;

create table if not exists public.oauth_authorization_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  client_id text not null,
  user_id text not null references public.users(id) on delete cascade,
  redirect_uri text not null,
  scope text not null default '',
  -- PKCE ist optional (ChatGPT sendet teils kein code_challenge). Wenn vorhanden, muss S256 verwendet werden.
  code_challenge text,
  code_challenge_method text default 'S256' check (code_challenge_method in ('S256')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists oauth_authorization_codes_client_user_idx
  on public.oauth_authorization_codes (client_id, user_id, created_at desc);

create index if not exists oauth_authorization_codes_expires_idx
  on public.oauth_authorization_codes (expires_at);

create table if not exists public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  user_id text not null references public.users(id) on delete cascade,
  scope text not null default '',
  access_token_hash text not null unique,
  refresh_token_hash text not null unique,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists oauth_tokens_user_idx
  on public.oauth_tokens (user_id, created_at desc);

create index if not exists oauth_tokens_refresh_idx
  on public.oauth_tokens (refresh_token_hash);

create index if not exists oauth_tokens_access_expires_idx
  on public.oauth_tokens (access_expires_at);

alter table public.oauth_authorization_codes enable row level security;
alter table public.oauth_tokens enable row level security;

commit;
