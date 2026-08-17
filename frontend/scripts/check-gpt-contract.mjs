import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(frontendRoot);

function readFromFrontend(path) {
  return readFileSync(join(frontendRoot, path), "utf8");
}

function readFromRepository(path) {
  return readFileSync(join(repositoryRoot, path), "utf8");
}

function requireText(name, content, expected) {
  if (!content.includes(expected)) {
    throw new Error(`${name}: Erwarteter Vertragstext fehlt: ${expected}`);
  }
}

function forbidText(name, content, forbidden) {
  if (content.includes(forbidden)) {
    throw new Error(`${name}: Veralteter Vertragstext gefunden: ${forbidden}`);
  }
}

function requireActionDescriptionWithinLimit(content, operationId, limit) {
  const pattern = new RegExp(
    `operationId: ${operationId}[\\s\\S]*?description: \\|\\r?\\n([\\s\\S]*?)\\r?\\n      requestBody:`,
  );
  const match = content.match(pattern);
  if (!match) {
    throw new Error(`write schema: Beschreibung fuer ${operationId} nicht gefunden`);
  }

  const description = match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .join(" ");
  if (description.length > limit) {
    throw new Error(
      `write schema: Beschreibung fuer ${operationId} hat ${description.length} statt maximal ${limit} Zeichen`,
    );
  }
}

const questionsRoute = readFromFrontend("src/app/api/gpt/questions/route.ts");
const similarRoute = readFromFrontend("src/app/api/gpt/questions/similar/route.ts");
const draftsRoute = readFromFrontend("src/app/api/drafts/route.ts");
const publicUrls = readFromFrontend("src/app/lib/publicUrls.ts");
const writeSchema = readFromFrontend("src/app/api/gpt/openapi/write/route.ts");
const writeAlias = readFromFrontend("src/app/futuravote-gpt-write-openapi.yaml/route.ts");
const readSchema = readFromFrontend("public/futuravote-gpt-openapi.yaml");
const instructions = readFromRepository("FUTUREVOTE_GPT_INSTRUCTIONS.md");

requireText("questions route", questionsRoute, "url: buildQuestionUrl(String(row.id))");
requireText("similar route", similarRoute, "url: buildQuestionUrl(row.id)");
requireText("draft response", draftsRoute, 'submissionType: "public_review"');
requireText("private response", draftsRoute, 'submissionType: "private_link"');
requireText("public review URL", draftsRoute, "reviewUrl");
requireText("public review URL", publicUrls, "/review/drafts/");
requireText("private share URL", draftsRoute, "shareUrl");
requireText("explicit approval", draftsRoute, "if (isOauthGpt && !confirmSubmit)");
requireText("reachable GPT image", draftsRoute, '"image_unavailable_for_gpt"');
requireText("GPT image host diagnostics", draftsRoute, "receivedHost");
requireText("private end date", draftsRoute, '"closes_at_required_for_link_only"');

requireText("write schema", writeSchema, "version: 0.2.0");
requireText("write schema", writeSchema, "required: [title, description, confirmSubmit, category, imageUrl, imageCredit, visibility, answerMode, isResolvable]");
requireText("write schema", writeSchema, "required: [kind, submissionType, id, url, message]");
requireText("write schema", writeSchema, "nie aus id oder Action-Domain ableiten");
requireActionDescriptionWithinLimit(writeSchema, "createDraft", 300);
forbidText("write schema", writeSchema, "timeLeftHours");
forbidText("write schema", writeSchema, "nullable: true");

requireText("write schema alias", writeAlias, "getWriteOpenApi");
requireText("read schema", readSchema, "required: [id, url, title]");
requireText("read schema", readSchema, "nie aus id oder Action-Domain ableiten");
forbidText("read schema", readSchema, "operationId: listSimilarQuestions");
requireText("write schema", writeSchema, "operationId: listSimilarQuestions");

requireText("GPT instructions", instructions, "## Absolute Link-Regel");
requireText("GPT instructions", instructions, "## Typ 1: Oeffentliche Prognose");
requireText("GPT instructions", instructions, "## Typ 2: Oeffentliche Meinungs-Umfrage");
requireText("GPT instructions", instructions, "## Typ 3: Private Link-Umfrage");
requireText("GPT instructions", instructions, "Niemals `null`");
requireText("GPT instructions", instructions, "confirmSubmit: true");
requireText("GPT instructions", instructions, "Verwende niemals die eingebaute ChatGPT-Bildgenerierung");
requireText("GPT instructions", instructions, "invalid_image_host_for_gpt");
requireText("GPT instructions", instructions, "niemals wiederholt um Zustimmung bitten");

console.log("FutureVote GPT contract: OK");
