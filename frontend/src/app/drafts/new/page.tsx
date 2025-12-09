"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { categories } from "@/app/data/mock";

export default function NewDraftPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(categories[0]?.label ?? "");
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [regionSelect, setRegionSelect] = useState<string>("Global");
  const [customRegion, setCustomRegion] = useState("");
  const [reviewMode, setReviewMode] = useState<"duration" | "endDate">("duration");
  const [timeLeftHours, setTimeLeftHours] = useState<number>(72);
  const [endDateTime, setEndDateTime] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const navigateHome = useCallback(
    (withSuccessFlag: boolean) => {
    setIsLeaving(true);
    setTimeout(() => {
        if (withSuccessFlag) {
          router.push("/?draft=submitted");
        } else {
          router.push("/");
        }
    }, 190);
    },
    [router]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Bitte gib einen Titel fuer deine Frage ein.");
      return;
    }
    if (trimmedTitle.length < 10) {
      setError("Der Titel sollte mindestens 10 Zeichen lang sein, damit die Frage verstaendlich ist.");
      return;
    }
    const finalCategory = (useCustomCategory ? customCategory : category).trim();
    if (!finalCategory) {
      setError("Bitte waehle eine Kategorie oder gib eine eigene ein.");
      return;
    }
    if (useCustomCategory && finalCategory.length < 3) {
      setError("Eigene Kategorien sollten mindestens 3 Zeichen lang sein.");
      return;
    }

    const trimmedDescription = description.trim();
    if (trimmedDescription && trimmedDescription.length < 20) {
      setError("Die Beschreibung ist sehr kurz. Bitte gib mindestens 20 Zeichen ein oder lass das Feld leer.");
      return;
    }

    // Region bestimmen
    let finalRegion: string | undefined;
    if (regionSelect === "__custom_region") {
      const trimmedRegion = customRegion.trim();
      if (trimmedRegion && trimmedRegion.length < 3) {
        setError("Die Regionenbezeichnung ist sehr kurz. Bitte gib mindestens 3 Zeichen ein oder lass das Feld leer.");
        return;
      }
      finalRegion = trimmedRegion || undefined;
    } else {
      finalRegion = regionSelect === "Global" ? "Global" : regionSelect;
    }

    // Review-Dauer bestimmen
    let finalTimeLeftHours: number;
    if (reviewMode === "endDate") {
      const raw = endDateTime.trim();
      if (!raw) {
        setError("Bitte waehle ein Enddatum fuer den Review-Zeitraum.");
        return;
      }
      const end = new Date(raw);
      if (Number.isNaN(end.getTime())) {
        setError("Das gewaehlte Enddatum ist ungueltig.");
        return;
      }
      const now = new Date();
      const diffMs = end.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours < 1) {
        setError("Das Review-Ende muss mindestens eine Stunde in der Zukunft liegen.");
        return;
      }
      // Sicherheitsdeckel: maximal 365 Tage Review
      if (diffHours > 24 * 365) {
        setError("Der Review-Zeitraum darf maximal ein Jahr betragen.");
        return;
      }
      finalTimeLeftHours = Math.round(diffHours);
    } else {
      const safeHours = Number.isFinite(timeLeftHours) ? timeLeftHours : 72;
      if (safeHours < 1) {
        setError("Der Review-Zeitraum in Stunden muss mindestens 1 Stunde betragen.");
        return;
      }
      finalTimeLeftHours = safeHours;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDescription || undefined,
          category: finalCategory,
          region: finalRegion,
          timeLeftHours: finalTimeLeftHours,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Konnte deine Frage nicht speichern.");
        setSubmitting(false);
        return;
      }
      navigateHome(true);
    } catch {
      setError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={`${isLeaving ? "page-leave" : "page-enter"} min-h-screen bg-transparent text-slate-50`}>
      <div className="mx-auto max-w-2xl px-4 pb-12 pt-10 lg:px-6">
        <Link
          href="/"
          className="text-sm text-emerald-100 hover:text-emerald-200"
          onClick={(event) => {
            event.preventDefault();
            navigateHome(false);
          }}
        >
          &larr; Zurueck zum Feed
        </Link>

        <section className="mt-4 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/10 backdrop-blur">
          <h1 className="text-2xl font-bold text-white">Frage vorschlagen</h1>
          <p className="mt-1 text-sm text-slate-300">
            Reiche eine neue Prognosefrage ein. Sie erscheint im Draft-Review-Bereich, wo die Community die Qualitaet
            einschaetzen kann.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium text-slate-100">
                Titel der Frage
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                placeholder="Wird X bis Ende 2026 passieren?"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium text-slate-100">
                Beschreibung (optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                placeholder="Erklaere kurz, worum es bei der Prognose geht. Dieser Text erscheint spaeter nur in der Detailansicht."
              />
              <p className="text-xs text-slate-400">
                Dieser Text dient dazu, das Thema genauer zu erklaeren. Er wird nicht in der Kachel im Feed angezeigt,
                sondern in der Detailansicht der Frage.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="category" className="text-sm font-medium text-slate-100">
                Kategorie
              </label>
              <select
                id="category"
                value={useCustomCategory ? "__custom" : category}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "__custom") {
                    setUseCustomCategory(true);
                    setCategory(categories[0]?.label ?? "");
                  } else {
                    setUseCustomCategory(false);
                    setCategory(value);
                  }
                }}
                className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
              >
                {categories.map((cat) => (
                  <option key={cat.label} value={cat.label}>
                    {cat.label}
                  </option>
                ))}
                <option value="__custom">Eigene Kategorie eingeben …</option>
              </select>
              {useCustomCategory && (
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                  placeholder="z. B. Gesundheit, Bildung, Energie …"
                />
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="region" className="text-sm font-medium text-slate-100">
                Region (optional)
              </label>
              <select
                id="region"
                value={regionSelect}
                onChange={(e) => setRegionSelect(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
              >
                <option value="Global">Alle / Global</option>
                <option value="Deutschland">Deutschland</option>
                <option value="Europa">Europa</option>
                <option value="DACH">DACH (Deutschland, Oesterreich, Schweiz)</option>
                <option value="__custom_region">Stadt oder Region frei eingeben</option>
              </select>
              {regionSelect === "__custom_region" && (
                <input
                  type="text"
                  value={customRegion}
                  onChange={(e) => setCustomRegion(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                  placeholder="z. B. Berlin, NRW, Bodensee-Region"
                />
              )}
              <p className="text-xs text-slate-400">
                Du kannst hier waehlen, fuer welche Region deine Prognose gedacht ist. Wenn du nichts aenderst, gilt die
                Frage global. Mit der letzten Option kannst du Stadt oder Region frei eingeben.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-100">
                Review-Zeitraum
              </label>
              <div className="inline-flex rounded-full bg-white/5 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setReviewMode("duration")}
                  className={`rounded-full px-3 py-1 transition ${
                    reviewMode === "duration"
                      ? "bg-emerald-500/40 text-white"
                      : "text-slate-200 hover:bg-white/10"
                  }`}
                >
                  Dauer (Stunden)
                </button>
                <button
                  type="button"
                  onClick={() => setReviewMode("endDate")}
                  className={`rounded-full px-3 py-1 transition ${
                    reviewMode === "endDate"
                      ? "bg-emerald-500/40 text-white"
                      : "text-slate-200 hover:bg-white/10"
                  }`}
                >
                  Endet am Datum
                </button>
              </div>

              {reviewMode === "duration" ? (
                <>
                  <input
                    id="timeLeft"
                    type="number"
                    min={1}
                    max={24 * 365}
                    value={timeLeftHours}
                    onChange={(e) => setTimeLeftHours(Number(e.target.value) || 72)}
                    className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                  />
                  <p className="text-xs text-slate-400">
                    Wie lange die Community Zeit hat, die Qualitaet deiner Frage zu bewerten (Standard: 72 Stunden).
                  </p>
                </>
              ) : (
                <>
                  <input
                    id="endDateTime"
                    type="datetime-local"
                    value={endDateTime}
                    onChange={(e) => setEndDateTime(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                  />
                  <p className="text-xs text-slate-400">
                    Waehle genau, bis wann die Community deine Frage reviewen kann. Intern wird daraus eine Dauer in
                    Stunden berechnet.
                  </p>
                </>
              )}
            </div>

            {error && <p className="text-sm text-rose-300">{error}</p>}

            <div className="mt-4 flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-80"
              >
                Frage einreichen
              </button>
              <button
                type="button"
                onClick={() => navigateHome(false)}
                className="rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60"
              >
                Abbrechen
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
