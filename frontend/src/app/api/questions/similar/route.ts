import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const revalidate = 0;

type MatchRow = {
  id: string;
  title: string;
  closes_at: string;
  status: string | null;
  created_at: string | null;
};

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
  "wurdest",
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
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 8) {
    return NextResponse.json({ ok: true, matches: [] });
  }

  const qTokens = tokens(q).slice(0, 10);
  if (qTokens.length === 0) {
    return NextResponse.json({ ok: true, matches: [] });
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const supabase = getSupabaseAdminClient();

  // Kandidaten: letzte ~200 oeffentliche Fragen (inkl. beendete/archivierte), dann Similarity serverseitig berechnen.
  const { data, error } = await supabase
    .from("questions")
    .select("id,title,closes_at,status,created_at")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = ((data as any[]) ?? []) as MatchRow[];
  const scored = rows
    .map((row) => {
      const tokenScore = jaccard(qTokens, tokens(row.title));
      const diceScore = diceCoefficient(q, row.title);
      const score = Math.max(tokenScore, diceScore);
      return { row, score, tokenScore, diceScore };
    })
    // Nicht blockierend, aber lieber etwas sensibler: entweder Token-Aehnlichkeit oder Trigramm-Aehnlichkeit.
    .filter((x) => x.tokenScore >= 0.18 || x.diceScore >= 0.32)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ row, score }) => {
      const ended = String(row.closes_at) < todayIso;
      const status = row.status ?? null;
      return {
        id: row.id,
        title: row.title,
        closesAt: row.closes_at,
        ended,
        status,
        score: Math.round(score * 100),
      };
    });

  return NextResponse.json({ ok: true, matches: scored });
}
