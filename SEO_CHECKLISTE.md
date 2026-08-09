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

- [x] `/questions` nicht mehr auf die Startseite umleiten, sondern als eigene oeffentliche Uebersicht umsetzen.
- [x] Aktive oeffentliche Umfragen bereits im Server-HTML ausgeben.
- [x] Normale crawlbare Links (`<a href>` beziehungsweise Next.js `Link`) zu jeder Umfrage verwenden.
- [x] Seitennavigation fuer alle Umfragen einbauen, damit auch aeltere Eintraege erreichbar bleiben.
- [x] Eindeutigen Seitentitel, Beschreibung, H1 und kanonische URL fuer `/questions` setzen.
- [x] `/questions` in Navigation oder Footer und in die Sitemap aufnehmen.
- [x] Mobile Darstellung, Statuscode, Canonical, Indexierbarkeit und HTML-Ausgabe testen.

Produktionspruefung am 09.08.2026: 20 aktive Fragen auf zwei Seiten, HTTP 200, korrekte Canonicals,
crawlbare Links bereits im Server-HTML, Eintrag in der Sitemap sowie kein horizontaler Ueberlauf auf Mobil und Desktop.

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

## Verbindliche Erklaerregel fuer alle folgenden Reichweiten-Funktionen

Die Abschnitte 10 bis 17 duerfen nicht direkt umgesetzt werden. Vor jedem Abschnitt muss Codex Roland zuerst in einfacher Sprache erklaeren:

- was die Funktion sichtbar veraendert und welchen Nutzen sie haben soll,
- welche Daten gespeichert oder an einen externen Dienst gesendet werden,
- ob laufende oder einmalige Kosten entstehen koennen,
- welche Konten, Schluessel, Berechtigungen oder Zustimmungen benoetigt werden,
- was Roland selbst anklicken, entscheiden, bereitstellen oder freigeben muss,
- welche Datenschutz-, Missbrauchs- oder Wartungsrisiken bestehen,
- wie getestet wird und wie die Funktion bei Problemen wieder abgeschaltet werden kann.

Erst nach dieser Erklaerung und Rolands ausdruecklicher Zustimmung beginnt die Umsetzung.

## 10. Social-Media-Vorschaubilder

- [x] **Erklaerung und Freigabe:** Darstellung, Bildinhalt, Plattformen und Rolands Entscheidungen vorab besprechen.
- [x] Fuer jede oeffentliche Umfrage ein eigenes Vorschaubild im Format 1200 x 630 Pixel erzeugen.
- [x] Titel, FutureVote-Marke und ein passendes Umfragebild gut lesbar kombinieren.
- [x] Open-Graph- und Social-Metadaten auf die neue Vorschau umstellen.
- [ ] Vorschauen fuer WhatsApp, Facebook, LinkedIn, Telegram und weitere Dienste testen. Technische Metadaten und Bilddatei sind geprueft; die externen Vorschau-Caches noch nicht.
- [ ] Rolands Aufgabe: Gestaltung und sichtbare Markenbezeichnung in der veroeffentlichten Vorschau abschliessend bestaetigen.

## 11. Direktes Teilen und QR-Codes

- [x] **Erklaerung und Freigabe:** Zielplattformen, Datenschutz und sichtbare Bedienung vorab besprechen.
- [x] Ein Teilen-Menue fuer WhatsApp, Telegram, LinkedIn, Bluesky und E-Mail entwerfen.
- [x] Bestehende Empfehlungslinks weiterhin verwenden und Plattform als anonyme Statistik erfassen.
- [x] Pro Umfrage einen QR-Code fuer den kanonischen oder den Empfehlungslink erzeugen.
- [x] QR-Code als Bild herunterladen und fuer Druck oder Bildschirm verwenden koennen.
- [x] Rolands Aufgabe: gewuenschte Plattformen und bevorzugte Linkart auswaehlen.

## 12. RSS- und Atom-Feed

- [ ] **Erklaerung und Freigabe:** Unterschied zwischen Feed, Newsletter und Suchmaschine vorab erklaeren.
- [ ] Oeffentlichen Feed fuer neue Umfragen bereitstellen.
- [ ] Optional einen zweiten Feed fuer beendete oder aufgeloeste Umfragen bereitstellen.
- [ ] Nur oeffentliche Inhalte, kanonische URLs und stabile Bildadressen ausgeben.
- [ ] Feed im HTML und im Footer auffindbar verlinken.
- [ ] Feed mit mehreren Readern und einem Validator testen.
- [ ] Rolands Aufgabe: entscheiden, ob nur neue Umfragen oder auch Ergebnisse im Feed erscheinen.

## 13. IndexNow fuer Bing und teilnehmende Suchmaschinen

- [ ] **Erklaerung und Freigabe:** beteiligte Suchmaschinen, gesendete URLs und Grenzen von IndexNow vorab erklaeren.
- [ ] Einen eigenen IndexNow-Schluessel sicher erzeugen und die vorgeschriebene Pruefdatei oeffentlich bereitstellen.
- [ ] Neue, geaenderte und geloeschte oeffentliche Umfrage-URLs automatisch melden.
- [ ] Private Umfragen, Drafts, Profilseiten und technische URLs niemals senden.
- [ ] Fehler protokollieren, Wiederholungen begrenzen und Missbrauchsschutz einbauen.
- [ ] Bing Webmaster Tools zur Kontrolle vorbereiten.
- [ ] Rolands Aufgabe: automatische Meldungen genehmigen und gegebenenfalls Bing Webmaster Tools verbinden.

## 14. Verbessertes Einbettungs-Widget und Ergebnisgrafiken

- [ ] **Erklaerung und Freigabe:** Einbettung, Fremdseitenzugriff, Tracking und Gestaltung vorab besprechen.
- [ ] Helle, dunkle und kompakte Widget-Varianten bereitstellen.
- [ ] Abstimmungsansicht und reine Live-Ergebnisansicht anbieten.
- [ ] Responsive Hoehen und stabile Darstellung auf fremden Webseiten testen.
- [ ] Eine teilbare Ergebnisgrafik fuer beendete Umfragen erzeugen.
- [ ] Einbettungen und daraus kommende Besuche datensparsam messen.
- [ ] Rolands Aufgabe: erlaubte Varianten, Markenauftritt und gewuenschte Statistik festlegen.

## 15. Woechentlicher E-Mail-Rundbrief

- [ ] **Erklaerung und Freigabe:** Empfaenger, Inhalte, Einwilligung, Versandkosten und Rolands Aufgaben vorab genau erklaeren.
- [ ] Empfaengerregel festlegen: nur Nutzer mit bestaetigter E-Mail-Adresse und ausdruecklich aktiviertem Rundbrief.
- [ ] Einen eigenen Schalter `Woechentlicher FutureVote-Rundbrief` im Profil einbauen.
- [ ] Den Rundbrief standardmaessig ausschalten; bestehende Benachrichtigungseinstellungen gelten nicht als Zustimmung.
- [ ] Optional entscheiden, ob auch Personen ohne FutureVote-Konto ein Anmeldeformular erhalten sollen.
- [ ] Fuer Anmeldungen ein Double-Opt-in mit Bestaetigungslink umsetzen.
- [ ] Zeitpunkt, Version und Status der Zustimmung nachvollziehbar speichern.
- [ ] In jeder Rundbrief-Mail einen funktionierenden Abmeldelink bereitstellen.
- [ ] Abmeldung im Profil sofort wirksam machen.
- [ ] Nur bestaetigte und aktuell angemeldete Empfaenger serverseitig aus Supabase laden.
- [ ] Keine E-Mail-Adressliste an Codex uebergeben, exportieren, kaufen oder aus fremden Quellen importieren.
- [ ] Vorhandenen SMTP-Versand auf Kapazitaet, Zustellbarkeit und moegliche Kosten pruefen.
- [ ] Absendername, Antwortadresse und rechtliche Pflichtangaben festlegen.
- [ ] Inhalt und Rhythmus festlegen, zum Beispiel neue, beliebte und bald endende Umfragen einmal pro Woche.
- [ ] Datenschutzinformationen fuer den Rundbrief ergaenzen und vor Livegang pruefen lassen.
- [ ] Testversand nur an eine von Roland bestimmte eigene Testadresse durchfuehren.
- [ ] Rolands Aufgabe: Empfaengermodell, Absender, Rhythmus, Inhalt und Testversand ausdruecklich bestaetigen; keine fremden Adressen bereitstellen.

## 16. Web-Push-Benachrichtigungen

- [ ] **Erklaerung und Freigabe:** Browserfreigabe, gespeicherte Push-Abonnements und Benachrichtigungsfaelle vorab erklaeren.
- [ ] Service Worker und sichere Push-Schluessel einrichten.
- [ ] Freiwillige Anmeldung ohne aufdringliche automatische Berechtigungsabfrage gestalten.
- [ ] Auswahl fuer neue Themen, neue Umfragen oder Ergebnisse anbieten.
- [ ] Abmeldung und Loeschung des Push-Abonnements jederzeit ermoeglichen.
- [ ] Versandrate begrenzen und keine Benachrichtigungen ohne passenden Anlass senden.
- [ ] Browser- und Mobilgeraete-Kompatibilitaet testen.
- [ ] Rolands Aufgabe: erlaubte Benachrichtigungsarten und maximale Haeufigkeit festlegen.

## 17. Automatische Social-Beitraege, Medienbereich und Umfrage der Woche

- [ ] **Erklaerung und Freigabe:** jeden Teil als eigenes Vorhaben mit Kontozugriff, Kosten und Veroeffentlichungsregeln erklaeren.
- [ ] Fuer automatische Social-Beitraege nur von Roland ausgewaehlte Plattformen vorbereiten.
- [ ] Social-Konten ausschliesslich ueber offizielle Freigaben verbinden; Passwoerter oder API-Schluessel nicht in den Quellcode schreiben.
- [ ] Vor automatischer Veroeffentlichung festlegen, ob jeder Beitrag eine manuelle Freigabe benoetigt.
- [ ] Medienbereich mit Plattformbeschreibung, Logo, Kontaktweg, Statistiken und einbettbaren Grafiken planen.
- [ ] Eine nachvollziehbare Regel fuer die `Umfrage der Woche` definieren.
- [ ] Umfrage der Woche auf FutureVote, im Feed, im Rundbrief oder als Social-Beitrag wiederverwenden.
- [ ] Rolands Aufgabe: Konten freigeben, Plattformen auswaehlen, Freigabeprozess bestimmen und Medieninhalte bestaetigen.

## Abschlusskriterien

- [ ] Alle oeffentlichen Umfragen sind ueber Sitemap und crawlbare interne Links erreichbar.
- [ ] Neue Umfragen erscheinen automatisch in Sitemap und Umfrageverzeichnis.
- [ ] Alle indexierbaren Seitentypen besitzen eindeutige Metadaten und korrekte Canonicals.
- [ ] Strukturierte Daten sind fehlerfrei und entsprechen dem sichtbaren Inhalt.
- [ ] Die wichtigsten Seiten bestehen die vereinbarten mobilen Core-Web-Vitals-Ziele.
- [ ] Search Console zeigt keine systematischen technischen Indexierungsfehler.
- [ ] Ein dauerhaft machbarer Prozess fuer Inhalte, Verteilung und Kontrolle ist etabliert.
- [ ] Keine Reichweiten-Funktion wurde ohne vorherige Erklaerung und Rolands ausdrueckliche Zustimmung aktiviert.
- [ ] Newsletter, Push und Social-Automatisierung besitzen dokumentierte Einwilligungs-, Abmelde- und Abschaltwege.
