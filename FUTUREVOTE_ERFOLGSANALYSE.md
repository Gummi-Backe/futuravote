# FutureVote Erfolgsanalyse

Stand: 09.08.2026

Diese Analyse basiert auf einem Live-Test der oeffentlichen Website, des angemeldeten Adminbereichs und der mobilen Darstellung sowie auf einer Pruefung des aktuellen Codes. Sie ist bewusst kritisch. Ziel ist kein moeglichst grosser Funktionsumfang, sondern eine glaubwuerdige Plattform mit wiederkehrender Nutzung.

## Kurzurteil

FutureVote hat als allgemeine Umfrageplattform derzeit keine realistische Chance gegen etablierte Anbieter. Dafuer fehlen Reichweite, Manipulationsschutz, eine klare Position und ein belastbarer Nutzungsgrund.

Eine reale Nischenchance besteht als deutschsprachige Plattform fuer oeffentliche Debatten und Prognosen, wenn vier Dinge konsequent verbunden werden:

1. Nutzer schlagen Fragen vor.
2. Eine nachweisbar echte Community entscheidet ueber die Agenda.
3. Fragen erhalten eine neutrale, nachvollziehbare Einordnung.
4. Prognosen werden spaeter transparent mit Quellen aufgeloest.

Diese Kombination ist interessant. Sie ist im aktuellen Produkt aber noch nicht glaubwuerdig genug abgesichert und auf der Startseite nicht klar genug sichtbar.

## Verifizierter Ist-Zustand

- 73 oeffentliche Fragen, davon 20 aktiv und 53 beendet.
- 614 Stimmen insgesamt, durchschnittlich 8,4 Stimmen je Frage.
- 9 Stimmen in den letzten 30 Tagen und 6 Stimmen in den letzten 7 Tagen.
- 56 eindeutige Sitzungen in 30 Tagen als MAU-Naeherung; 8 in 7 Tagen.
- WAU/MAU-Naeherung: 14,3 Prozent.
- In 7 Tagen: 0 Registrierungen, 0 Shares, 0 Kopien, 0 Referral-Besuche.
- 65 Vorschlaege des Admin-Kontos wurden angenommen, kein Vorschlag wurde abgelehnt.
- Nur vier Konten erscheinen in der Community-Rangliste.
- Die Community-Mehrheit lag bei 1 von 9 aufgeloesten Prognosen richtig. Diese Stichprobe ist viel zu klein fuer eine belastbare Erfolgsbehauptung.
- Die mobilen Kernseiten funktionieren bei 360 und 390 Pixel Breite ohne erkennbaren horizontalen Ueberlauf.
- Der Produktions-Build funktioniert.
- Der Linter meldet 397 Fehler und 29 Warnungen.
- Es gibt keine automatisierten Tests und keinen GitHub-CI-Workflow.
- Der Produktions-Abhaengigkeitscheck meldet 23 bekannte Schwachstellen, darunter 12 hohe.
- Die taeglichen Cron-Jobs laufen nicht verlaesslich: Der letzte sichtbare Aufloesungs-Lauf war am 12.07.2026, Trend- und E-Mail-Jobs haben keinen sichtbaren Lauf.

Die Werte wurden waehrend der Pruefung teilweise durch eigene Seitenaufrufe beeinflusst. Die reale organische Nutzung liegt daher eher niedriger als die sichtbaren Sieben-Tage-Werte.

### Technischer Nachtrag vom 09.08.2026

Phase 0 ist lokal weitgehend umgesetzt und mit Build, Typpruefung, 11 automatischen Regeltests, GPT-Vertragspruefung und Dependency-Audit geprueft. `npm audit --omit=dev` meldet 0 bekannte Schwachstellen. ESLint meldet keine Fehler mehr, aber weiterhin 400 Warnungen als technische Schuld. Der produktive Supabase- und Vercel-Rollout ist noch offen; deshalb bleiben die Phase-0-Punkte bis zur Livepruefung unabgehakt. Die verbindliche Reihenfolge steht in `PHASE0_ROLLOUT.md`.

## Was bereits gut ist

- Ruhiges, eigenstaendiges Design mit guter mobiler Grunddarstellung.
- Oeffentliche Meinungsumfragen und aufloesbare Prognosen sind getrennt modelliert.
- Detailseiten zeigen Beschreibung, Quellen, Aufloesung, Stimmen, Kommentare und Statistiken.
- Private Link-Umfragen, Einbettung, Archiv, Ranglisten und Profile sind bereits vorhanden.
- Sitemap, robots.txt, Canonicals und individuelle Metadaten fuer Frageseiten sind vorhanden.
- Sensible Supabase-Tabellen sind durch RLS vor anonymem Lesen geschuetzt.
- GPT-Einreichungen werden serverseitig umfangreich validiert und Bilder dauerhaft bei FutureVote gespeichert.
- Admin-Aktionen werden serverseitig auf die Adminrolle geprueft.

## Kritische Produktprobleme

### 1. Das Alleinstellungsmerkmal ist noch nicht glaubwuerdig

Die Startseite sagt nicht sofort: "Du stellst die Fragen. Die Community entscheidet, was live geht." Der Review-Bereich ist leer und besitzt keinen hilfreichen Leerzustand. Gleichzeitig koennen Admins Vorschlaege direkt uebernehmen. Eine angenommene und bereits veroeffentlichte Frage zeigt auf ihrer Draft-Seite trotzdem noch "1 von 5 Reviews". Das wirkt widerspruechlich.

Die Admin-Ausnahme ist fuer Recht, Missbrauch und Notfaelle sinnvoll. Sie muss aber als Ausnahme protokolliert und sichtbar von einer Community-Annahme unterschieden werden.

### 2. Die Plattform hat noch keine aktive Community

20 aktive Fragen verteilen wenige Stimmen auf zu viele Ziele. Das erzeugt Karten mit ein oder zwei Stimmen und vermittelt Leere. Bei der heutigen Reichweite sind zwei bis drei starke Fragen pro Woche und eine deutlich hervorgehobene "Frage der Woche" sinnvoller als ein grosser paralleler Feed.

### 3. Prognosen sind fachlich noch zu einfach

Ein Nutzer kann bei einer Prognose nur Ja oder Nein waehlen und die Einschaetzung nicht spaeter aktualisieren. Die Rangliste bewertet nur richtig oder falsch. Eine echte Prognoseplattform erfasst Wahrscheinlichkeiten, erlaubt Aktualisierungen und bewertet Kalibrierung, zum Beispiel mit einem Brier Score.

FutureVote muss sich entscheiden:

- Kurzfristig ehrlich als Meinungs- und Einschaetzungsplattform auftreten.
- Mittelfristig fuer Prognosen Wahrscheinlichkeiten von 1 bis 99 Prozent, Aenderungsverlauf und faire Scores einfuehren.

### 4. Manipulationsschutz reicht nicht aus

- Gaststimmen werden nur durch ein loeschbares Browser-Cookie getrennt.
- Draft-Reviews werden ebenfalls anonym und nur pro Browser-Cookie begrenzt.
- Drei Meldungen aus drei neuen Browser-Sitzungen koennen eine Frage automatisch ausblenden.
- Rate-Limits liegen teilweise nur im Speicher einer einzelnen Serverinstanz und sind in Serverless-Umgebungen kein dauerhafter Schutz.
- Stimmen- und Review-Zaehler werden per Lesen-und-Schreiben aktualisiert und koennen bei gleichzeitigen Zugriffen Werte verlieren.

Damit kann FutureVote seine Ergebnisse derzeit nicht als repräsentative Meinung oder besonders verlaessliche Community-Entscheidung bezeichnen.

### 5. Betrieb und E-Mail-Funktionen sind unzuverlaessig

Die Vercel-Projektwurzel ist erkennbar `frontend`, die Cron-Konfiguration liegt aber im Repository-Stamm. Vercel verlangt `vercel.json` in der Projektwurzel. Das erklaert schluessig, warum die Jobs nicht taeglich laufen. Dadurch fehlen Trend-Snapshots, Aufloesungsvorschlaege und Benachrichtigungs-E-Mails.

Das Monitoring zeigt einen alten erfolgreichen Lauf weiterhin als "OK". Erfolg ohne Aktualitaetspruefung ist ein falsches Sicherheitssignal.

### 6. Erstellung ist fuer normale Nutzer zu schwer

Das Formular ist auf Mobilgeraeten fast 4.000 Pixel lang. Prognosen verlangen Titel, Text, Regeln, Quellen, Termine und optional Bilder. Das ist fachlich sinnvoll, aber fuer neue Nutzer zu viel auf einmal. Der KI-Assistent im Formular ist nur fuer Admins sichtbar; der externe GPT erzeugt zusaetzliche Abhaengigkeit von ChatGPT und OpenAI-Billing.

### 7. Technische Qualitaet und Sicherheit brauchen eine Basis

- Der allgemeine Bild-Upload ist ohne Anmeldung erreichbar und verwendet serverseitige Storage-Rechte.
- Login und Registrierung haben kein dauerhaftes Rate-Limit.
- Login-Sitzungen besitzen in der Datenbank kein Ablaufdatum; nur das Browser-Cookie laeuft ab.
- Produktions-Cookies nutzen `SameSite=None`, waehrend zustandsaendernde APIs keinen erkennbaren CSRF-Schutz besitzen.
- Der Server gibt bei manchen Fehlern interne Datenbankmeldungen an Nutzer zurueck.
- Wichtige Security-Header wie CSP, Referrer-Policy und Permissions-Policy fehlen.
- Direkte Abhaengigkeiten wie Next.js, Nodemailer und Sharp haben gemeldete Sicherheitsupdates.

### 8. Auffindbarkeit ist brauchbar begonnen, aber nicht fertig

Frageseiten sind serverseitig gerendert und besitzen Canonicals sowie Social-Metadaten. Die Fragen des Startseiten-Feeds stehen jedoch nicht im initialen HTML. Eine serverseitige, crawlbare Uebersicht `/questions` und Themenseiten fehlen. Strukturierte Daten fehlen ebenfalls.

GPT-Bilder werden als 512 x 512 Pixel gespeichert, in Open-Graph-Metadaten aber als 1200 x 630 Pixel bezeichnet. Fuer gute Social-Vorschauen braucht es echte 1200-x-630-Grafiken oder eine dynamische OG-Bildroute.

## Marktvergleich

- Metaculus ist auf serioese Prognosen spezialisiert: Wahrscheinlichkeiten, nachtraegliche Aktualisierungen, klare Aufloesungsregeln und Scoring. Die Plattform nennt mehr als 4,1 Millionen Prognosen und rund 24.900 Fragen.
- Polymarket konkurriert ueber handelbare Marktpreise und finanziellen Einsatz. Das ist ein anderes, regulatorisch deutlich schwierigeres Produkt.
- Manifold ist ein sozialer Prognosemarkt, auf dem Nutzer selbst Maerkte erstellen koennen.
- Civey konkurriert bei oeffentlicher Meinung mit verifizierten Teilnehmern, Plausibilitaetspruefungen, Quotierung und statistischer Gewichtung.
- Slido und PollUnit gewinnen bei einfachen privaten oder veranstaltungsbezogenen Abstimmungen durch sehr schnelle Erstellung und viele Abstimmungsarten.

FutureVote sollte keinen dieser Anbieter komplett kopieren. Die staerkste Position ist:

> Die deutschsprachige Community-Plattform, auf der Nutzer relevante oeffentliche Fragen auf die Agenda setzen, neutral informiert abstimmen und Prognosen spaeter transparent ueberpruefen.

## Priorisierter Erfolgsplan

### Phase 0: Vertrauen und Betrieb reparieren

Statushinweise in Klammern beschreiben nur den lokalen Code. `[x]` wird erst nach erfolgreicher Produktionspruefung gesetzt.

- [ ] `vercel.json` in die tatsaechliche Vercel-Projektwurzel verschieben und alle fuenf Cron-Jobs produktiv pruefen. (verschoben; Vercel-Pruefung offen)
- [ ] Monitoring mit Aktualitaetsgrenzen ausstatten: taeglicher Job nach 26 Stunden gelb, nach 48 Stunden rot. (lokal umgesetzt)
- [ ] Bild-Upload nur fuer angemeldete, bestaetigte Nutzer erlauben und dauerhaft begrenzen. (lokal umgesetzt)
- [ ] Login, Registrierung, Stimmen, Reviews, Meldungen und Kommentare mit einem zentralen, persistenten Rate-Limit schuetzen. (lokal umgesetzt; DB-Migration offen)
- [ ] Reviews nur fuer bestaetigte Konten zulassen; Accountalter, Aktivitaet und Vertrauensniveau beruecksichtigen. (bestaetigtes Konto umgesetzt; weitere Vertrauensstufen bewusst vertagt)
- [ ] Automatische Veroeffentlichung nicht allein durch fuenf Browser-Sitzungen erlauben. (lokal umgesetzt: bestaetigte Konten statt Browser-Sitzungen)
- [ ] Meldungen zunaechst in Quarantaene-Pruefung geben; keine automatische Unsichtbarkeit durch drei anonyme Cookies. (lokal umgesetzt: Prioritaet statt Auto-Ausblendung)
- [ ] Stimmen, Views und Review-Zaehler atomar in der Datenbank aktualisieren. (Migration vorbereitet; Livepruefung offen)
- [ ] Eindeutige Datenbankregel pro Frage und Nutzer ergaenzen. (Migration vorbereitet; Livepruefung offen)
- [ ] Sitzungen serverseitig ablaufen lassen und CSRF-/Origin-Schutz ergaenzen. (lokal umgesetzt; Migration offen)
- [ ] Direkte Abhaengigkeiten aktualisieren und alle hohen Sicherheitsmeldungen schliessen. (lokal: 0 bekannte Produktionsschwachstellen)
- [ ] Mindestens API-Tests fuer Auth, Stimme, Review, Draft-Erstellung, Promotion und Cron-Jobs einfuehren. (11 Regeltests vorhanden; echte API-/DB-Integrationstests noch offen)
- [ ] GitHub-CI fuer Lint, Typpruefung, Tests, Build und Dependency-Audit einrichten. (Workflow vorhanden; erster GitHub-Lauf offen)

### Phase 1: Position und Kernablauf schaerfen

- [ ] Startseite auf eine Botschaft reduzieren: Nutzer schlagen vor, Community entscheidet, Ergebnis wird transparent.
- [ ] Fuer neue Nutzer zuerst drei bis fuenf relevante Fragen zeigen; erweiterte Filter hinter "Mehr Filter" legen.
- [ ] Eine "Frage der Woche" und maximal zwei bis drei neue Hauptfragen pro Woche einfuehren.
- [ ] Review-Bereich mit Erklaerung, offenem Quorum, Zeit, Kriterien und gutem Leerzustand gestalten.
- [ ] Community-Annahme, Admin-Ausnahme und Ablehnung im Verlauf eindeutig kennzeichnen.
- [ ] Erstellungsablauf in kurze Schritte teilen: Art, Frage, Kontext, Regeln, Vorschau.
- [ ] Normale Nutzer mit Vorlagen oder einem eingebauten Assistenten unterstuetzen.
- [ ] Aufloesungs-Deadline immer nach Abstimmungsende erzwingen und sinnvolle Standardwerte setzen.
- [ ] Antwortoptionen auf Neutralitaet, Vollstaendigkeit und gleiche sprachliche Staerke pruefen.

### Phase 2: Prognosen fachlich glaubwuerdig machen

- [ ] Meinungs-Umfrage und Prognose auch visuell und sprachlich klar trennen.
- [ ] Prognosen als Wahrscheinlichkeit statt als einfache Ja-/Nein-Stimme erfassen.
- [ ] Prognosen bis zum Ende aktualisierbar machen und den Verlauf speichern.
- [ ] Brier Score oder eine vergleichbare nachvollziehbare Bewertungsregel einfuehren.
- [ ] Community-Prognose erst nach einer Mindestzahl unabhaengiger Einschaetzungen zeigen, um Ankereffekte zu reduzieren.
- [ ] Ergebnisquellen, Aufloesungsentscheidung und Aenderungshistorie dauerhaft nachvollziehbar machen.

### Phase 3: Verteilung statt weiterer Funktionsbreite

- [ ] Drei bis fuenf Pilotpartner gewinnen: lokale Medien, politische Bildungsangebote, Vereine, Newsletter oder Hochschulgruppen.
- [ ] Einbettungs-Widget fuer Partner vereinfachen und Herkunft von Besuchen und Stimmen korrekt messen.
- [ ] Echte Social-Vorschaubilder in 1200 x 630 Pixel erzeugen.
- [ ] Nach Einwilligung einen woechentlichen Rundbrief mit neuen Fragen und Ergebnissen starten.
- [ ] RSS/Atom fuer neue und aufgeloeste Fragen bereitstellen.
- [ ] Ergebnisgrafiken und QR-Codes fuer Veranstaltungen und Social Media anbieten.
- [ ] Erst nach funktionierender organischer Nutzung ueber automatische Social-Veroeffentlichung nachdenken.

### Phase 4: Geschaeftsmodell validieren

- [ ] Oeffentliche Nutzung kostenlos und transparent halten.
- [ ] Bezahlte private Bereiche, Partner-Widgets und Auswertungen fuer Vereine, Medien und Organisationen testen.
- [ ] Gesponserte Fragen nur klar gekennzeichnet und ohne Einfluss auf Ergebnis oder Review zulassen.
- [ ] Vor Entwicklung Preise mit mindestens zehn potenziellen Kunden besprechen.
- [ ] Keine native App bauen, bevor wiederkehrende mobile Nutzung nachgewiesen ist; zuerst PWA und Web-Push pruefen.

## Messbare Erfolgstore

Die naechste groessere Entwicklungsstufe beginnt erst, wenn die vorherige messbar funktioniert.

- [ ] Alle taeglichen Jobs laufen 30 Tage lang ohne verpassten Lauf.
- [ ] Keine offene hohe Dependency-Schwachstelle.
- [ ] Mindestens 100 woechentlich aktive Abstimmende.
- [ ] Mindestens 25 echte Stimmen in den ersten 48 Stunden je Hauptfrage.
- [ ] Mindestens 10 unterschiedliche bestaetigte Reviewer pro oeffentlichem Vorschlag.
- [ ] Mindestens 30 Prozent WAU/MAU.
- [ ] Mindestens 20 Prozent der neuen Nutzer sind nach vier Wochen noch aktiv.
- [ ] Mindestens drei Partner liefern wiederkehrend Besucher und Stimmen.
- [ ] Shares, Referral-Besuche und Referral-Stimmen werden nicht mehr mit null gemessen.
- [ ] Mindestens 90 Prozent der aufloesbaren Fragen werden fristgerecht und mit Quelle aufgeloest.

## Was vorerst nicht gebaut werden sollte

- Keine native App vor nachgewiesener Wiederkehr und klarem Push-Nutzen.
- Keine weitere grosse Sammlung von Filtern, Statistikkarten oder Ranglistenvarianten.
- Keine massenhafte KI-Erzeugung neuer Fragen, solange Stimmen und Reviews duenn verteilt sind.
- Keine Behauptung, Ergebnisse seien repraesentativ.
- Keine hervorgehobene "Community-Trefferquote", solange die Stichprobe so klein ist.
- Keine Monetarisierung, die Neutralitaet oder Vertrauen unklar erscheinen laesst.

## Quellen zum Marktvergleich

- Metaculus: https://www.metaculus.com/about/
- Metaculus Prognoseprinzip: https://www.metaculus.com/how-to-forecast/
- Metaculus Fragenrichtlinien: https://www.metaculus.com/question-writing/
- Polymarket: https://help.polymarket.com/en/articles/13364272-what-is-a-prediction-market
- Manifold: https://docs.manifold.markets/
- Civey Methodik: https://civey.com/unsere-methode
- Slido Live Polling: https://www.slido.com/features-live-polling
- PollUnit Abstimmungen: https://pollunit.com/de/abstimmung
- Vercel Projektkonfiguration: https://vercel.com/docs/project-configuration/vercel-json
