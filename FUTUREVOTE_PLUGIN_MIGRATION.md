# FutureVote: GPT -> Plugin

## Status

Der Ersatz ist im Repository implementiert. Der bisherige GPT und seine beiden
Actions bleiben unveraendert. Die Migration wurde nicht angeklickt.

Lokale Abschlusspruefung am 07.10.2026: 48 Tests bestanden, Lint und Typpruefung
ohne Fehler, Produktionsbuild erfolgreich, GPT- und Plugin-Vertragscheck
bestanden. `npm audit --omit=dev` meldet 0 bekannte Produktionsluecken.
Die verbleibende Entwicklungswerkzeug-Warnung wird unten erklaert.

Eine reine GPT-Migration reicht NICHT: OpenAI uebernimmt benutzerdefinierte
Actions nicht. Der neue MCP-Server ersetzt deshalb alle sieben bisherigen
Actions. Ein identisches Antwortverhalten eines anderen Modells und die
oeffentliche Verfuegbarkeit koennen nicht garantiert werden.

## Erhaltene Funktionen

- Aktuelle oeffentliche Fragen, Kategorien, anonymisierte Votes und Reviews.
- Dublettenpruefung vor der Einreichung.
- Bilderzeugung mit dem bestehenden OpenAI-Backend, Verarbeitung auf 512x512
  Pixel und dauerhafte Speicherung bei FutureVote.
- Oeffentliche Prognosen mit Aufloesungskriterien und Quellen.
- Oeffentliche Meinungs-Umfragen mit Ja/Nein oder 2-6 Optionen.
- Private Link-Umfragen mit Enddatum.
- Vorschau und ausdrueckliche Zustimmung vor `createDraft`.
- Bestehende Wortzahl-, Bild-Host-, E-Mail-, Rate-Limit- und Community-Regeln.

Die MCP-Werkzeuge rufen dieselben Route-Handler wie die Actions auf. Sie
umgehen weder Community-Review noch die GPT-spezifische Bildpruefung.
Fremde Browser-Sessions werden am MCP-Endpunkt nicht akzeptiert.

## Server und Anmeldung

- MCP: `https://gpt-write.future-vote.de/mcp` (stateless Streamable HTTP).
- Discovery: `/.well-known/oauth-protected-resource` und
  `/.well-known/oauth-authorization-server`.
- OAuth: `/api/mcp/oauth/authorize`, `/token`, `/revoke`.
- Anmeldung ueber das vorhandene FutureVote-Konto, bestaetigte E-Mail und
  ausdrueckliche Einwilligung in `drafts:write`.
- PKCE S256 ist Pflicht; Redirects werden exakt verglichen.
- Codes sind einmalig und 5 Minuten gueltig. Access-Tokens: 1 Stunde.
  Refresh-Tokens: 30 Tage, werden bei Verwendung rotiert.
- Nur Token-Hashes liegen in den vorhandenen OAuth-Tabellen.
- Der DB-Client-Namespace enthaelt einen SHA-256-Hash aus MCP-Resource und
  Client-ID. Damit sind opaque Tokens genau an diese Resource gebunden und
  von den alten GPT-Tokens getrennt. Keine neue SQL-Migration erforderlich.

Serverseitige Vercel-Konfiguration:

| Variable | Bedeutung |
| --- | --- |
| `FV_MCP_PUBLIC_ORIGIN` | Optional; Standard `https://gpt-write.future-vote.de`. Nur Origin, kein Pfad. |
| `FV_MCP_OAUTH_CLIENT_ID` | Optional; Standard `futurevote_mcp`. |
| `FV_MCP_OAUTH_CLIENT_SECRET` | Empfohlen: eigener starker, serverseitiger Wert. Ohne diese Variable wird das bestehende `FV_GPT_OAUTH_CLIENT_SECRET` verwendet. Kein Secret im Plugin oder Git. |
| `FV_MCP_OAUTH_REDIRECT_URIS` | Optional; kommagetrennte EXAKTE Callback-URLs. Standard `https://chatgpt.com/connector_platform_oauth_redirect`. Beim Verbinden mit ChatGPT die dort angezeigte URL vergleichen. Weitere Clients brauchen ihren eigenen exakten Callback. Keine Host-Wildcards. |

Die bestehenden Supabase-, OpenAI- und Cookie-Einstellungen bleiben erhalten.
Fehlt das Client-Secret, bleibt Schreiben gesperrt. Es gibt bewusst kein
offenes Client-Registrierungs-Endpoint und keine neuen Administratorrechte.

## Paket

`plugins/futurevote/` enthaelt die portable Plugin-Konfiguration, MCP-URL,
Workflow-Skill, identische GPT-Einreichungsregeln und das lokale 512px-Markenlogo.
Es werden keine privaten Zugangsdaten verpackt.

Im Ordner `frontend`:

```powershell
npm run build:plugin
npm run check:plugin
npm run check
```

`build:plugin` synchronisiert die Referenz aus `FUTUREVOTE_GPT_INSTRUCTIONS.md`.
Der Vertragscheck verhindert fehlende Werkzeuge oder abweichende Regeln.

## Sichere Umstellung

1. Aenderungen pruefen und den Server auf Vercel deployen.
2. Die beiden Discovery-URLs und MCP `initialize`/`tools/list` live pruefen.
   `node scripts/smoke-futurevote-mcp.mjs https://gpt-write.future-vote.de`
   prueft alle oeffentlichen Lese-Werkzeuge, den OAuth-Einstieg und abgewiesene
   unangemeldete Schreibaufrufe, ohne Bildkosten oder Live-Einreichungen.
3. In ChatGPT unter Plugins einen benutzerdefinierten MCP-Server mit der
   obigen URL und OAuth erstellen. Bei statischer OAuth-Konfiguration
   `futurevote_mcp` und das serverseitig konfigurierte Client-Secret verwenden.
   Das Secret nur in der geschuetzten Konfiguration eintragen, nie in einen Chat.
4. Den exakten ChatGPT-Callback mit der Allowlist abgleichen.
5. Anmeldung, ein Bild und eine genehmigte Testeinreichung je Umfragetyp
   testen. Dabei koennen Bildkosten entstehen und Testeinreichungen entstehen.
6. Die Skill aus dem Paket mit der MCP-Verbindung verbinden bzw. das Paket
   in der Plugins-Oberflaeche installieren. Bei registrierten Server-Mappings
   die echte `plugin_asdk_app...`-ID verwenden, keine erfundene ID.
7. Erst wenn dieser Live-Test bestanden ist, den alten GPT migrieren oder
   ersetzen. Er wird nach einer Migration nicht mehr bearbeitbar.

Die oeffentliche GPT-Freigabe wird nicht automatisch uebernommen. Eine
oeffentliche Plugin-Verteilung erfordert den separaten OpenAI-Prozess und
gegebenenfalls Pruefung. Das ist keine technische Einstellung am GPT.

## Pruefgrenzen

### Browser-Rueckleitung am 07.10.2026

Der erste echte Verbindungsversuch wurde nach der Freigabe von Edge mit
`ERR_BLOCKED_BY_CLIENT` blockiert. Die Freigabeseite hatte `form-action 'self'`
gesetzt. Chromium prueft diese CSP-Regel auch bei der anschliessenden
HTTP-Weiterleitung zur ChatGPT-Domain.

Die Ausnahme gilt jetzt nur fuer `/api/mcp/oauth/authorize`. Dort werden neben
`'self'` ausschliesslich die Origins der serverseitig konfigurierten OAuth-
Ruecksprungadressen erlaubt. Der Handler und die Next.js-Header-Konfiguration
verwenden dieselbe Regel. Die exakte serverseitige Callback-Pruefung, PKCE,
signierte Consent-Cookies, Ablaufzeiten und Rechte bleiben unveraendert.
Alle normalen Website-Formulare behalten `form-action 'self'`.

Mit `node scripts/serve-mcp-oauth-browser-test.mjs` kann die Freigabe ueber zwei
verschiedene Loopback-Origins im echten Browser geprueft werden. Das ist ein
isoliertes Testkonto ohne Supabase-, OpenAI- oder ChatGPT-Aufrufe. Vor der
Korrektur blieb die Rueckleitung blockiert; danach erreichte Edge die lokale
Callback-Seite auf Desktop und bei 390 Pixeln Breite. Der Server muss nach
diesem manuellen Test beendet werden.

Diese Browserpruefung ersetzt noch nicht die echte ChatGPT-Verknuepfung.

Automatisierte Tests pruefen Protokoll, OAuth und Weitergabe an die bestehenden
Handler mit kontrollierten Testdaten. Sie erzeugen keine kostenpflichtigen
Bilder und schreiben keine Live-Umfragen. Ein erfolgreicher lokaler Test ist
deshalb noch keine bestaetigte ChatGPT-Verknuepfung oder Vercel-Veroeffentlichung.

Der Abhaengigkeitscheck am 07.10.2026 meldete anfangs 14 Probleme in
vorhandenen Paketen. Next.js, Nodemailer, Sharp und betroffene transitive
Pakete wurden aktualisiert. Das neue MCP-SDK und Zod waren nicht betroffen.

Fuer `braces` 3.0.3 gibt es derzeit keinen Upstream-Patch. Es ist nur in der
ESLint-Entwicklungswerkzeug-Kette enthalten, nicht in den Produktionspaketen.
`scripts/patch-lint-braces.mjs` begrenzt nach jeder Installation Parser- und
AST-Tiefe auf 128 und AST-Groesse auf 65536. Der Patch prueft Version und
Original-Hashes und wird gegen tief verschachtelte Muster, direkte ASTs und
Zyklen getestet. Er behaelt die bestehenden Next.js-Lint-Regeln bei. Die
originale npm-Audit-Warnung wird NICHT ausgeblendet und bleibt bis zu einem
Upstream-Update sichtbar. Das ist eine lokale Mitigation, keine offizielle
reparierte Bibliotheksversion.

Zusaetzlich wurden der Fehler-Redirect und die atomare Code-Verwendung im
alten GPT-OAuth-Flow gehaertet. E-Mail-HTML escaped Nutzereingaben; bei
fehlender SMTP-Konfiguration werden produktiv keine Reset- oder
Bestaetigungstokens mehr geloggt.

Offizielle Grundlagen:
[Migration](https://learn.chatgpt.com/docs/migrate-custom-gpts),
[MCP-Authentifizierung](https://developers.openai.com/plugins/build/auth),
[Plugin-Paket](https://developers.openai.com/plugins/build/plugins).
