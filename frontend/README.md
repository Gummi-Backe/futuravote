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
- `CRON_SECRET`: Bearer-Geheimnis fuer Vercel-Cron und die Admin-Cron-Aufrufe. In Vercel fuer Production setzen und neu deployen. Vercel sendet es automatisch als Authorization-Header.
- `FV_CRON_SECRET`: bisheriger Fallback fuer manuelle Bearer-Aufrufe; fuer geplante Vercel-Aufrufe denselben Wert als `CRON_SECRET` setzen. URL-Parameter und `x-vercel-cron` gelten nicht als Anmeldung.
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

### FutureVote Text-KI

Alle vier Textfunktionen (Fragenvorschlaege, Frage-Updates, manuelle und automatische
Prognose-Aufloesungsvorschlaege) verwenden `gpt-6.1-sol` mit `reasoning.effort=xhigh`
ueber die OpenAI Responses API. Web-Recherche bleibt verpflichtend. Der vorhandene
serverseitige `OPENAI_API_KEY` benoetigt Zugriff auf dieses Modell und Web Search.
`PERPLEXITY_API_KEY` und `PERPLEXITY_MODEL` werden dafuer nicht mehr verwendet.
Die Web-Suche akzeptiert keinen erzwungenen JSON-Modus. Der Prompt verlangt ein
reines JSON-Objekt; ungueltige, abgeschnittene oder nicht recherchierte Antworten
werden vor der Uebernahme verworfen. Kein automatischer Modellwechsel oder Retry.

Sehr hohe Denktiefe erhoeht moeglicherweise Kosten und Laufzeit. Pro Aufruf sind
Web-Tool-Aufrufe und die gemeinsame Ausgabe fuer Denken und JSON begrenzt.
KI-Anfragen laufen hoechstens 240 Sekunden; die betroffenen Vercel-Routen erlauben
300 Sekunden. Sammelanfragen liefern ggf. nur die bereits fertigen Vorschlaege.
Der Aufloesungs-Cron meldet noch nicht bearbeitete Fragen als `deferred`; sie bleiben
fuer einen spaeteren Lauf offen. Fehler werden nicht automatisch teuer wiederholt.
Ein KI-Vorschlag loest eine Prognose weiterhin nicht selbststaendig auf.

Diese Einstellung betrifft nicht die Bilderzeugung, Codex oder andere Projekte.
Der Custom GPT kann nur die im ChatGPT-Editor angebotenen Modelle empfehlen.
Das FutureVote-Plugin verwendet weiterhin das Modell des jeweiligen ChatGPT-Chats;
sein Manifest setzt weder ein Modell noch eine Denktiefe fest.

### Pruefkommandos

- `npm run lint`: ESLint, Warnungen bleiben als technische Schuld sichtbar.
- `npm run typecheck`: TypeScript ohne Ausgabe.
- `npm test`: schnelle Regel- und Sicherheitspruefungen.
- `npm run check:gpt-contract`: Vertrag des FutureVote-GPT.
- `npm run build`: Produktions-Build.
- `npm run check`: alle obigen Pruefungen in CI-Reihenfolge.
