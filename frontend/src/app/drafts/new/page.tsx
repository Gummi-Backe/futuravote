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
  const [timeLeftHours, setTimeLeftHours] = useState<number>(72);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const navigateHome = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => {
      router.push("/");
    }, 190);
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Bitte gib einen Titel fuer deine Frage ein.");
      return;
    }
    const finalCategory = (useCustomCategory ? customCategory : category).trim();
    if (!finalCategory) {
      setError("Bitte waehle eine Kategorie oder gib eine eigene ein.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: description.trim() || undefined,
          category: finalCategory,
          timeLeftHours: Number.isFinite(timeLeftHours) ? timeLeftHours : 72,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Konnte deine Frage nicht speichern.");
        setSubmitting(false);
        return;
      }
      navigateHome();
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
            navigateHome();
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
              <label htmlFor="timeLeft" className="text-sm font-medium text-slate-100">
                Review-Zeitraum (Stunden)
              </label>
              <input
                id="timeLeft"
                type="number"
                min={1}
                max={240}
                value={timeLeftHours}
                onChange={(e) => setTimeLeftHours(Number(e.target.value) || 72)}
                className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
              />
              <p className="text-xs text-slate-400">
                Wie lange die Community Zeit hat, die Qualitaet deiner Frage zu bewerten (Standard: 72 Stunden).
              </p>
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
                onClick={navigateHome}
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
