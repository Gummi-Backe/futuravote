const OPENAPI_YAML = `openapi: 3.1.0
info:
  title: FutureVote GPT API (Write - Drafts)
  version: 0.1.0
  description: |
    Write-Endpunkt fuer Custom GPT (Actions) um Drafts/Private Umfragen anzulegen.
    Authentifizierung erfolgt via OAuth Account-Linking.
servers:
  - url: https://gpt-write.future-vote.de
paths:
  /api/drafts:
    post:
      operationId: createDraft
      summary: Draft oder private Umfrage erstellen
      security:
        - oauth2: [drafts:write]
      description: |
        Erstellt:
        - bei visibility=public einen Draft (landet im Review),
        - bei visibility=link_only direkt eine private Frage (per Link abstimmbar).
      requestBody:
        required: true
        content:
          application/json:
            schema:
              oneOf:
                - $ref: "#/components/schemas/CreateDraftPublicResolvable"
                - $ref: "#/components/schemas/CreateDraft"
      responses:
        "201":
          description: Draft oder Question erstellt
          content:
            application/json:
              schema:
                type: object
                properties:
                  kind:
                    type: string
                    description: "draft|question"
                  id:
                    type: string
                    description: "ID des erstellten Drafts oder der Question"
                  shareId:
                    type: string
                    nullable: true
                    description: "Nur bei link_only: Share-ID fuer /p/:shareId"
                  shareUrl:
                    type: string
                    nullable: true
                    description: "Nur bei link_only: Abstimmungslink (/p/:shareId)"
                  message:
                    type: string
                    nullable: true
                additionalProperties: true
        "400":
          description: Validierungsfehler
        "401":
          description: Nicht eingeloggt / OAuth fehlt
        "503":
          description: OAuth/DB nicht vorbereitet

components:
  schemas:
    CreateDraft:
      type: object
      properties:
        title: { type: string }
        description: { type: string, nullable: true }
        category: { type: string }
        region: { type: string, nullable: true }
        imageUrl:
          type: string
          nullable: true
          description: "Optional. Fuer GPT-OAuth wird ein Standardbild genutzt, wenn leer; externe URLs werden ggf. ignoriert."
        imageCredit:
          type: string
          nullable: true
          description: "Optional. Wird fuer Standardbild automatisch gesetzt (falls konfiguriert)."
        timeLeftHours: { type: number, nullable: true, description: "Standard: 72" }
        closesAt: { type: string, nullable: true, description: "Optionales Enddatum (ISO). Empfohlen fuer oeffentliche Prognosen." }
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
        resolutionCriteria:
          type: string
          nullable: true
          description: "Required wenn visibility=public und isResolvable=true."
        resolutionSource:
          type: string
          nullable: true
          description: "Required wenn visibility=public und isResolvable=true."
        resolutionDeadline:
          type: string
          nullable: true
          description: "Required wenn visibility=public und isResolvable=true (ISO Datum/Uhrzeit). Server setzt sonst automatisch closesAt+31 Tage."
      required: [title, category]
    CreateDraftPublicResolvable:
      allOf:
        - $ref: "#/components/schemas/CreateDraft"
        - type: object
          properties:
            visibility: { type: string, enum: [public] }
            isResolvable: { type: boolean, enum: [true] }
          required: [visibility, isResolvable, resolutionCriteria, resolutionSource, resolutionDeadline]
  securitySchemes:
    oauth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://gpt-write.future-vote.de/api/oauth/authorize
          tokenUrl: https://gpt-write.future-vote.de/api/oauth/token
          scopes:
            "drafts:write": Drafts erstellen
`;

export function GET() {
  return new Response(OPENAPI_YAML, {
    headers: {
      "Content-Type": "text/yaml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
