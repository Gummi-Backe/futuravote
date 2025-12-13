-- Future-Vote: Password reset tokens
--
-- Goal:
-- - Allow users to reset their password via email link.
-- - Tokens are single-use and expire.
-- - Table is server-only (service-role key); no public policies.

begin;

create table if not exists public.password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now()
);

create unique index if not exists password_resets_token_hash_unique
  on public.password_resets (token_hash);

create index if not exists password_resets_user_id_idx
  on public.password_resets (user_id);

alter table public.password_resets enable row level security;

commit;