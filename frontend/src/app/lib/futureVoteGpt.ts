import type { AnswerMode } from "@/app/data/mock";

const FUTURE_VOTE_GPT_URL =
  "https://chatgpt.com/g/g-694d4c8661908191995d2be9f845ff38-futurevote";

function clamp(value: string, maxLen: number): string {
  const clean = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return "";
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

export function buildFutureVoteGptDiscussUrl(input: {
  title: string;
  category?: string | null;
  region?: string | null;
  description?: string | null;
  answerMode?: AnswerMode | null;
  isResolvable?: boolean | null;
  sourceUrl?: string | null;
}): string {
  return buildFutureVoteGptDiscussPayload(input).url;
}

export function buildFutureVoteGptDiscussPayload(input: {
  title: string;
  category?: string | null;
  region?: string | null;
  description?: string | null;
  answerMode?: AnswerMode | null;
  isResolvable?: boolean | null;
  sourceUrl?: string | null;
}): { url: string; prompt: string } {
  const title = clamp(input.title, 180);
  const category = clamp(input.category ?? "", 60);
  const region = clamp(input.region ?? "", 60);
  const description = clamp(input.description ?? "", 700);
  const answerMode = input.answerMode === "options" ? "Optionen" : "Ja/Nein";
  const typeLabel =
    input.isResolvable === false ? "Meinungs-Umfrage" : "Prognose";

  const promptParts: string[] = [
    "Wir sprechen über eine konkrete FutureVote-Frage.",
    `Typ: ${typeLabel}`,
    `Titel: ${title}`,
    category ? `Kategorie: ${category}` : "",
    region ? `Region: ${region}` : "",
    `Antwortmodus: ${answerMode}`,
    description ? `Kurzbeschreibung: ${description}` : "",
    input.sourceUrl ? `Link zur Frage: ${input.sourceUrl}` : "",
    "",
    "Bitte starte sofort mit einer neutralen Einordnung dieser Frage:",
    "1) kurze Zusammenfassung (max. 5 Sätze),",
    "2) 3 gute Diskussionsfragen,",
    "3) je 1 sachlicher Pro- und Contra-Aspekt.",
    "Antworte auf Deutsch.",
  ].filter(Boolean);

  const prompt = promptParts.join("\n");
  const url = new URL(FUTURE_VOTE_GPT_URL);
  url.searchParams.set("q", prompt);
  return { url: url.toString(), prompt };
}
