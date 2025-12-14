## Supabase RLS (Future-Vote)

Diese App nutzt Supabase als Datenbank, aber nicht Supabase-Auth (sondern eigene Tabellen `users`/`user_sessions`).
Damit der `NEXT_PUBLIC_SUPABASE_ANON_KEY` bei einem oeffentlichen Test nicht zu ungeschuetzten DB-Zugriffen fuehrt,
sollte RLS (Row Level Security) aktiv sein.

### Vorgehen
- In Supabase: `SQL Editor` oeffnen
- Inhalt aus `supabase/link_only_polls.sql` ausfuehren (einmalig, falls du Private/Link-only Umfragen nutzt)
- Inhalt aus `supabase/draft_reviews.sql` ausfuehren (einmalig)
- Inhalt aus `supabase/password_resets.sql` ausfuehren (einmalig)
- Inhalt aus `supabase/question_metrics_daily.sql` ausfuehren (einmalig, fuer Trend Etappe 2 Snapshots)
- Inhalt aus `supabase/rls_policies.sql` ausfuehren (idempotent)
- In Vercel/Prod und lokal sicherstellen:
  - `SUPABASE_SERVICE_ROLE_KEY` ist als **Server-Secret** gesetzt (niemals `NEXT_PUBLIC_...`)

Hinweis: Der Service-Role-Key umgeht RLS; deshalb muessen alle sensitiven DB-Operationen serverseitig passieren.

### Trend Etappe 2 (Snapshots / Cron)
1) In Supabase SQL Editor `supabase/question_metrics_daily.sql` ausfuehren.
2) In Vercel einen Cron Job anlegen (Project → Settings → Cron Jobs):
   - Path: `/api/cron/question-metrics?daysBack=120`
   - Schedule: taeglich (UTC), z.B. `5 0 * * *`.
3) Optional (nur lokal/manuell): `FV_CRON_SECRET` setzen und dann
   `/api/cron/question-metrics?daysBack=120&secret=...` aufrufen.
