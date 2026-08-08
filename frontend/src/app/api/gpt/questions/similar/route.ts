import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { buildQuestionUrl } from "@/app/lib/publicUrls";
import { guardGptRateLimit, withCacheHeaders } from "../../_lib";

export const revalidate = 0;

type MatchRow = {
  id: string;
  title: string;
  description: string | null;
  closes_at: string;
  status: string | null;
};

const MAX_RESULT_LIMIT = 50;
const DEFAULT_RESULT_LIMIT = 25;
const MAX_CANDIDATE_ROWS = 400;

function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9äöüß ]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "einen",
  "einem",
  "einer",
  "und",
  "oder",
  "mit",
  "ohne",
  "in",
  "im",
  "am",
  "an",
  "auf",
  "zu",
  "zum",
  "zur",
  "bis",
  "ab",
  "von",
  "für",
  "fuer",
  "fur",
  "sie",
  "du",
  "ihr",
  "wir",
  "euch",
  "wird",
  "werden",
  "wurde",
  "wurden",
  "ist",
  "sind",
  "sein",
  "hat",
  "haben",
  "kommt",
  "kommen",
  "noch",
  "mindestens",
  "maximal",
  "unter",
  "über",
  "ueber",
  "frage",
  "umfrage",
  "prognose",
  "prognosen",
  "meinung",
  "meinungsumfrage",
  "deutschland",
  "eu",
  "politik",
  "wirtschaft",
  "gesellschaft",
  "klima",
  "sport",
  "welt",
  "heute",
  "morgen",
  "jahr",
  "monat",
  "prozent",
  "mehr",
  "weniger",
  "kann",
  "soll",
  "will",
  "2025",
  "2026",
  "2027",
]);

function tokens(input: string): string[] {
  const norm = normalizeText(input);
  return norm
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union > 0 ? inter / union : 0;
}

function overlapKeywords(a: string[], b: string[]): string[] {
  const sa = new Set(a);
  const sb = new Set(b);
  const overlap: string[] = [];
  for (const t of sa) {
    if (sb.has(t)) overlap.push(t);
  }
  overlap.sort((x, y) => y.length - x.length);
  return overlap;
}

function trigrams(input: string): Map<string, number> {
  const norm = normalizeText(input);
  if (!norm) return new Map();
  const padded = `  ${norm}  `;
  const map = new Map<string, number>();
  for (let i = 0; i < padded.length - 2; i += 1) {
    const tri = padded.slice(i, i + 3);
    map.set(tri, (map.get(tri) ?? 0) + 1);
  }
  return map;
}

function diceCoefficient(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;

  let inter = 0;
  let totalA = 0;
  let totalB = 0;

  for (const v of ta.values()) totalA += v;
  for (const v of tb.values()) totalB += v;

  for (const [tri, countA] of ta.entries()) {
    const countB = tb.get(tri) ?? 0;
    inter += Math.min(countA, countB);
  }

  const denom = totalA + totalB;
  return denom > 0 ? (2 * inter) / denom : 0;
}

export async function GET(request: Request) {
  const limited = guardGptRateLimit(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const description = (searchParams.get("d") ?? "").trim().slice(0, 1200);
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || DEFAULT_RESULT_LIMIT, 1),
    MAX_RESULT_LIMIT
  );

  if (q.length < 8) {
    return withCacheHeaders(NextResponse.json({ ok: true, matches: [] }), 8);
  }

  const combinedQuery = `${q} ${description}`.trim();
  const qTokens = tokens(combinedQuery).slice(0, 28);
  if (qTokens.length === 0) {
    return withCacheHeaders(NextResponse.json({ ok: true, matches: [] }), 8);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("questions")
    .select("id,title,description,closes_at,status")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(MAX_CANDIDATE_ROWS);

  if (error) {
    return withCacheHeaders(NextResponse.json({ ok: false, error: error.message }), 3);
  }

  const rows = (data ?? []) as MatchRow[];
  const matches = rows
    .map((row) => {
      const rowTitleTokens = tokens(row.title);
      const rowCombinedTokens = tokens(`${row.title} ${row.description ?? ""}`).slice(0, 32);
      const overlap = overlapKeywords(qTokens, rowCombinedTokens);
      const overlapCount = overlap.length;
      const tokenScore = jaccard(qTokens, rowCombinedTokens);
      const diceScore = diceCoefficient(q, row.title);
      const score = Math.min(1, tokenScore * 0.72 + diceScore * 0.28 + Math.min(overlapCount, 6) * 0.04);

      let severity: "high" | "medium" | "low" | null = null;
      const titleTokenScore = jaccard(qTokens, rowTitleTokens);
      if (overlapCount >= 3 && (titleTokenScore >= 0.42 || tokenScore >= 0.46)) {
        severity = "high";
      } else if (
        overlapCount >= 2 &&
        (titleTokenScore >= 0.30 || tokenScore >= 0.34 || (diceScore >= 0.62 && overlapCount >= 3))
      ) {
        severity = "medium";
      } else if (overlapCount >= 2 && tokenScore >= 0.24 && diceScore >= 0.48) {
        severity = "low";
      }

      return { row, score, severity, overlap };
    })
    .filter((x): x is typeof x & { severity: "high" | "medium" | "low" } => x.severity !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row, score, severity, overlap }) => ({
      id: row.id,
      url: buildQuestionUrl(row.id),
      title: row.title,
      closesAt: row.closes_at,
      ended: String(row.closes_at) < todayIso,
      status: row.status ?? null,
      score: Math.round(score * 100),
      severity,
      matchedKeywords: overlap.slice(0, 4),
    }));

  return withCacheHeaders(
    NextResponse.json({ ok: true, matches, scannedCandidates: rows.length, returned: matches.length }),
    8
  );
}
