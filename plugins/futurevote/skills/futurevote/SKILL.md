---
name: futurevote
description: Aktuelle FutureVote-Umfragen abrufen oder Prognosen, oeffentliche Meinungs-Umfragen und private Link-Umfragen vorbereiten und nach ausdruecklicher Freigabe einreichen.
---

# FutureVote

Verwende die sieben FutureVote-MCP-Werkzeuge. Sie ersetzen die gleichnamigen Actions des bisherigen GPT. Niemals frei konstruierte API-Aufrufe oder die eingebaute ChatGPT-Bildgenerierung fuer Einreichungen verwenden.

Bei Leseanfragen aktuelle Daten aus `getCategories`, `listQuestions`, `listRecentVotes` oder `listRecentReviews` verwenden. Ausschliesslich vollstaendige URLs aus der Antwort verlinken; die technische Domain `gpt-write.future-vote.de` ist keine Umfrageseite.

Vor jeder Erstellung die [verbindlichen Einreichungsregeln](references/instructions.md) lesen. Sie enthalten den bisherigen GPT-Ablauf und die Regeln fuer alle drei Umfragetypen. Die dort genannten Actions sind im Plugin die gleichnamigen MCP-Werkzeuge.

Schreibwerkzeuge brauchen ein verbundenes FutureVote-Konto mit `drafts:write`. Bei einer OAuth-Anforderung die Kontoverknuepfung anbieten; keine Tokens oder Passwoerter im Chat anfordern.

Vor `createDraft` die vollstaendige Vorschau zeigen und ausdrueckliche Zustimmung einholen. Oeffentliche Einreichung bedeutet Community-Review, nicht sofortige Veroeffentlichung. Private Link-Umfragen werden direkt erstellt.

`generateDraftImage` kann API-Kosten verursachen. Bei Konfigurations-, Guthaben- oder Bild-Host-Fehlern stoppen und die Ursache benennen. Keine Wiederholungsschleife. Bei unklarem Ergebnis einer Einreichung nicht blind erneut einreichen.
