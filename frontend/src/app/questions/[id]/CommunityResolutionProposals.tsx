"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Outcome = "yes" | "no";

type ApiState = {
  eligible: boolean;
  ended: boolean;
  resolvedOutcome: "yes" | "no" | null;
  counts: { yes: number; no: number; total: number };
  mine: { outcome: Outcome; sourceUrl: string; note: string | null } | null;
  queueReady: boolean;
  majoritySourcesCount: number;
  canPropose: boolean;
};

function outcomeLabel(v: Outcome) {
  return v === "yes" ? "Ja" : "Nein";
}

function outcomePillClass(v: Outcome) {
  return v === "yes" ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-50" : "border-rose-300/40 bg-rose-500/10 text-rose-50";
}

export function CommunityResolutionProposals({
  questionId,
  isLoggedIn,
  canPost,
}: {
  questionId: string;
  isLoggedIn: boolean;
  canPost: boolean;
}) {
  const [state, setState] = useState<ApiState | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [outcome, setOutcome] = useState<Outcome>("yes");
  const [sourceUrl, setSourceUrl] = useState("");
  const [note, setNote] = useState("");

  const fetchState = useCallback(async () => {
    if (!questionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/questions/${encodeURIComponent(questionId)}/resolution-proposals`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error ?? "Auflösungs-Vorschläge konnten nicht geladen werden.");
      const next: ApiState = {
        eligible: Boolean(json?.eligible),
        ended: Boolean(json?.ended),
        resolvedOutcome: json?.resolvedOutcome === "yes" || json?.resolvedOutcome === "no" ? json.resolvedOutcome : null,
        counts: {
          yes: Number(json?.counts?.yes ?? 0) || 0,
          no: Number(json?.counts?.no ?? 0) || 0,
          total: Number(json?.counts?.total ?? 0) || 0,
        },
        mine: json?.mine
          ? {
              outcome: json.mine.outcome === "no" ? "no" : "yes",
              sourceUrl: String(json.mine.sourceUrl ?? ""),
              note: typeof json.mine.note === "string" ? json.mine.note : null,
            }
          : null,
        queueReady: Boolean(json?.queueReady),
        majoritySourcesCount: Number(json?.majoritySourcesCount ?? 0) || 0,
        canPropose: Boolean(json?.canPropose),
      };
      setState(next);
      if (next.mine) {
        setOutcome(next.mine.outcome);
        setSourceUrl(next.mine.sourceUrl || "");
        setNote(next.mine.note || "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auflösungs-Vorschläge konnten nicht geladen werden.");
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  const info = useMemo(() => {
    if (!state) return null;
    if (!state.ended) return "Diese Frage läuft noch. Vorschläge sind erst nach Ende möglich.";
    if (state.resolvedOutcome) return null;
    if (!isLoggedIn) return "Login ist erforderlich, um einen Auflösungs-Vorschlag abzugeben.";
    if (!canPost) return "Bitte bestätige zuerst deine E-Mail, um Vorschläge abzugeben.";
    return null;
  }, [canPost, isLoggedIn, state]);

  const majority = useMemo<Outcome | null>(() => {
    if (!state) return null;
    if (state.counts.yes === state.counts.no) return null;
    return state.counts.yes > state.counts.no ? "yes" : "no";
  }, [state]);

  const progressHint = useMemo(() => {
    if (!state || !state.eligible) return null;
    const { yes, no, total } = state.counts;
    if (total === 0) return "Noch keine Vorschläge. Hilf mit: Ergebnis + Quelle einreichen.";
    if (!majority) return "Aktuell uneinig. Weitere Vorschläge mit Quellen helfen.";
    if (state.queueReady) return "Genug Vorschläge vorhanden – der Admin bekommt einen Eintrag zur Prüfung.";
    if (total < 3) return `Noch ${Math.max(0, 3 - total)} weiterer Vorschlag – dann kann es in die Admin-Queue kommen.`;
    const majorityCount = majority === "yes" ? yes : no;
    if (majorityCount >= 3) return "Genug Vorschläge vorhanden – der Admin bekommt einen Eintrag zur Prüfung.";
    const missingSources = Math.max(0, 2 - state.majoritySourcesCount);
    if (missingSources > 0) {
      return `Noch ${missingSources} weitere Quelle(n) für ${outcomeLabel(majority)} – oder mehr Übereinstimmung – dann erscheint es beim Admin.`;
    }
    return "Weitere Übereinstimmung/Quellen helfen, damit es beim Admin landet.";
  }, [majority, state]);

  const submit = useCallback(async () => {
    if (!questionId || submitting) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/questions/${encodeURIComponent(questionId)}/resolution-proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome,
          sourceUrl: sourceUrl.trim(),
          note: note.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error ?? "Vorschlag konnte nicht gespeichert werden.");

      setSuccess(json?.createdSuggestion ? "Gespeichert. Damit ist jetzt ein Community-Vorschlag beim Admin gelandet." : "Gespeichert. Danke!");
      await fetchState();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vorschlag konnte nicht gespeichert werden.");
    } finally {
      setSubmitting(false);
    }
  }, [fetchState, note, outcome, questionId, sourceUrl, submitting]);

  if (!state) return null;
  if (state.resolvedOutcome) return null;

  const showForm = state.eligible && isLoggedIn && canPost;

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-white">Community-Vorschlag zur Auflösung</h4>
          <p className="mt-1 text-xs text-slate-300">
            Wenn mehrere Nutzer übereinstimmen und Quellen angeben, landet ein Vorschlag automatisch beim Admin zur Prüfung.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchState()}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-emerald-200/30"
        >
          {loading ? "..." : "Aktualisieren"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full border px-3 py-1 font-semibold ${outcomePillClass("yes")}`}>Ja: {state.counts.yes}</span>
        <span className={`rounded-full border px-3 py-1 font-semibold ${outcomePillClass("no")}`}>Nein: {state.counts.no}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-semibold text-slate-100">
          Insgesamt: {state.counts.total}
        </span>
      </div>

      {progressHint ? <p className="mt-2 text-xs text-slate-300">{progressHint}</p> : null}
      {info ? <p className="mt-2 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-50">{info}</p> : null}
      {error ? <p className="mt-2 text-xs text-rose-200">{error}</p> : null}
      {success ? <p className="mt-2 text-xs text-emerald-200">{success}</p> : null}

      {showForm ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="flex flex-wrap gap-2">
              {(["yes", "no"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setOutcome(v)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition hover:-translate-y-0.5 ${
                    outcome === v ? (v === "yes" ? "border-emerald-300/60 bg-emerald-500/20 text-white" : "border-rose-300/60 bg-rose-500/20 text-white") : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/30"
                  }`}
                >
                  {outcomeLabel(v)}
                </button>
              ))}
            </div>

            <label className="mt-3 block text-xs font-semibold text-slate-200">
              Quelle (Link)
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/50"
                placeholder="https://..."
                inputMode="url"
              />
            </label>
            <p className="mt-1 text-[11px] text-slate-400">
              Bitte möglichst eine offizielle Quelle oder einen seriösen Artikel verlinken.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200">
              Hinweis (optional)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                className="mt-1 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/50"
                placeholder="Kurzer Kontext (optional)"
              />
            </label>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
              <span>{sourceUrl.trim() ? " " : "Quelle ist Pflicht."}</span>
              <span>{Math.min(500, note.length)}/500</span>
            </div>
            <button
              type="button"
              disabled={submitting || !sourceUrl.trim()}
              onClick={() => void submit()}
              className="mt-3 w-full rounded-2xl border border-emerald-300/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-50 shadow-lg shadow-emerald-500/10 transition hover:-translate-y-0.5 hover:border-emerald-300/60 disabled:opacity-60"
            >
              {submitting ? "Sende..." : state.mine ? "Vorschlag aktualisieren" : "Vorschlag senden"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
