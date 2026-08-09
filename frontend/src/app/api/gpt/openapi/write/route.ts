const OPENAPI_YAML = `openapi: 3.1.0
info:
  title: FutureVote GPT API (Write - Drafts)
  version: 0.2.0
  description: FutureVote-Drafts und private Link-Umfragen per OAuth erstellen.
servers:
  - url: https://gpt-write.future-vote.de
paths:
  /api/gpt/generate-image:
    post:
      operationId: generateDraftImage
      summary: Bild fuer eine Umfrage erzeugen
      description: Einziger erlaubter Bildweg fuer GPT-Einreichungen. Erzeugt, verarbeitet und speichert ein quadratisches KI-Bild dauerhaft bei FutureVote. imageUrl und imageCredit danach exakt und unveraendert fuer createDraft verwenden; niemals eine URL aus der eingebauten ChatGPT-Bildgenerierung verwenden.
      security:
        - oauth2: [drafts:write]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                prompt:
                  type: string
                  description: Sachliche Bildbeschreibung mit mindestens 10 Zeichen.
                size:
                  type: string
                  enum: [1024x1024]
                  description: Optional; nur 1024x1024 ist erlaubt.
              required: [prompt]
      responses:
        "201":
          description: Bild erzeugt und gespeichert
          content:
            application/json:
              schema:
                type: object
                properties:
                  imageUrl: { type: string }
                  imageCredit: { type: string }
                  model: { type: string }
                required: [imageUrl, imageCredit]
        "400": { description: Validierungsfehler }
        "401": { description: OAuth-Anmeldung fehlt }
        "403": { description: Scope fehlt }
        "500": { description: Bildverarbeitung fehlgeschlagen }
        "502": { description: Bildgenerierung fehlgeschlagen }
        "503": { description: Bildgenerierung nicht konfiguriert }
  /api/gpt/questions/similar:
    get:
      operationId: listSimilarQuestions
      summary: Aehnliche oeffentliche Fragen finden
      description: Vor jeder Einreichung mit Titel und Beschreibung auf moegliche Dubletten pruefen.
      parameters:
        - in: query
          name: q
          required: true
          schema: { type: string }
          description: Titel oder Kernfrage; mindestens 8 Zeichen.
        - in: query
          name: d
          schema: { type: string }
          description: Optionale Beschreibung fuer besseren Kontext.
        - in: query
          name: limit
          schema: { type: integer }
          description: Optional; Standard 25, erlaubt 1 bis 50.
      responses:
        "200":
          description: Aehnliche Fragen
          content:
            application/json:
              schema:
                type: object
                properties:
                  matches:
                    type: array
                    items:
                      type: object
                      properties:
                        id: { type: string }
                        url: { type: string, description: "Vollstaendige URL; exakt verwenden und nie aus id oder Action-Domain ableiten." }
                        title: { type: string }
                        score: { type: integer }
                        severity: { type: string, enum: [high, medium, low] }
                      required: [id, url, title, score, severity]
        "429": { description: Rate limit erreicht }
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
          description: Draft oder private Umfrage erstellt
          content:
            application/json:
              schema:
                type: object
                properties:
                  kind: { type: string, enum: [draft, question] }
                  submissionType: { type: string, enum: [public_review, private_link] }
                  id: { type: string }
                  url: { type: string, description: "Verbindliche Nutzer-URL; exakt und unveraendert anzeigen." }
                  reviewUrl: { type: string, description: "Nur bei public_review." }
                  shareUrl: { type: string, description: "Nur bei private_link." }
                  message: { type: string }
                required: [kind, submissionType, id, url, message]
        "400": { description: Validierungsfehler mit errorCode und details }
        "401": { description: OAuth-Anmeldung fehlt }
        "403": { description: Scope oder Zugriff fehlt }
        "503": { description: Dienst nicht vorbereitet }
components:
  schemas:
    CreateDraft:
      type: object
      properties:
        title:
          type: string
          description: Sachliche Frage mit 12 bis 220 Zeichen.
        description:
          type: string
          description: Pflicht; oeffentlich 100 bis 200 Woerter, link_only kurz und sachlich.
        longDescription:
          type: string
          description: Bei oeffentlicher Prognose 600 bis 1000 Woerter; sonst normalerweise weglassen.
        allowWithoutLongDescription:
          type: boolean
          description: Nur bei oeffentlicher Prognose und ausdruecklichem Verzicht auf den Langtext senden.
        confirmSubmit:
          type: boolean
          description: Erst nach Freigabe der unveraenderten Vorschau true senden.
        category:
          type: string
          description: Pflicht; maximal 60 Zeichen.
        region:
          type: string
          description: Optional nur oeffentlich; bei link_only weglassen; maximal 80 Zeichen.
        imageUrl:
          type: string
          description: Pflicht; exakt und unveraendert aus der neuesten generateDraftImage-Antwort uebernehmen. Andere Bild-Hosts sind unzulaessig.
        imageCredit:
          type: string
          description: Pflicht; exakt aus generateDraftImage uebernehmen; maximal 140 Zeichen.
        closesAt:
          type: string
          description: ISO-8601 in der Zukunft; bei link_only Pflicht.
        visibility:
          type: string
          enum: [public, link_only]
        answerMode:
          type: string
          enum: [binary, options]
        isResolvable:
          type: boolean
          description: Oeffentliche Prognose true; oeffentliche Meinung und link_only false.
        options:
          type: array
          items: { type: string }
          description: Nur bei options senden; 2 bis 6 eindeutige Optionen mit je maximal 80 Zeichen.
        resolutionCriteria:
          type: string
          description: Nur und zwingend bei oeffentlicher Prognose; sonst weglassen.
        resolutionSource:
          type: string
          description: Nur und zwingend bei oeffentlicher Prognose; sonst weglassen.
        resolutionSources:
          type: array
          items: { type: string }
          description: Nur bei oeffentlicher Prognose; 1 bis 8 verlaessliche Quellen; sonst weglassen.
        resolutionDeadline:
          type: string
          description: Nur bei oeffentlicher Prognose; ISO-8601 am oder nach dem Umfrageende.
      required: [title, description, confirmSubmit, category, imageUrl, imageCredit, visibility, answerMode, isResolvable]
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
