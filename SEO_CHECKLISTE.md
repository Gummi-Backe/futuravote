# FutureVote SEO-Checkliste

Diese Liste wird in der angegebenen Reihenfolge abgearbeitet. Ein Punkt wird erst mit `[x]` markiert, wenn Umsetzung, Test und Produktionspruefung abgeschlossen sind.

## 0. Bereits erledigte Grundlagen

- [x] `robots.txt` erlaubt oeffentliche Seiten und verweist auf `https://www.future-vote.de/sitemap.xml`.
- [x] Dynamische Sitemap eingerichtet: Neue oeffentliche Umfragen erscheinen ohne erneuten Vercel-Deploy.
- [x] Bestehende Umfragen nachgetragen und live geprueft: 72 oeffentliche Umfragen, 72 Sitemap-URLs, 0 fehlend.
- [x] Echte Erstellungs- und Aufloesungsdaten als `lastmod` verwenden; keine kuenstlichen Aenderungsdaten senden.
- [ ] Sitemap einmal in der Google Search Console unter **Indexierung > Sitemaps** einreichen bzw. den erfolgreichen Status kontrollieren.
- [ ] Ausgangswerte dokumentieren: indexierte Seiten, nicht indexierte Seiten, Impressionen, Klicks und durchschnittliche Position.

## 1. Serverseitiges Umfrageverzeichnis

- [ ] `/questions` nicht mehr auf die Startseite umleiten, sondern als eigene oeffentliche Uebersicht umsetzen.
- [ ] Aktive oeffentliche Umfragen bereits im Server-HTML ausgeben.
- [ ] Normale crawlbare Links (`<a href>` beziehungsweise Next.js `Link`) zu jeder Umfrage verwenden.
- [ ] Seitennavigation fuer alle Umfragen einbauen, damit auch aeltere Eintraege erreichbar bleiben.
- [ ] Eindeutigen Seitentitel, Beschreibung, H1 und kanonische URL fuer `/questions` setzen.
- [ ] `/questions` in Navigation oder Footer und in die Sitemap aufnehmen.
- [ ] Mobile Darstellung, Statuscode, Canonical, Indexierbarkeit und HTML-Ausgabe testen.

## 2. Themenseiten

- [ ] Sinnvolle Themenstruktur aus den vorhandenen Kategorien festlegen, zum Beispiel Politik, Rente, Wirtschaft und KI.
- [ ] Stabile, lesbare URLs definieren, zum Beispiel `/themen/politik` und `/themen/rente`.
- [ ] Jede Themenseite serverseitig mit passenden oeffentlichen Umfragen ausgeben.
- [ ] Pro Themenseite eine kurze, individuelle und hilfreiche Einleitung verfassen.
- [ ] Keine nahezu identischen Einleitungen oder automatisch aufgefuellten SEO-Texte verwenden.
- [ ] Eindeutige Titel, Meta-Beschreibungen, H1 und Canonicals setzen.
- [ ] Crawlbare Links zwischen Umfragen, Umfrageverzeichnis und Themenseiten einbauen.
- [ ] Themenseiten automatisch in die Sitemap aufnehmen.
- [ ] Leere oder sehr duenne Themenseiten nicht indexieren.

## 3. Strukturierte Daten

- [ ] `WebSite`-JSON-LD auf der Startseite mit Name `FutureVote`, URL und passendem Alternativnamen einbauen.
- [ ] `Organization`-JSON-LD einmal zentral mit Name, Website und crawlbarem Logo einbauen.
- [ ] `BreadcrumbList` auf Umfrage- und Themenseiten einbauen.
- [ ] Nur strukturierte Datentypen verwenden, die den sichtbaren Seiteninhalt korrekt beschreiben.
- [ ] Keine unpassenden Typen wie `QAPage` nur fuer einen moeglichen Suchvorteil verwenden.
- [ ] Markup mit Googles Rich Results Test und Schema-Validator pruefen.
- [ ] Einige Live-Seiten nach dem Deployment erneut testen.

## 4. Titel und Suchbeschreibungen

- [ ] Titel aller indexierbaren Seitentypen auf Eindeutigkeit und Laenge pruefen.
- [ ] Umfragetitel sachlich, konkret und ohne Keyword-Wiederholungen ausgeben.
- [ ] Meta-Beschreibungen fuer Umfragen aus dem individuellen Kurztext erzeugen.
- [ ] Umfrageart, Thema und gegebenenfalls Region nur dann ergaenzen, wenn der Suchtext dadurch verstaendlicher wird.
- [ ] Individuelle Meta-Beschreibungen fuer Umfrageverzeichnis und Themenseiten schreiben.
- [ ] H1, HTML-Titel und sichtbarer Seiteninhalt auf Widersprueche pruefen.
- [ ] Open-Graph- und Social-Media-Vorschauen fuer alle neuen Seitentypen testen.

## 5. Inhalte der Umfragen

- [ ] Fuer oeffentliche Meinungs-Umfragen weiterhin etwa 120 bis 180 hilfreiche Woerter verwenden.
- [ ] Fuellelemente wie wiederholte Abstimmungsanweisungen vermeiden.
- [ ] Stattdessen Ausgangslage, betroffene Gruppen und zentrale Argumente neutral erklaeren.
- [ ] Fuer Prognosen zusaetzliche genaue Aufloesungsregeln und serioese Quellen verwenden.
- [ ] Titel, Beschreibung, Antwortoptionen und Aufloesungsregeln auf Widersprueche pruefen.
- [ ] Doppelte oder fast identische Umfragen vor der Veroeffentlichung erkennen.
- [ ] Bilder mit treffendem Alt-Text, stabiler URL und passender Bildquelle ausgeben.

## 6. Geschwindigkeit und Core Web Vitals

- [ ] Lighthouse-Messung fuer Startseite, Umfrageverzeichnis, Themenseite und Umfragedetailseite auf Mobil und Desktop erstellen.
- [ ] Ausgangswerte fuer LCP, INP und CLS dokumentieren.
- [ ] Grosse JavaScript-Pakete und unnoetige clientseitige Komponenten identifizieren.
- [ ] Moeglichst viel oeffentlichen Inhalt serverseitig ausgeben und nur interaktive Bereiche hydratisieren.
- [ ] Bilder auf Abmessungen, Komprimierung, Ladeverhalten und Layoutplatz pruefen.
- [ ] Schriftarten und kritische Ressourcen ohne blockierende oder instabile Ladewege ausliefern.
- [ ] Layoutverschiebungen und ueberlappende Elemente auf kleinen Displays beseitigen.
- [ ] Nach jeder Optimierung erneut messen und Ergebnisse vergleichen.

## 7. Regelmaessige Veroeffentlichung

- [ ] Einen realistischen Redaktionsrhythmus festlegen, zum Beispiel zwei bis drei hochwertige aktuelle Umfragen pro Woche.
- [ ] Themen nach Relevanz fuer die FutureVote-Zielgruppe auswaehlen, nicht nur nach Suchvolumen.
- [ ] Jede Umfrage mit eigenstaendigem Text und nachvollziehbarem Mehrwert veroeffentlichen.
- [ ] Veraltete Prognosen korrekt aufloesen und wichtige inhaltliche Aktualisierungen kennzeichnen.
- [ ] Erfolgreiche Themen anhand von Search-Console-Daten erkennen und sinnvoll vertiefen.
- [ ] Keine massenhaft erzeugten, austauschbaren oder nur fuer Suchmaschinen geschriebenen Seiten anlegen.

## 8. Externe Sichtbarkeit

- [ ] Direkte Umfrage-Links mit funktionierender Bild-, Titel- und Textvorschau teilen.
- [ ] Passende soziale Kanaele und thematische Diskussionen fuer jede Umfrage auswaehlen.
- [ ] Relevante lokale oder fachliche Medien bei passenden Umfragen sachlich ansprechen.
- [ ] FutureVote-Ergebnisse nach Umfrageende erneut teilen, wenn daraus eine interessante Erkenntnis entsteht.
- [ ] Echte redaktionelle Verlinkungen und Empfehlungen aufbauen.
- [ ] Keine Links kaufen und keine automatisierten Link-Netzwerke verwenden.

## 9. Google Search Console und laufende Kontrolle

- [ ] Woechentlich Indexierungsfehler, 404-Seiten, Weiterleitungen und ausgeschlossene URLs kontrollieren.
- [ ] Neue wichtige Seiten bei Bedarf ueber die URL-Pruefung kontrollieren und einmalig zur Indexierung einreichen.
- [ ] Suchanfragen, Impressionen, Klickrate und durchschnittliche Position nach Seitentyp auswerten.
- [ ] Seiten mit vielen Impressionen und niedriger Klickrate bei Titel und Beschreibung verbessern.
- [ ] Seiten mit guter Position, aber duennem Inhalt inhaltlich pruefen und sinnvoll ergaenzen.
- [ ] Core-Web-Vitals-Bericht und Sicherheitsmeldungen kontrollieren.
- [ ] Monatlich den Fortschritt gegen die dokumentierten Ausgangswerte vergleichen.

## Abschlusskriterien

- [ ] Alle oeffentlichen Umfragen sind ueber Sitemap und crawlbare interne Links erreichbar.
- [ ] Neue Umfragen erscheinen automatisch in Sitemap und Umfrageverzeichnis.
- [ ] Alle indexierbaren Seitentypen besitzen eindeutige Metadaten und korrekte Canonicals.
- [ ] Strukturierte Daten sind fehlerfrei und entsprechen dem sichtbaren Inhalt.
- [ ] Die wichtigsten Seiten bestehen die vereinbarten mobilen Core-Web-Vitals-Ziele.
- [ ] Search Console zeigt keine systematischen technischen Indexierungsfehler.
- [ ] Ein dauerhaft machbarer Prozess fuer Inhalte, Verteilung und Kontrolle ist etabliert.
