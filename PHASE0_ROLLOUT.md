# FutureVote Phase-0-Rollout

Stand: 09.08.2026

Diese Reihenfolge ist verbindlich. Der neue App-Code erwartet die neuen Datenbankfunktionen und darf deshalb nicht zuerst produktiv gehen.

## 1. Vorbedingungen

- [x] Wiederherstellung kontrolliert. Der Free-Tarif hat keine geplanten Backups; die Migration hat deshalb vor allen Aenderungen private, RLS-geschuetzte Snapshots in `migration_backups` erstellt.
- [x] Richtiger Supabase-Produktionsbereich `future-vote` (`tmsccdcbrihcmmnjptye`) eindeutig ausgewaehlt.
- [x] Lokaler Check mit `npm run check` erfolgreich.
- [x] `npm audit --omit=dev` meldet keine bekannte Produktionsschwachstelle.
- [x] Keine fremden, ungesicherten Arbeitskopie-Aenderungen im geplanten Commit.

## 2. Datenbank zuerst

- [x] `supabase/phase0_security_hardening.sql` vollstaendig im Supabase SQL Editor ausfuehren.
- [x] Der SQL-Editor meldet Erfolg; bei einem Fehler nichts am App-Code deployen.
- [x] Kontrollieren, dass die vier Snapshots in `migration_backups` vorhanden sind und ihre Zeilenzahlen 617 Stimmen, 76 Fragen, 111 Antwortoptionen und 127 Sitzungen entsprechen.
- [x] Kontrollieren, dass `drafts.decision_source` und `user_sessions.expires_at` vorhanden sind.
- [x] Kontrollieren, dass `consume_rate_limit`, `cast_question_vote`, `cast_draft_review` und `increment_question_views` vorhanden sind.
- [x] Kontrollieren, dass keine unerwartete Zahl bestehender Stimmen entfernt wurde. Das Script entfernt nur doppelte Account-Stimmen pro Frage und baut die Zaehler danach neu auf.

Vor dem Lauf am 09.08.2026 wurden 17 doppelte Account-Stimmen ermittelt. Erwartet sind nach der Bereinigung deshalb 600 statt 617 Rohstimmen, sofern waehrend des Laufs keine neue Stimme hinzukommt.

Die Migration laeuft in einer Transaktion. Scheitert ein Schritt, wird der gesamte Lauf zurueckgerollt. Die hinzugefuegten Spalten, Indizes und Funktionen sind mit dem bisherigen App-Code kompatibel und koennen bei einem App-Rollback bestehen bleiben.

## 3. App deployen

- [ ] Geprueften Commit nach GitHub pushen.
- [ ] Erfolgreichen GitHub-CI-Lauf kontrollieren.
- [ ] Vercel-Deployment fuer die Projektwurzel `frontend` kontrollieren.
- [ ] In Vercel pruefen, dass alle fuenf Cron-Jobs aus `frontend/vercel.json` erkannt wurden.

## 4. Produktionspruefung

- [ ] Startseite und mindestens eine Frageseite auf Mobil und Desktop laden.
- [ ] Login, Logout und serverseitiger Sitzungsablauf ohne Fehlermeldung pruefen.
- [ ] Eine Teststimme speichern; ein zweiter Versuch desselben Kontos darf keine zweite Stimme erzeugen.
- [ ] Einen Testvorschlag mit dem FutureVote-GPT inklusive dauerhaftem 512-x-512-JPEG erstellen.
- [ ] Ersteller darf den eigenen Vorschlag nicht bewerten.
- [ ] Ein anderes bestaetigtes Konto darf genau ein Review speichern.
- [ ] Community- und Adminentscheidung werden unterschiedlich bezeichnet.
- [ ] Bild-Upload ohne Anmeldung wird abgewiesen; angemeldeter bestaetigter Nutzer kann ein gueltiges Bild hochladen.
- [ ] Meldungen priorisieren die Moderation, blenden Inhalte aber nicht automatisch aus.
- [ ] Admin-Monitoring zeigt alte oder fehlgeschlagene Cron-Läufe gelb beziehungsweise rot.
- [ ] Security-Header auf der Live-Seite kontrollieren.
- [ ] GPT-Bilderzeugung und Einreichung einmal Ende-zu-Ende testen.

## 5. Beobachtung und Rueckfallplan

- [ ] Vercel- und Supabase-Fehlerprotokolle in den ersten 24 Stunden kontrollieren.
- [ ] Rate-Limit-Fehler, Loginfehler, Vote-Fehler und Review-Fehler beobachten.
- [ ] Bei einem App-Fehler auf das vorherige Vercel-Deployment zurueckrollen; die additive Datenbankmigration bestehen lassen.
- [ ] Cron-Läufe nach 26 Stunden kontrollieren und nach 48 Stunden als kritisch behandeln.
- [ ] Erst nach erfolgreicher Produktionspruefung zugehoerige Punkte in der Erfolgsliste mit `[x]` markieren.

## Noch nicht abgedeckt

- Eine getrennte Test-Supabase fuer echte Datenbank-Integrationstests fehlt noch. Die lokalen Tests pruefen derzeit Origin-Schutz, Fristen und Review-Regeln, nicht den produktiven Postgres-Lauf.
- Accountalter, Aktivitaet und ein Vertrauensscore sind noch nicht Teil der Review-Berechtigung. Bestaetigte Konten sind jetzt Pflicht. Weitere Huerden sollten erst mit realen Missbrauchsdaten eingefuehrt werden, damit neue ehrliche Nutzer nicht grundlos ausgeschlossen werden.
- Die 400 verbleibenden ESLint-Warnungen sind technische Schuld, vor allem alte `any`-Typen. Es gibt keine blockierenden Lintfehler.
