const OPENAPI_YAML = `openapi: 3.1.0
info:
  title: FutureVote GPT API (Write - Drafts)
  version: 0.1.0
  description: |
    Write-Endpunkt für Custom GPT (Actions) um Drafts/Private Umfragen anzulegen.
    Authentifizierung erfolgt später via OAuth Account-Linking.
servers:
  - url: https://www.future-vote.de
paths:
  /api/drafts:
    post:
      operationId: createDraft
      summary: Draft oder private Umfrage erstellen
      description: |
        Erstellt:
        - bei visibility=public einen Draft (landet im Review),
        - bei visibility=link_only direkt eine private Frage (per Link abstimmbar).
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                title: { type: string }
                description: { type: string, nullable: true }
                category: { type: string }
                region: { type: string, nullable: true }
                imageUrl: { type: string, nullable: true }
                imageCredit: { type: string, nullable: true }
                timeLeftHours: { type: number, nullable: true, description: "Standard: 72" }
                closesAt: { type: string, nullable: true, description: "Optionales Enddatum (ISO)" }
                visibility:
                  type: string
                  enum: [public, link_only]
                answerMode:
                  type: string
                  enum: [binary, options]
                isResolvable: { type: boolean, nullable: true, description: "true=Prognose, false=Meinungs-Umfrage" }
                options:
                  type: array
                  nullable: true
                  items: { type: string }
                resolutionCriteria: { type: string, nullable: true }
                resolutionSource: { type: string, nullable: true }
                resolutionDeadline: { type: string, nullable: true, description: "ISO Datum/Uhrzeit" }
              required: [title, category]
      responses:
        "201":
          description: Draft oder Question erstellt
          content:
            application/json:
              schema:
                type: object
        "400":
          description: Validierungsfehler
        "401":
          description: Nicht eingeloggt / OAuth fehlt
        "503":
          description: OAuth/DB nicht vorbereitet
`;

export function GET() {
  return new Response(OPENAPI_YAML, {
    headers: {
      "Content-Type": "text/yaml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}

