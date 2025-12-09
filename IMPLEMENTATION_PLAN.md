# Vorgehensplan fuer die Prognose-Plattform

## Phase 0: Grundlagen
- Ziel klaeren: erste Version mit Ja/Nein-Kacheln, Draft-Review und einfachem Ranking.
- Tech-Stack festlegen (Empfehlung: Frontend React/Next.js, Backend NestJS oder ASP.NET Core, DB Postgres, ORM Prisma/TypeORM/EF).
- UX-Richtlinien definieren: Kachel-Layout, Farben pro Kategorie, responsives Grid.
- MVP-Scope festhalten: MUSS (Auth, Kategorien, Fragen-Feed, Ja/Nein-Vote, Draft-Einreichung/-Review mit Auto-Entscheidung, Admin-Basis); NICHT (Profil-Stats, Gamification, Personalisierung, B2B-Exports).
- Login-Regel festlegen: Ja/Nein-Voting ohne Login; Draft einreichen/bewerten nur mit Login; kein Kommentar-System.

## Phase 1: Projekt-Setup
- Repos anlegen: frontend, backend; CI mit Lint/Test/Build.
- Basis-Tooling: TypeScript, Prettier/ESLint, Commit-Hooks (lint-staged), Env-Handling.
- Design-Tokens: Farben, Typografie, Spacings, Komponenten-Grundlagen (Buttons, Badge, Card, Grid).

## Phase 2: Auth & Rollen
- User-Model anlegen; Registrierung/Login; Sessions oder JWT; Passwort-Hashing.
- RBAC-Middleware: Gast, User, Moderator, Admin; Guards pro Route.
- Basis-Profileendpunkte: eigenes Profil lesen, einfache Reputation anzeigen.

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
