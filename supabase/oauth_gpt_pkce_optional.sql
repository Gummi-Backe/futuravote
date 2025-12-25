-- Future-Vote: OAuth fuer Custom GPT (PKCE optional)
--
-- Hintergrund:
-- ChatGPT ruft /authorize teils ohne code_challenge auf (kein PKCE).
-- In dem Fall nutzen wir den Client-Secret im /token Schritt (Confidential Client).
--
-- Ausfuehren:
-- Supabase Dashboard -> SQL Editor -> Run

begin;

alter table public.oauth_authorization_codes
  alter column code_challenge drop not null;

alter table public.oauth_authorization_codes
  alter column code_challenge_method drop not null;

commit;

