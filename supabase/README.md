## Supabase RLS (Future-Vote)

Diese App nutzt Supabase als Datenbank, aber nicht Supabase-Auth (sondern eigene Tabellen `users`/`user_sessions`).
Damit der `NEXT_PUBLIC_SUPABASE_ANON_KEY` bei einem oeffentlichen Test nicht zu ungeschuetzten DB-Zugriffen fuehrt,
sollte RLS (Row Level Security) aktiv sein.

### Vorgehen
- In Supabase: `SQL Editor` oeffnen
- Inhalt aus `supabase/draft_reviews.sql` ausfuehren (einmalig)`n- Inhalt aus `supabase/rls_policies.sql` ausfuehren (idempotent)
- In Vercel/Prod und lokal sicherstellen:
  - `SUPABASE_SERVICE_ROLE_KEY` ist als **Server-Secret** gesetzt (niemals `NEXT_PUBLIC_...`)

Hinweis: Der Service-Role-Key umgeht RLS; deshalb muessen alle sensitiven DB-Operationen serverseitig passieren.
