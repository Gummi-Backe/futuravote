export type PollVisibility = "public" | "link_only";

export type AnswerMode = "binary" | "options";

export type PollOption = {
  id: string;
  label: string;
  votesCount: number;
  pct?: number;
};

export type Question = {
  id: string;
  creatorId?: string;
  title: string;
  summary: string;
  description?: string;
  /**
   * Optionale Region, z. B. "Global", "Deutschland", "Europa", "Stadt/Region".
   */
  region?: string;
  /**
   * Optionale Bild-URL fuer ein kleines Vorschaubild.
   */
  imageUrl?: string;
  /**
   * Optionale Quellenangabe / Urheberhinweis fuer das Bild.
   */
  imageCredit?: string;
  category: string;
  categoryIcon: string;
  categoryColor: string;
  closesAt: string;
  yesPct: number;
  noPct: number;
  yesVotes?: number;
  noVotes?: number;
  status?: "closingSoon" | "new" | "trending" | "top" | "archived";
  views?: number;
  userChoice?: "yes" | "no";
  userOptionId?: string;
  createdAt?: string;
  rankingScore?: number;
  visibility?: PollVisibility;
  shareId?: string;
  answerMode?: AnswerMode;
  isResolvable?: boolean;
  options?: PollOption[];
  resolvedOptionId?: string;

  // Aufloesung (Seriositaet-MVP)
  resolutionCriteria?: string;
  resolutionSource?: string;
  resolutionDeadline?: string;
  resolvedOutcome?: "yes" | "no";
  resolvedAt?: string;
  resolvedSource?: string;
  resolvedNote?: string;
};

export type Draft = {
  id: string;
  /**
   * Optionaler Ersteller des Drafts (Supabase-User).
   */
  creatorId?: string;
  title: string;
  description?: string;
  /**
   * Optionale Region, z. B. "Global", "Deutschland", "Stadt/Region".
   */
  region?: string;
  /**
   * Optionale Bild-URL fuer das Draft-Vorschaubild.
   */
  imageUrl?: string;
  /**
   * Optionale Quellenangabe / Urheberhinweis fuer das Bild.
   */
  imageCredit?: string;
  category: string;
  votesFor: number;
  votesAgainst: number;
  timeLeftHours: number;
  status?: "open" | "accepted" | "rejected";
  visibility?: PollVisibility;
  shareId?: string;
  answerMode?: AnswerMode;
  isResolvable?: boolean;
  options?: PollOption[];

  // Aufloesung (wird beim Promote zur Frage uebernommen)
  resolutionCriteria?: string;
  resolutionSource?: string;
  resolutionDeadline?: string;
};

export const categories = [
  { label: "Politik", icon: "🏛️", color: "#f97316" },
  { label: "Wirtschaft", icon: "💶", color: "#22c55e" },
  { label: "Tech", icon: "🤖", color: "#6366f1" },
  { label: "Klima", icon: "🌱", color: "#16a34a" },
  { label: "Gesellschaft", icon: "🧑‍🤝‍🧑", color: "#eab308" },
  { label: "Sport", icon: "⚽", color: "#06b6d4" },
  { label: "Welt", icon: "🌍", color: "#3b82f6" },
];

export const topQuestions: Question[] = [
  {
    id: "q1",
    title: "Wird die EU bis Ende 2026 einen verbindlichen AI-Kodex einfuehren?",
    summary: "Politik · KI-Regulierung",
    description: "Wie wahrscheinlich ist ein verbindlicher AI-Kodex durch EU-Parlament und Rat bis 31.12.2026?",
    category: "Politik",
    categoryIcon: "🏛️",
    categoryColor: "#f97316",
    closesAt: "2026-12-31",
    yesPct: 62,
    noPct: 38,
    status: "closingSoon",
    userChoice: "yes",
  },
  {
    id: "q2",
    title: "Steigt der DAX bis Q3 2025 erneut ueber 20.000 Punkte?",
    summary: "Wirtschaft · Leitindex",
    description: "DAX-Performance bis Ende Q3 2025 im Vergleich zum bisherigen Allzeithoch.",
    category: "Wirtschaft",
    categoryIcon: "💶",
    categoryColor: "#22c55e",
    closesAt: "2025-09-30",
    yesPct: 54,
    noPct: 46,
    status: "top",
  },
  {
    id: "q3",
    title: "Erreicht generative KI bis 2027 30% aller Buerojobs im Tagesbetrieb?",
    summary: "Technologie · Produktivitaet",
    description: "Anteil buerotauglicher Taetigkeiten, die regelmaessig durch generative KI ersetzt/unterstuetzt werden.",
    category: "Tech",
    categoryIcon: "🤖",
    categoryColor: "#6366f1",
    closesAt: "2027-06-30",
    yesPct: 47,
    noPct: 53,
    status: "trending",
  },
  {
    id: "q4",
    title: "Gewinnt Deutschland eine Medaille im 100m Sprint bei Olympia 2028?",
    summary: "Sport · LA",
    description: "Track & Field: Medaillenwahrscheinlichkeit fuer 100m Sprint-Team GER.",
    category: "Sport",
    categoryIcon: "⚽",
    categoryColor: "#06b6d4",
    closesAt: "2028-08-10",
    yesPct: 18,
    noPct: 82,
  },
];

export const newQuestions: Question[] = [
  {
    id: "q5",
    title: "Gibt es bis 2026 eine europaweite CO2-Grenzsteuer auf Lebensmittel?",
    summary: "Politik · Klima",
    description: "CO2-Grenzausgleich speziell fuer importierte Lebensmittel bis 2026.",
    category: "Klima",
    categoryIcon: "🌱",
    categoryColor: "#16a34a",
    closesAt: "2026-02-01",
    yesPct: 41,
    noPct: 59,
    status: "new",
  },
  {
    id: "q6",
    title: "Wird ein europaeisches Startup bis 2027 das groesste LLM der Welt betreiben?",
    summary: "Tech · KI",
    description: "LLM-Parameter/Qualitaet globaler Vergleich, Fuehrung durch EU-Startup bis 2027.",
    category: "Tech",
    categoryIcon: "🤖",
    categoryColor: "#6366f1",
    closesAt: "2027-09-01",
    yesPct: 35,
    noPct: 65,
    status: "trending",
  },
  {
    id: "q7",
    title: "Senkt Deutschland die Stromsteuer fuer Unternehmen bis Ende 2025?",
    summary: "Wirtschaft · Politik",
    description: "Entlastung durch Stromsteuer-Senkung fuer Unternehmen bis 31.12.2025.",
    category: "Wirtschaft",
    categoryIcon: "💶",
    categoryColor: "#22c55e",
    closesAt: "2025-12-31",
    yesPct: 57,
    noPct: 43,
    status: "new",
  },
];

export const draftQueue: Draft[] = [
  {
    id: "d1",
    title: "Erhoeht die WHO den globalen Pandemiestatus fuer Krankheit X bis 2026?",
    description: "Beispielhafte Draft-Beschreibung fuer eine Gesundheitsprognose.",
    category: "Gesundheit",
    votesFor: 42,
    votesAgainst: 18,
    timeLeftHours: 26,
    status: "open",
  },
  {
    id: "d2",
    title: "Wird ein E-Auto-Hersteller 2030 Verbrenner >90% ersetzen?",
    description: "Beispielhafte Draft-Beschreibung fuer eine Tech/Auto-Frage.",
    category: "Tech",
    votesFor: 31,
    votesAgainst: 22,
    timeLeftHours: 12,
    status: "open",
  },
];

export const allQuestions: Question[] = [...topQuestions, ...newQuestions];
