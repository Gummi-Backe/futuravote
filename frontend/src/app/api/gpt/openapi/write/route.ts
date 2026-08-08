const OPENAPI_YAML = `openapi: 3.1.0
info:
  title: FutureVote GPT API (Write - Drafts)
  version: 0.2.0
  description: |
    Write-Endpunkt fuer Custom GPT (Actions) um Drafts/Private Umfragen anzulegen.
    Authentifizierung erfolgt via OAuth Account-Linking.
servers:
  - url: https://gpt-write.future-vote.de
paths:
  /api/gpt/generate-image:
    post:
      operationId: generateDraftImage
      summary: Bild fuer Draft erzeugen und speichern
      security:
        - oauth2: [drafts:write]
      description: |
        Erzeugt ein KI-Bild fuer eine Umfrage, skaliert es quadratisch
        und speichert es im FutureVote-Storage. Ergebnis ist eine imageUrl,
        die direkt in createDraft genutzt werden kann.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                prompt:
                  type: string
                  description: "Bildbeschreibung (mind. 10 Zeichen)."
                size:
                  type: string
                  enum: [1024x1024]
                  description: "Optional. Es ist nur 1024x1024 erlaubt."
              required: [prompt]
      responses:
        "201":
          description: Bild erzeugt und gespeichert
          content:
            application/json:
              schema:
                type: object
                properties:
                  imageUrl:
                    type: string
                    description: "Oeffentliche URL des gespeicherten Bildes."
                  imageCredit:
                    type: string
                    description: "Vorschlag fuer Bildquelle/Credit."
                  width:
                    type: number
                  height:
                    type: number
                  model:
                    type: string
                required: [imageUrl, imageCredit]
        "400":
          description: Validierungsfehler
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "401":
          description: Nicht eingeloggt / OAuth fehlt
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "403":
          description: Scope fehlt
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "500":
          description: Bild konnte nicht gespeichert/verarbeitet werden
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "502":
          description: KI-Bildgenerierung fehlgeschlagen
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "503":
          description: OpenAI nicht konfiguriert
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
  /api/gpt/questions/similar:
    get:
      operationId: listSimilarQuestions
      summary: Aehnliche oeffentliche Fragen finden (Duplikat-/Qualitaetscheck)
      description: |
        Liefert aehnliche oeffentliche Fragen, damit der GPT vor createDraft
        fundiert auf Dubletten pruefen kann. Standardlimit ist hoeher als bei normalen Listen.
      parameters:
        - in: query
          name: q
          required: true
          schema: { type: string }
          description: "Titel-/Kernfrage fuer den Similar-Check (mind. 8 Zeichen)."
        - in: query
          name: d
          schema: { type: string }
          description: "Optionaler Beschreibungstext fuer besseren Kontext."
        - in: query
          name: limit
          schema: { type: integer, default: 25, minimum: 1, maximum: 50 }
          description: "Anzahl Similar-Treffer."
      responses:
        "200":
          description: Similar-Treffer
          content:
            application/json:
              schema:
                type: object
                properties:
                  ok: { type: boolean }
                  matches:
                    type: array
                    items:
                      type: object
                      properties:
                        id: { type: string }
                        url: { type: string, description: "Vollstaendige oeffentliche URL. Exakt verwenden; nie aus id oder Action-Domain ableiten." }
                        title: { type: string }
                        closesAt: { type: string }
                        ended: { type: boolean }
                        status: { type: string }
                        score: { type: integer }
                        severity: { type: string, enum: [high, medium, low] }
                        matchedKeywords:
                          type: array
                          items: { type: string }
                      required: [id, url, title, closesAt, ended, score, severity]
                  scannedCandidates: { type: integer }
                  returned: { type: integer }
        "429":
          description: Rate limit erreicht
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
  /api/drafts:
    post:
      operationId: createDraft
      summary: Draft oder private Umfrage erstellen
      security:
        - oauth2: [drafts:write]
      description: |
        Erstellt einen oeffentlichen Review-Draft oder eine private Link-Umfrage.
        Vorher die vollstaendige Vorschau zeigen und eine eindeutige Freigabe einholen.
        Nur url, reviewUrl oder shareUrl aus der Antwort anzeigen; nie Links aus id oder der Action-Domain bauen.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateDraft"
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
                    enum: [draft, question]
                  submissionType:
                    type: string
                    enum: [public_review, private_link]
                  id:
                    type: string
                    description: "ID des erstellten Drafts oder der Question"
                  url:
                    type: string
                    description: "Verbindliche Nutzer-URL. Exakt und unveraendert anzeigen."
                  reviewUrl:
                    type: string
                    description: "Nur bei public_review: Link zum eigenen Draft."
                  shareId:
                    type: string
                    description: "Nur bei link_only: Share-ID fuer /p/:shareId"
                  shareUrl:
                    type: string
                    description: "Nur bei private_link: verbindlicher Abstimmungslink."
                  message:
                    type: string
                  warnings:
                    type: array
                    items: { type: string }
                required: [kind, submissionType, id, url, message]
        "400":
          description: Validierungsfehler
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "401":
          description: Nicht eingeloggt / OAuth fehlt
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "403":
          description: Scope fehlt oder Zugriff nicht erlaubt
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "503":
          description: OAuth/DB nicht vorbereitet
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"

components:
  schemas:
    CreateDraft:
      type: object
      properties:
        title:
          type: string
          minLength: 12
          maxLength: 220
          description: "Sachliche, eindeutige Frage mit 12-220 Zeichen."
        description:
          type: string
          description: "Pflicht. Oeffentlich exakt 100-200 Woerter (Ziel 120-170); link_only kurz und sachlich."
        longDescription:
          type: string
          description: "Bei public+isResolvable=true Pflicht mit 600-1000 Woertern (Ziel 700-850). Bei Meinungs- und Link-Umfragen normalerweise weglassen."
        allowWithoutLongDescription:
          type: boolean
          description: "Nur bei public+isResolvable=true senden, wenn der Nutzer ausdruecklich keinen Langtext will; sonst weglassen."
        confirmSubmit:
          type: boolean
          description: "Pflicht und nur nach ausdruecklicher Freigabe der unveraenderten Vorschau auf true setzen."
        category:
          type: string
          maxLength: 60
          description: "Pflichtkategorie mit maximal 60 Zeichen."
        region:
          type: string
          maxLength: 80
          description: "Optional nur fuer oeffentliche Umfragen; bei link_only weglassen."
        imageUrl:
          type: string
          format: uri
          description: "Pflicht. Exakt die imageUrl aus generateDraftImage verwenden."
        imageCredit:
          type: string
          maxLength: 140
          description: "Pflicht. Exakt den imageCredit aus generateDraftImage verwenden."
        closesAt:
          type: string
          format: date-time
          description: "Muss in der Zukunft liegen. Bei link_only Pflicht; bei public empfohlen."
        visibility:
          type: string
          enum: [public, link_only]
        answerMode:
          type: string
          enum: [binary, options]
        isResolvable:
          type: boolean
          description: "public Prognose=true; public Meinung=false; link_only immer false."
        options:
          type: array
          minItems: 2
          maxItems: 6
          description: "Nur bei answerMode=options senden: 2-6 eindeutige Optionen. Bei binary vollstaendig weglassen."
          items:
            type: string
            maxLength: 80
        resolutionCriteria:
          type: string
          description: "Nur und zwingend bei public+isResolvable=true. Bei Meinungs- und Link-Umfragen weglassen, nicht null senden."
        resolutionSource:
          type: string
          description: "Nur und zwingend bei public+isResolvable=true: primaere verlaessliche Quelle. Sonst weglassen."
        resolutionSources:
          type: array
          minItems: 1
          maxItems: 8
          items:
            type: string
          description: "Nur bei public+isResolvable=true: 1-8 verlaessliche Quellen. Sonst weglassen, niemals null senden."
        resolutionDeadline:
          type: string
          format: date-time
          description: "Nur und zwingend bei public+isResolvable=true; ISO-Zeitpunkt am oder nach dem Umfrageende. Sonst weglassen."
      required: [title, description, confirmSubmit, category, imageUrl, imageCredit, visibility, answerMode, isResolvable]
    ErrorResponse:
      type: object
      properties:
        error:
          type: string
        errorCode:
          type: string
        details:
          oneOf:
            - type: array
              items:
                type: object
                additionalProperties: true
            - type: object
              additionalProperties: true
      required: [error, errorCode]
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
