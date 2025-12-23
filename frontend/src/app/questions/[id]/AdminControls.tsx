"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  questionId: string;
  isArchived: boolean;
  answerMode: "binary" | "options";
  isResolvable: boolean;
  resolvedOutcome: "yes" | "no" | null;
  resolvedOptionId: string | null;
  options: { id: string; label: string }[];
};

type ResolveSuggestion = {
  suggestedOutcome?: "yes" | "no" | "unknown";
  suggestedOptionId?: string;
  confidence?: number;
  note?: string;
  sources?: string[];
};

export default function AdminControls({
  questionId,
  isArchived,
  answerMode,
  isResolvable,
  resolvedOutcome,
  resolvedOptionId,
  options,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [resolveOutcome, setResolveOutcome] = useState<"yes" | "no" | null>(resolvedOutcome);
  const [resolveOptionId, setResolveOptionId] = useState<string | null>(resolvedOptionId);
  const [resolveSource, setResolveSource] = useState("");
  const [resolveNote, setResolveNote] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSources, setAiSources] = useState<string[]>([]);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);

  const hasResolved = Boolean(resolvedOutcome || resolvedOptionId);

  const handleAction = async (
    action: "archive" | "delete" | "resolve",
    payload?: {
      resolvedOutcome?: "yes" | "no";
      resolvedOptionId?: string;
      resolvedSource?: string;
      resolvedNote?: string;
    }
  ) => {
    setIsSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, action, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Admin-Aktion fehlgeschlagen.");
        return;
      }

      if (action === "archive") {
        setMessage("Frage wurde gestoppt und aus dem Feed entfernt.");
        router.refresh();
      } else if (action === "resolve") {
        setMessage("Ergebnis wurde gespeichert.");
        router.refresh();
      } else {
        setMessage("Frage wurde endgültig gelöscht (inkl. Bild).");
        router.push("/");
      }
    } catch {
      setError("Admin-Aktion fehlgeschlagen (Netzwerkfehler).");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAiSuggest = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiSources([]);
    setAiConfidence(null);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/resolve-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(data?.error ?? "KI-Vorschlag fehlgeschlagen.");
        return;
      }

      const suggestion = data?.suggestion as ResolveSuggestion | undefined;

      const suggestedOutcome = suggestion?.suggestedOutcome;
      const suggestedOptionId = typeof suggestion?.suggestedOptionId === "string" ? suggestion.suggestedOptionId : null;
      const confidence = typeof suggestion?.confidence === "number" ? suggestion.confidence : null;
      const note = typeof suggestion?.note === "string" ? suggestion.note : "";
      const sources = Array.isArray(suggestion?.sources) ? suggestion.sources.filter(Boolean) : [];

      if (answerMode === "binary" && (suggestedOutcome === "yes" || suggestedOutcome === "no")) {
        setResolveOutcome(suggestedOutcome);
        setResolveOptionId(null);
      }
      if (answerMode === "options" && suggestedOptionId) {
        setResolveOptionId(suggestedOptionId);
        setResolveOutcome(null);
      }

      setAiConfidence(confidence);
      setAiSources(sources);

      const combinedNoteParts: string[] = [];
      if (note) combinedNoteParts.push(note.trim());
      if (sources.length > 0) {
        combinedNoteParts.push(`Quellen:\n${sources.map((u) => `- ${u}`).join("\n")}`);
      }
      const combinedNote = combinedNoteParts.join("\n\n").trim();
      if (combinedNote) {
        setResolveNote((prev) => (prev?.trim() ? prev : combinedNote));
      }
      if (sources.length > 0) {
        setResolveSource((prev) => (prev?.trim() ? prev : sources[0]));
      }
    } catch {
      setAiError("KI-Vorschlag fehlgeschlagen (Netzwerkfehler).");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-xs text-slate-100">
      <p className="font-semibold text-amber-100">Admin-Bereich</p>
      <p className="text-[11px] text-amber-100/90">
        Hier kannst du diese Frage stoppen (aus dem Feed nehmen), das Ergebnis eintragen oder im Ausnahmefall endgültig
        löschen. Beim endgültigen Löschen werden auch zugehörige Bilder entfernt.
      </p>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <p className="mb-2 text-[11px] font-semibold text-amber-100">Auflösung / Ergebnis</p>
        {!isResolvable ? (
          <p className="mb-2 text-[11px] text-amber-100/90">
            Diese Frage ist als Meinungs-Umfrage markiert und kann nicht aufgelöst werden.
          </p>
        ) : null}

        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={aiLoading || isSubmitting || !isResolvable}
            onClick={handleAiSuggest}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-emerald-200/40 disabled:opacity-60"
          >
            {aiLoading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/25 border-t-white/80" />
                KI sucht Quellen...
              </>
            ) : (
              <>KI-Vorschlag</>
            )}
          </button>
          {aiConfidence !== null ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-200">
              Confidence: {aiConfidence}%
            </span>
          ) : null}
        </div>
        {aiError ? <p className="mb-2 text-[11px] text-rose-200">{aiError}</p> : null}
        {aiSources.length > 0 ? (
          <div className="mb-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-slate-200">
            <p className="mb-1 font-semibold text-slate-100">Quellen</p>
            <ul className="space-y-1">
              {aiSources.slice(0, 5).map((u) => (
                <li key={u} className="truncate">
                  <a href={u} target="_blank" rel="noreferrer" className="text-emerald-100 hover:text-emerald-200">
                    {u}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {answerMode === "binary" ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isSubmitting || !isResolvable}
              onClick={() => {
                setResolveOutcome("yes");
                setResolveOptionId(null);
              }}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold disabled:opacity-60 ${
                resolveOutcome === "yes"
                  ? "border-emerald-300/70 bg-emerald-500/25 text-emerald-50"
                  : "border-white/15 bg-white/5 text-slate-100 hover:border-emerald-300/40"
              }`}
            >
              Ergebnis: Ja
            </button>
            <button
              type="button"
              disabled={isSubmitting || !isResolvable}
              onClick={() => {
                setResolveOutcome("no");
                setResolveOptionId(null);
              }}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold disabled:opacity-60 ${
                resolveOutcome === "no"
                  ? "border-rose-300/70 bg-rose-500/25 text-rose-50"
                  : "border-white/15 bg-white/5 text-slate-100 hover:border-rose-300/40"
              }`}
            >
              Ergebnis: Nein
            </button>
            <button
              type="button"
              disabled={isSubmitting || !isResolvable}
              onClick={() => {
                setResolveOutcome(null);
                setResolveOptionId(null);
              }}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-white/25 disabled:opacity-60"
            >
              Zurücksetzen
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              {options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isSubmitting || !isResolvable}
                  onClick={() => {
                    setResolveOptionId(opt.id);
                    setResolveOutcome(null);
                  }}
                  className={`rounded-2xl border px-3 py-2 text-left text-[11px] font-semibold disabled:opacity-60 ${
                    resolveOptionId === opt.id
                      ? "border-emerald-300/70 bg-emerald-500/25 text-emerald-50"
                      : "border-white/15 bg-white/5 text-slate-100 hover:border-emerald-300/40"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isSubmitting || !isResolvable}
                onClick={() => {
                  setResolveOutcome(null);
                  setResolveOptionId(null);
                }}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-white/25 disabled:opacity-60"
              >
                Zurücksetzen
              </button>
            </div>
          </div>
        )}

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="block text-[11px] text-slate-200">Quelle (optional)</span>
            <input
              value={resolveSource}
              onChange={(e) => setResolveSource(e.target.value)}
              placeholder="z.B. Link zur offiziellen Quelle"
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] text-slate-200">Notiz (optional)</span>
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="kurze Begründung / Hinweis"
              rows={4}
              className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500"
            />
          </label>
        </div>

        <div className="mt-2">
          <button
            type="button"
            disabled={isSubmitting || !isResolvable || (answerMode === "binary" ? !resolveOutcome : !resolveOptionId)}
            onClick={() =>
              handleAction("resolve", {
                resolvedOutcome: answerMode === "binary" ? resolveOutcome ?? undefined : undefined,
                resolvedOptionId: answerMode === "options" ? resolveOptionId ?? undefined : undefined,
                resolvedSource: resolveSource,
                resolvedNote: resolveNote,
              })
            }
            className="rounded-full border border-amber-300/60 bg-amber-500/25 px-3 py-1 text-[11px] font-semibold text-amber-50 hover:bg-amber-500/35 disabled:opacity-60"
          >
            Ergebnis speichern
          </button>
          {hasResolved ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setResolveOutcome(null);
                setResolveOptionId(null);
                setResolveSource("");
                setResolveNote("");
                handleAction("resolve", { resolvedSource: "", resolvedNote: "" });
              }}
              className="ml-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-white/25 disabled:opacity-60"
            >
              Auflösung entfernen
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {!isArchived && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleAction("archive")}
            className="rounded-full border border-amber-300/70 bg-amber-500/30 px-3 py-1 text-[11px] font-semibold text-amber-50 hover:bg-amber-500/40 disabled:opacity-60"
          >
            Frage stoppen
          </button>
        )}
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleAction("delete")}
          className="rounded-full border border-rose-400/70 bg-rose-500/30 px-3 py-1 text-[11px] font-semibold text-rose-50 hover:bg-rose-500/40 disabled:opacity-60"
        >
          Endgültig löschen
        </button>
      </div>

      {message && <p className="text-[11px] text-emerald-100">{message}</p>}
      {error && <p className="text-[11px] text-rose-200">{error}</p>}
    </div>
  );
}

