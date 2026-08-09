## FutureVote Frontend

Next.js-App fuer oeffentliche Umfragen, Prognosen, Community-Reviews, private Link-Umfragen und Administration.

### Lokales Setup

1. `npm install`
2. `.env.local` mit den benoetigten Entwicklungswerten anlegen. Die Datei bleibt durch `.gitignore` privat.
3. `npm run dev` starten und `http://localhost:3000` oeffnen.
4. Vor einem Rollout `npm run check` ausfuehren.

Ohne `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY`
kann die Seitenschale lokal starten, datenabhaengige APIs antworten aber nicht erfolgreich.

### Wichtige Server-Secrets

- `SUPABASE_SERVICE_ROLE_KEY`: serverseitiger Datenbank- und Storage-Zugriff.
- `OPENAI_API_KEY`: Bild- und Admin-KI-Funktionen.
- `FV_CRON_SECRET`: Schutz der Cron-Routen.
- `FV_RATE_LIMIT_SECRET`: eigener Pepper fuer persistente Rate-Limit-Schluessel. Falls nicht gesetzt, wird ein vorhandenes Server-Secret verwendet.
- `FV_REFERRAL_SECRET`: Signatur der Empfehlungslinks.
- `NEXT_PUBLIC_BASE_URL`: kanonische Produktionsadresse.

Secrets niemals in Git, Screenshots, Browserfelder ohne klaren Zweck oder oeffentliche Logs schreiben.

### Supabase und Sicherheit

- Die App nutzt eigene Tabellen fuer Nutzer und Sessions, nicht Supabase Auth.
- Sensible Tabellen sind serverseitig ueber den Service-Role-Key erreichbar und durch RLS vor oeffentlichem Lesen geschuetzt.
- Vor dem Phase-0-App-Deploy muss `../supabase/phase0_security_hardening.sql` ausgefuehrt werden.
- Die genaue Reihenfolge und Pruefung steht in `../PHASE0_ROLLOUT.md`.

### Vercel

Die konfigurierte Vercel-Projektwurzel ist `frontend`. Deshalb liegt `vercel.json` in diesem Ordner. Nur so werden Build-Konfiguration und die fuenf Cron-Jobs vom Projekt erkannt.

### Pruefkommandos

- `npm run lint`: ESLint, Warnungen bleiben als technische Schuld sichtbar.
- `npm run typecheck`: TypeScript ohne Ausgabe.
- `npm test`: schnelle Regel- und Sicherheitspruefungen.
- `npm run check:gpt-contract`: Vertrag des FutureVote-GPT.
- `npm run build`: Produktions-Build.
- `npm run check`: alle obigen Pruefungen in CI-Reihenfolge.
