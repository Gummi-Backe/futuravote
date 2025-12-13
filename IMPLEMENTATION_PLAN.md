# Vorgehensplan fuer die Prognose-Plattform

## Phase 0: Grundlagen
- Ziel klaeren: erste Version mit Ja/Nein-Kacheln, Draft-Review und einfachem Ranking.
- Tech-Stack festlegen (Empfehlung: Frontend React/Next.js, Backend NestJS oder ASP.NET Core, DB Postgres, ORM Prisma/TypeORM/EF).
- UX-Richtlinien definieren: Kachel-Layout, Farben pro Kategorie, responsives Grid.
- MVP-Scope festhalten: MUSS (Auth, Kategorien, Fragen-Feed, Ja/Nein-Vote, Draft-Einreichung/-Review mit Auto-Entscheidung, Admin-Basis); NICHT (Profil-Stats, Gamification, Personalisierung, B2B-Exports).
- Login-Regel festlegen: Ja/Nein-Voting und Draft-Reviews sind **ohne Login** moeglich (jeder darf abstimmen und Reviews abgeben); nur das Einreichen neuer Fragen/Drafts erfordert einen registrierten Account. Kein Kommentar-System im MVP.

## Phase 1: Projekt-Setup
- Repos anlegen: frontend, backend; CI mit Lint/Test/Build.
- Basis-Tooling: TypeScript, Prettier/ESLint, Commit-Hooks (lint-staged), Env-Handling.
- Design-Tokens: Farben, Typografie, Spacings, Komponenten-Grundlagen (Buttons, Badge, Card, Grid).

## Phase 2: Auth & Rollen
- User-Model anlegen; Registrierung/Login; Sessions oder JWT; Passwort-Hashing.
- RBAC-Middleware: Gast, User, Moderator, Admin; Guards pro Route.
- Basis-Profileendpunkte: eigenes Profil lesen, einfache Reputation anzeigen.
- [x] Personalisierte Profil-Aktivitaet: Im Profil werden die Zahlen unter "Deine Aktivitaet (bisher)" als klickbare, animierte Buttons umgesetzt. Ein Klick oeffnet eine eigene Aktivitaetsansicht (z. B. "Meine Drafts", "Meine Abstimmungen"), in der die passenden Kacheln in sinnvoller Reihenfolge angezeigt werden (standardmaessig neueste zuerst; zusaetzlich einfache Filter wie "Angenommen/Abgelehnt" bzw. "Ja/Nein"). Basis: Votes werden neben `session_id` auch mit `user_id` verknuepft.
- [x] Interessen-Statistiken pro Nutzer (Grundversion): im Profil werden bereits eine einfache Ja/Nein-Quote sowie Top-Kategorien auf Basis der eigenen Votes angezeigt; spaeter koennen diese Daten zusaetzlich fuer Filter im Feed genutzt werden (z.B. "zeige mir nur Fragen aus meinen Top-Kategorien").

**Auth-Felder & Registrierung (spezifisch fuer Future-Vote)**
- [x] Felddefinition festgelegt:
  - Pflichtfelder: `email`, `password`, `passwordConfirm`, `displayName` (Anzeige-Name/Nickname).
  - Beide Passwortfelder erhalten eine "Passwort anzeigen/verbergen"-Funktion (Augen-Icon).
  - Checkbox "Ich akzeptiere die Nutzungsbedingungen" ist Pflicht, bevor ein Account angelegt werden darf.
  - Link zu einer Seite mit den Nutzungsbedingungen (`/terms`) direkt auf der Registrierungsansicht sichtbar.
- [x] Implementierung der schlanken Registrierung/Anmeldung mit diesen Feldern im Frontend (Formulare, Validierung, Fehlertexte) inkl. einfacher Login-Status-Anzeige und Logout-Button im Header.
- [x] Backend-Endpoints fuer Registrierung/Login inkl. sicherem Passwort-Hashing und Session-Cookies (`/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`).
- [x] Einfache Profilseite (`/profil`) fuer eingeloggte Nutzer: Anzeige von E-Mail, Anzeige-Name, Rolle und Registrierungsdatum; Link ueber den Namen/Avatar im Header und von der Auth-Seite aus erreichbar.
- [ ] Profil-Statistiken ergaenzen: spaeter im Profil einfache Uebersicht anzeigen (z. B. Anzahl vorgeschlagener Fragen, wie viele davon angenommen wurden, Anzahl abgegebener Reviews/Votes und ggf. ein einfacher Vertrauens-Score). Diese Werte werden aus der echten Produktionsdatenbank berechnet, sobald die Plattform ernsthaft genutzt wird.
- [x] E-Mail-Verifizierung ergaenzen: nach Registrierung wird ein Bestaetigungslink verschickt (Tabelle `email_verifications` + Feld `email_verified` in `users` sind angelegt); Draft-Einreichung ist nur mit verifizierter E-Mail moeglich, Login bleibt bewusst auch ohne Bestaetigung erlaubt.
- [ ] Passwort-Reset-Flow (Passwort vergessen) mit E-Mail-Link planen und spaeter umsetzen.

## Phase 3: Datenmodell & API
- DB-Schema fuer Category, Question, Vote, QuestionDraft, QuestionDraftReview, RankingMeta.
- CRUD-Endpunkte: Kategorien (Admin), Questions (listen, detail), Votes (create), Drafts (create/list), DraftReviews (create).
- Validierung/Rate-Limits fuer Einreichen und Bewerten.
- Ranking in MVP zunaechst simpel: Sortierung CreatedAt + VoteCount; CompositeRankingScore und Cron erst ab Phase 6.
- TrustScore einfuehren: User.trustScore (Start 1.0) wird erhoeht bei angenommenen/gut bewerteten Drafts, gesenkt bei abgelehnten; fuer CreatorScore im Ranking genutzt.

## Phase 4: Frontend Kernflows
- Landing/Feed mit Kachel-Grid; Filter/Sort (Top heute, Neu, Trending).
- EventCard-Komponente mit Ja/Nein-Buttons, Deadline, Prozentanzeige nach Vote.
- Frage-Detailseite mit Beschreibung, Stats, Kategorie.
- Fehler- und Lade-Zustaende, leere Listen, Unautorisierte Aktionen.

## Phase 5: Draft-Einreichung & Review
- Seite "Frage vorschlagen" mit Formular, Validierung, Kategorie-Auswahl.
- Review-Board fuer Drafts: Karten mit "Gute/Schlechte Frage" und optionalen Scores.
- Backend-Logik: QualityScore-Berechnung (konfigurierbare Thresholds), Status-Transitions, Moderator-Override.
- Notifications/Toasts fuer Ergebnisse; History/Status am Draft anzeigen.
- Drafts werden nach der Entscheidung nicht automatisch geloescht, sondern mit Status (`open`/`accepted`/`rejected`) als Historie behalten, damit spaeter Statistiken und Trust-Scores moeglich sind (z. B. wie viele Vorschlaege eines Nutzers akzeptiert wurden). Fuer rechtlich problematische Inhalte existiert zusaetzlich ein expliziter Admin-Hard-Delete, der Draft und Bild physisch entfernt.

## Phase 6: Ranking & Scores

Ziel: Feed-Ranking wie bei Instagram – schnelles, hohes Engagement wird gepusht, neue Fragen haben Start-Boost, alte/schwache Fragen fallen ab.

### 6.1 Zusaetzliche Felder & Meta-Daten
- Frage/RankingMeta ergaenzen um: `views` (Impressions), `votes` (Ja+Nein Aggregation), `ranking_score` (float), optional `last_ranking_update_at`.
- `creator_trust_score` aus User (TrustScore-Logik aus Phase 3).

### 6.2 Signale
- views: wie oft die Frage angezeigt wurde.
- votes: wie oft abgestimmt wurde (Ja + Nein).
- vote_rate: votes / max(views, 1).
- age_hours: Stunden seit CreatedAt.
- creator_trust_score: Vertrauen des Erstellers (Start 1.0, dynamisch).

### 6.3 Berechnung
- engagementScore = log(1 + votes)
- vote_rate = votes / max(views, 1)
- qualityScore = vote_rate
- freshnessScore = 1 / (1 + age_hours / 24)
- creatorScore = creator_trust_score
- base = 0.5 * engagementScore + 0.5 * qualityScore
- rankingScore = base * freshnessScore * creatorScore
- Bonus: if age_hours < 12 => rankingScore += NEW_QUESTION_BOOST (z. B. 1.0)
- Bisherige Minimalformel `score = (yesVotes + noVotes) * freshness * creatorTrustScore` bleibt als Fallback erhalten, wird im MVP durch obige Formel ersetzt.

### 6.4 Technische Umsetzung
- Background-Job/Cron (z. B. alle 5 Minuten): aktive Fragen laden, age_hours berechnen, views/votes/trust lesen, Scores berechnen, `ranking_score` schreiben.
- Pseudocode:
  - engagement = log(1 + votes)
  - vote_rate = votes / max(views, 1)
  - quality = vote_rate
  - freshness = 1 / (1 + age_hours / 24)
  - base = 0.5 * engagement + 0.5 * quality
  - score = base * freshness * trust
  - if age_hours < 12: score += NEW_QUESTION_BOOST
- Logging der Signale:
  - Beim Rendern des Feeds: views++ oder Event `question_viewed`.
  - Beim Ja/Nein-Vote: votes++ oder Aggregation aus Vote-Tabelle.

### 6.5 API-Nutzung
- Feed-Endpunkte sortieren nach `ranking_score`:
  - `/questions?sort=top` -> ORDER BY ranking_score DESC
  - `/questions?sort=top_today` -> WHERE created_at > now() - 24h ORDER BY ranking_score DESC
  - `/questions?sort=new` -> ORDER BY created_at DESC
- Gewichte/NEW_QUESTION_BOOST/Zeitfenster zentral konfigurierbar, fuer spaetere A/B-Tests.

## Phase 7: Admin & Moderation
- Admin-Dashboard: Kategorien, Nutzer, Fragen, Drafts, Meldungen.
- Aktionen: Fragen sperren/reaktivieren, Draft-Status setzen, Systemparameter/Thresholds anpassen.
- Audit-Log fuer Admin-Aktionen.
> Hinweis: Einfache Admin-/Debug-Ansichten werden bewusst erst nach Umsetzung von Phase 2 (Auth & Rollen) eingeplant, damit Zugriffe sinnvoll eingeschraenkt werden koennen.

## Phase 8: QA, Sicherheit, Launch
- Tests: Unit (Services), Integration (API), E2E (kritische Flows Voting/Draft/Review).
- Security: Input-Validation, Auth-Guards, Rate-Limits, CORS, CSRF (bei Cookies), sichere Cookies.
- Performance: Indexe fuer haeufige Queries (Votes/Questions), Paginated Feeds, lazy Loading.
- Deployment: Staging + Production; CI/CD Pipelines; Env-Variablen fuer Keys und DB.
- Observability: Error-Tracking (z. B. Sentry o.ae.), strukturiertes Logging (ohne PII), Basis-Dashboards/Alerts.

## Phase 9: Erweiterungen (Roadmap)
- Gamification: Badges/Levels, Leaderboards, Reputation-Tuning.
- Erweiterte Antworttypen: Prozent-Schaetzung, Multiple Choice, Skalen.
- Personalisierung: Empfohlene Fragen basierend auf Historie und Kategorien.
- B2B-Analytics: Exporte, Dashboards, Zeitverlauf/Korrelationen.

## Definition of Done fuer erste Version (MVP)
- Nutzer koennen sich registrieren/anmelden, Kategorien sehen, Fragen im Feed per Ja/Nein voten, Details einsehen.
- Nutzer koennen neue Fragen vorschlagen; Community kann Drafts bewerten; automatische QualityScore-Entscheidung laeuft.
- Admin kann Kategorien pflegen und bei Drafts/Fragen eingreifen.
- Feed mindestens per einfacher Sortierung (CreatedAt + VoteCount) lauffaehig; CompositeRankingScore optional wenn Phase 6 erreicht.
- Grundlegende Tests und CI gruen.

### Phase 4 Design-Feintuning (UI/UX Vorschlaege)
- Kacheln mit mehr Hierarchie: mehr Abstand/Shadow, Titel groesser, Kategorie-Badge farbig + Icon, Countdown-Badge, Trending/Top/Neu klar markieren.
- Vote-Buttons app-haft: groesser, Ja=Gruen/Nein=Rot, animiertes Feedback (Bounce), sanfter Uebergang zu Prozentanzeige.
- Header/Nav: groesseres Logo/Brand, Tabs Home/Top/Trending/Kategorien/Frage stellen/Review, Login/Register prominent, Profil-Avatar.
- Kategorien-Leiste: Icons pro Kategorie, horizontale Scrollleiste; Filterchips fuer Beliebt/Neu/Trending/Unbeantwortet.
- Detailseite: Mehr Stats (Votes, Historie, Feed-Anstieg), bessere Typografie/Weissraum.
- Mobile: groessere Touch-Ziele, horizontale Kategorie-Scroll, spaeter optional Swipe-Modus.
- Micro-Interactions: Hover-Lift Karten, Button-Pop, animierte Balken, Countdown-Blinken <24h.

### UI/UX Umsetzung (Stand)
- [x] Kachel-Hierarchie, Shadows, Kategorie-Icons/Badges, Countdown-Badge
- [x] Vote-Buttons groesser/farbig mit Hover/Active-Feedback
- [x] Tabs/Chips fuer Top/Trending/Neu/Unbeantwortet
- [x] Kategorien-Leiste mit Icons (horizontal scroll)
- [x] Micro-Interactions (Hover-Lift, animierte Balken, Hot-Puls)
- [x] Detailseite-Stats/Typografie (fertig im MVP-UI)
- [x] Mobile: groessere Touch-Ziele, horizontale Kategorie-Scroll (Swipe-Modus spaeter optional)
### Voting-Logik/UX (Stand)
- [x] Ja/Nein-Voting ohne Login (Session-Cookie)
- [x] Vote-Lock pro Session (eine Stimme pro Frage, kein Wechsel)
- [x] Abgestimmte Kachel klar markiert (Rahmen/Badge), Detailseite zeigt Vote-Badge
- [x] Votes persistent gespeichert (Datei-basiert, sessiongebunden)
- [x] Kategorien klickbar filterbar im Feed
- [x] Kategorien-Chips ohne Farbpunkte (nur Icon + Text)
- [x] Hover-Highlight fuer Feed-Tabs (Alle/Top/Trending/Neu/Unbeantwortet)
- [x] Leichtes Anheben (Hover) fuer Tabs und Kategorie-Chips
- [x] Detailseite bezieht Daten ueber API (mit Loading/Error)
- [x] Vote-Feedback im Feed (Info bei Erfolg, Fehlertext bei Fehlschlag)
- [x] Einfaches Vote-Rate-Limit pro Session (429 + Hinweis)
- [x] Persistenz auf SQLite (better-sqlite3) umgesetzt
- [x] Next.js 16: params/cookies nun als Promise awaited (keine params.id/cookies().get Fehler)
- [x] Feed-Sortierung nach RankingScore (Alle/Top/Trending/Neu/Unbeantwortet) im Feed umgesetzt (Client-Sortierung basierend auf Views/Votes/Alter)
- [x] Branding: Projektname in Meta-Daten auf "Future-Vote" aktualisiert; SQLite-Migration fuer createdAt/rankingScore verhaeltnissmaessig stabil (Vercel-Build laeuft durch)
### Draft-Einreichung (Stand)
- [x] Drafts liegen in SQLite (Tabelle `drafts`, Seed aus Mock-Daten)
- [x] API-Endpunkt `/api/drafts` fuer neue Drafts (Titel, optionale Beschreibung, Kategorie, Review-Zeitraum)
- [x] Seite `/drafts/new` ("Frage vorschlagen") mit Formular (inkl. optionaler Langbeschreibung, sichtbar in Review-Karten und spaeter in der Detailansicht); verlinkt aus dem Hero-Button "Frage stellen"
- [x] Draft-Review-Interaktion (Gute Frage/Ablehnen) an Backend angebunden; Votes werden in SQLite gespeichert
- [x] Einfache Auto-Promotion: ab Mindestanzahl/Kanten (>=5 Reviews, deutlich mehr "Gute Frage" als "Ablehnen") wird Draft als neue Frage in `questions` uebernommen
- [x] Draft-Status/Filter im Review-Bereich (Offen/Angenommen/Abgelehnt) inkl. visueller Badges in den Karten
 - [x] Formular "Frage vorschlagen" mit zusaetzlicher Validierung (Mindestlaenge Titel/Beschreibung, minimale Laenge fuer eigene Kategorien) und Erfolgshinweis im Feed nach erfolgreichem Einreichen (via Toast)
 - [x] Einfache Admin-Light-Unterstuetzung: Admin-Rolle pro User in SQLite, erster (oder via FV_ADMIN_EMAIL definierter) Account wird Admin; Admins sehen ein Badge im Header und koennen Drafts im Review-Bereich direkt annehmen/ablehnen (Server-seitig abgesichert ueber /api/admin/drafts)
 - [x] Admin-Hard-Delete & Stoppen: Admins koennen Drafts im Review-Bereich endgueltig loeschen (inkl. zugehoeriger Vorschaubilder auf dem Server) sowie fertige Fragen ueber eine eigene Admin-Sektion der Detailseite stoppen (Status "archived", verschwindet aus dem Feed) oder in Ausnahmefaellen komplett entfernen (Frage + Bild werden aus der SQLite-DB und dem Images-Verzeichnis geloescht); technisch umgesetzt ueber erweiterte Draft-Route (`/api/admin/drafts` mit Action `delete`) und neue Questions-Route (`/api/admin/questions` mit Actions `archive`/`delete`), jeweils nur fuer Admin-User zugaenglich.
 - [ ] Optionales Layout-Upgrade fuer `/drafts/new`: auf groesseren Screens (ab ca. Tablet-Breite) Kachel-Vorschau als sticky Sidebar rechts neben dem Formular anzeigen, waehrend auf kleineren Screens die bisherige Darstellung (Vorschau unter dem Formular) beibehalten wird. Nur umsetzen, wenn genug Zeit fuer sauberes Responsive-Testing vorhanden ist, da Tastatur/Viewport auf Mobilgeraeten sensibel reagieren.
### UI/UX Umsetzung (Stand)
- [x] Kacheln mit mehr Hierarchie: Abstand/Shadow, Titel groesser, Kategorie-Badge + Icon, Countdown-Badge, Trending/Top/Neu markiert.
- [x] Vote-Buttons app-haft: groesser, Ja/Nein farbig, animiertes Feedback.
- [x] Header/Nav: Tabs Home/Top/Trending/Kategorien/Frage stellen/Review sichtbar.
- [x] Kategorien-Leiste: Icons, horizontale Scrollleiste; Filterchips fuer Beliebt/Neu/Trending/Unbeantwortet.
- [x] Detailseite: Mehr Stats (rel. Votes, Platzhalter Views/Score), Typografie/Weissraum, Trend-Placeholder.
- [x] Mobile: groessere Touch-Ziele, horizontale Kategorie-Scroll (Swipe-Modus spaeter optional).
- [x] Micro-Interactions: Hover-Lift Karten, Button-Pop, animierte Balken, Countdown-Blinken <24h.
- [x] Mobile Swipe-Navigation: Tabs & Kategorien per Wisch gewechselt (Snap-Scroll + Touch-Handler)
- [x] Animations-Prinzip: bei neuen Views standardmaessig Seiten-Transitionen, Overlays mit Fade/Scale und Listen/Toasts mit kurzen Einblend-Animationen verwenden
- [ ] Erweiterte Animationen (Zahlen-Animationen, Status-Wechsel im Review-Bereich, weiche Uebergaenge im Frage-vorschlagen-Flow) fuer spaetere Feintuning-Phase vorm Launch
- [x] Optionaler Bild-Upload fuer Fragen/Drafts:
  - Einfache Variante umgesetzt: Bild-URL oder Datei-Upload (vom Geraet), serverseitiges Resize auf kleines Kachelformat (max. ca. 250x150, Seitenverhaeltnis bleibt erhalten) und Nutzung der verkleinerten Version als Vorschaubild in Draft-Review, Fragen-Feed und Detailansicht; Bilder wandern beim Auto-Promoten vom Draft in die Frage mit.
  - Offene Ausbaustufe: bessere UX fuer Upload-Fehler, harte Limits fuer Dateigroesse/Seitenverhaeltnis und optionales Cropping; Original-Upload nach erfolgreicher Verarbeitung konsequent entfernen.
### Feed-Verbesserungen (Stand)
- [x] Visuelle Hervorhebung von Fragen mit Status "Endet bald" (Badge + Rahmen)
 - [x] Neuer Tab "Endet bald" im Feed, der nur Fragen mit Restlaufzeit ≤ 14 Tage anzeigt und nach naechstem Enddatum sortiert ist
 - [x] Tab "Neu & wenig bewertet": zeigt nur Fragen, die juenger als 14 Tage sind und insgesamt nur wenige Stimmen haben (aktuell < 10 Ja+Nein-Stimmen); Sortierung nach `createdAt` absteigend
 - [x] Tab "Noch nicht abgestimmt" (frueher "Unbeantwortet"): zeigt Fragen, bei denen der aktuelle Nutzer in dieser Session noch keine Stimme abgegeben hat (unabhaengig davon, wie viele andere schon abgestimmt haben)
 - [ ] Schwelle fuer "wenig Stimmen" dynamisch machen: Statt eines festen Werts (z. B. < 10) spaeter anhand von Statistik aus der Datenbank berechnen (z. B. Median/Perzentile der Stimmenanzahl pro Altersgruppe der Fragen) und daraus eine adaptive Grenze ableiten, ab wann eine Frage als "wenig bewertet" gilt. Diese Logik wird sinnvollerweise mit der spaeteren Postgres‑/Produktionsdatenbank umgesetzt.
 - [x] Einfache Infinite-Scroll-Logik fuer Feed und Review-Bereich: Zunaechst nur ein Teil der Kacheln wird gerendert, weitere werden beim Scrollen automatisch nachgeladen (Client-seitig, API weiterhin ohne Paging)
 - [ ] Echte Pagination fuer Fragen und Drafts:
   - API `/api/questions` um Paging-Parameter erweitern (`pageSize`, `questionsCursor`, `draftsCursor`, `tab`, `category`, `region`).
   - Fragen und Drafts serverseitig sortieren und filtern (inkl. Tabs "Top", "Endet bald", "Neu & wenig bewertet", "Noch nicht abgestimmt") und pro Request nur eine Seite zurueckgeben.
   - Cursor-basiertes Paging (z.B. ueber `created_at` + `id`) bevorzugen, damit das Ranking stabil bleibt.
   - Im Frontend echten Infinite-Scroll bauen: initial erste Seite laden, beim Scrollen mit `nextCursor` weitere Seiten nachladen; bei Tab-/Filterwechsel State leeren und neu ab Seite 1 laden.
   - Ziel: auch bei sehr vielen Fragen/Drafts nur einen kleinen Ausschnitt im Browser halten und trotzdem alle bisherigen Filter-/Sortierregeln beibehalten.

### Private / Link-basierte Umfragen (neu vorgeschlagen)
- [ ] Fragen koennen beim Einreichen als "nur per Link teilbar" markiert werden (zusaetzliches Feld `visibility = "public" | "linkOnly"` im Fragenmodell).
- [ ] Fuer `visibility = "linkOnly"` wird zusaetzlich eine zufaellige `shareId` erzeugt; diese wird in einer eigenen Route (z. B. `/poll/[shareId]`) verwendet, die die Frage laedt, ohne sie im oeffentlichen Feed anzuzeigen.
- [ ] Im Formular "Frage vorschlagen" erhaelt der Ersteller eine gut erklaerte Option "Private Umfrage (nur per Link fuer Mitglieder/Mitarbeiter sichtbar)" inkl. kurzer Erklaerung, dass jeder mit Link teilnehmen kann.
- [ ] Kachel-/Detailansicht bekommt einen kleinen Teilen-Button: auf Desktop Copy-to-Clipboard, auf Mobilgeraeten moeglichst Web Share API; bei `linkOnly`-Fragen erscheint der Button vor allem in der Detailansicht.
- [ ] Review- / Admin-Logik bleibt identisch, Admin kann auch private/link-only-Fragen stoppen oder endgueltig loeschen; spaeter kann optional eine "echte" geschlossene Gruppe (Login-Pflicht + Organisationskonzept) auf Basis dieses Mechanismus aufgebaut werden.

### Regionen / Zielgruppen
- [x] Fragen und Drafts erhalten ein optionales Feld `region` (z. B. "Global", "Deutschland", "Bundesland", "Stadt/Region").
- [x] Im Formular "Frage vorschlagen" kann eine Region gewaehlt werden (Standard: "Alle / Global"); Region wird zusammen mit der Frage gespeichert.
- [x] Im Feed stehen Filter fuer Regionen zur Verfuegung (Chips oberhalb des Feeds), sodass Nutzer sich Fragen fuer eine bestimmte Region anzeigen lassen koennen; der Review-Bereich wird ebenfalls nach Region gefiltert.
- [x] Mit spaeterer Auth-Phase: Nutzer koennen eine Standard-Region im Profil hinterlegen; der Feed priorisiert Fragen aus der eigenen Region, zeigt global relevante Fragen aber weiterhin optional an.
- [ ] Region wird auch im Ranking beruecksichtigt (z. B. getrennte Scores pro Region oder unterschiedliche Tabs wie "Top global" / "Top in meiner Region").

### Persistente Datenbank / Migration von SQLite
- [x] Supabase-Projekt fuer Future-Vote angelegt (Region: EU/Frankfurt), Zugangsdaten sicher im Passwortmanager hinterlegt.
- [x] Basis-Supabase-Client im Frontend angelegt (`src/app/lib/supabaseClient.ts`), der die Umgebungsvariablen `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` nutzt.
- [x] Einmalige Synchronisation von SQLite nach Supabase fuer `questions` und `drafts` implementiert (`scripts/sync-sqlite-to-supabase.cjs`, npm-Skript `npm run sync:sqlite-to-supabase`).
- [x] Eigenen Supabase-Datenpfad fuer Fragen/Votes implementiert (`src/app/data/dbSupabase.ts`) und API-Routen umgestellt: `/api/questions`, `/api/questions/[id]`, `/api/votes`, `/api/health`.
- [x] Draft-/Admin-Operationen (Promote/Archivieren/Loeschen von Fragen) ebenfalls auf Supabase umgestellt, so dass `questions` nicht mehr aus SQLite geschrieben wird.
- [x] User/Auth-Daten (users, user_sessions, email_verifications) auf Supabase verschoben; die alte SQLite-Datei dient nur noch als lokales Backup/Snapshot und wird fuer neue Deployments nicht mehr verwendet.
- [x] Supabase RLS & Policies einrichten: Row Level Security fuer `questions`, `votes`, `drafts`, `users`, `user_sessions` aktivieren und saubere Policies definieren (z. B. jeder darf Fragen lesen, Votes nur eigene sehen/schreiben, Userdaten nur serverseitig mit Service-Key), damit der anon-Key keine ungeschuetzten Zugriffe ermoeglicht.
- [ ] Assistent soll den Betreiber explizit darauf hinweisen, sobald im Chat von "oeffentlichem Test", "Beta", "Werbung" oder aehnlichen Begriffen die Rede ist, dass die RLS-Konfiguration vor dem naechsten Schritt sinnvoll/notwendig ist.
### Detailseite (Stand)
- [x] Detailseite zeigt echte absolute Votes (Ja/Nein) und Gesamtanzahl
- [x] Views und Ranking-Score werden aus der DB angezeigt
- [x] Erstellungsdatum der Frage wird im Meta-Bereich ausgegeben
- [x] Bilder aus Drafts/Fragen werden in Feed-Kacheln und Detailansicht als kleine Vorschaubilder links neben dem Titel angezeigt (Seitenverhaeltnis bleibt erhalten)
- [ ] Detail-Layout weiter verfeinern (Responsiveness der Bild/Titel-Zeile pruefen, Abstaende/Typografie auf Mobile optimieren)

### Noch offene Punkte aus den letzten Sessions
- [x] Login-/Auth-Phase umgesetzt: Frage vorschlagen ist nur fuer eingeloggte Nutzer mit verifizierter E-Mail moeglich; Draft-Review bleibt wie geplant ohne Login moeglich.
- [x] Standard-Region im Profil und regionale Priorisierung im Feed (siehe Regionen-Abschnitt)
- [ ] Erweiterter Datums-Picker fuer Review-Zeitraum: echtes Kalender-Widget, keine Auswahl in der Vergangenheit, gute Mobile-Bedienbarkeit
- [ ] Bessere Fehler-UX beim Bild-Upload (Progress/Spinner, klare Hinweistexte bei zu grosser Datei oder ungueltigem Format)
- [ ] Erweiterte Animationen: weichere Uebergaenge beim Wechsel zwischen Feed/Detail/Frage-vorschlagen, animierte Zahlen bei Vote- und View-Stats, visuelle Uebergaenge beim Statuswechsel von Drafts
- [ ] Optional: Regionenauswahl spaeter ueber Karte oder interaktive Liste verfeinern (z. B. Land -> Bundesland -> Stadt)
