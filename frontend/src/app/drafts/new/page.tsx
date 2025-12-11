"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { categories } from "@/app/data/mock";

function getMinEndDateTimeString(): string {
  const now = new Date();
  // Kleiner Puffer, damit "jetzt" nicht knapp in der Vergangenheit liegt
  now.setMinutes(now.getMinutes() + 5);
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function getPreviewCategoryLetter(category: string, customCategory: string, useCustomCategory: boolean): string {
  const value = (useCustomCategory ? customCategory : category).trim();
  return value.charAt(0).toUpperCase() || "?";
}

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

  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const previewImageUrl = imagePreviewUrl || imageUrl || "";

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const navigateHome = useCallback(
    (withSuccessFlag: boolean) => {
      setIsLeaving(true);
      setTimeout(() => {
        router.push(withSuccessFlag ? "/?draft=submitted" : "/");
      }, 190);
    },
    [router]
  );

  const handleFormKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter") return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Enter soll nur im Beschreibungstext neue Zeilen erzeugen,
    // aber nicht versehentlich das Formular absenden.
    if (target.tagName !== "TEXTAREA") {
      event.preventDefault();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Bitte gib einen Titel für deine Frage ein.");
      return;
    }
    if (trimmedTitle.length < 10) {
      setError("Der Titel sollte mindestens 10 Zeichen lang sein, damit die Frage verständlich ist.");
      return;
    }

    const finalCategory = (useCustomCategory ? customCategory : category).trim();
    if (!finalCategory) {
      setError("Bitte wähle eine Kategorie oder gib eine eigene ein.");
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
        setError("Die Bezeichnung der Region ist sehr kurz. Bitte gib mindestens 3 Zeichen ein oder lass das Feld leer.");
        return;
      }
      finalRegion = trimmedRegion || undefined;
    } else {
      finalRegion = regionSelect === "Global" ? "Global" : regionSelect;
    }

    // Review-Dauer bestimmen
    let finalTimeLeftHours: number;
    let finalClosesAt: string;
    if (reviewMode === "endDate") {
      const raw = endDateTime.trim();
      if (!raw) {
        setError("Bitte wähle ein Enddatum für den Review-Zeitraum.");
        return;
      }
      const end = new Date(raw);
      if (Number.isNaN(end.getTime())) {
        setError("Das gewählte Enddatum ist ungültig.");
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
      finalClosesAt = end.toISOString().split("T")[0];
    } else {
      const safeHours = Number.isFinite(timeLeftHours) ? timeLeftHours : 72;
      if (safeHours < 1) {
        setError("Der Review-Zeitraum in Stunden muss mindestens 1 Stunde betragen.");
        return;
      }
      finalTimeLeftHours = safeHours;
      const defaultEnd = new Date();
      defaultEnd.setDate(defaultEnd.getDate() + 14);
      finalClosesAt = defaultEnd.toISOString().split("T")[0];
      if (typeof window !== "undefined") {
        const ok = window.confirm(
          "Du hast kein genaues Enddatum für die Umfrage angegeben. Standardmäßig läuft sie 14 Tage ab jetzt. Möchtest du fortfahren?"
        );
        if (!ok) {
          setSubmitting(false);
          return;
        }
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      let finalImageUrl: string | undefined = imageUrl.trim() || undefined;

      if (imageFile) {
        const uploadData = new FormData();
        uploadData.append("file", imageFile);

        const uploadRes = await fetch("/api/upload-image", {
          method: "POST",
          body: uploadData,
        });

        const uploadJson = await uploadRes.json().catch(() => null);
        if (!uploadRes.ok || !uploadJson || !uploadJson.imageUrl) {
          setError(uploadJson?.error ?? "Das Bild konnte nicht hochgeladen werden.");
          return;
        }

        finalImageUrl = uploadJson.imageUrl;
      }

      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDescription || undefined,
          category: finalCategory,
          region: finalRegion,
          imageUrl: finalImageUrl,
          timeLeftHours: finalTimeLeftHours,
          closesAt: finalClosesAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Konnte deine Frage nicht speichern.");
        return;
      }

      navigateHome(true);
    } catch {
      setError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentCategoryLabel = (useCustomCategory ? customCategory : category) || "Kategorie";

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
          &larr; Zurück zum Feed
        </Link>

        <section className="mt-4 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/10 backdrop-blur">
          <h1 className="text-2xl font-bold text-white">Frage vorschlagen</h1>
          <p className="mt-1 text-sm text-slate-300">
            Reiche eine neue Prognosefrage ein. Sie erscheint zuerst im Review-Bereich: Dort bewertet die Community die
            Qualität und entscheidet gemeinsam, ob deine Frage in die öffentliche Ja/Nein-Abstimmung übernommen wird.
          </p>

          <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="mt-6 space-y-5">
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
                placeholder="Erkläre kurz, worum es bei der Prognose geht. Dieser Text erscheint später nur in der Detailansicht."
              />
              <p className="text-xs text-slate-400">
                Dieser Text dient dazu, das Thema genauer zu erklären. Er wird nicht in der Kachel im Feed angezeigt,
                sondern in der Detailansicht der Frage.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="imageUrl" className="text-sm font-medium text-slate-100">
                Bild (optional)
              </label>
              <input
                id="imageUrl"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                placeholder="https://… (kleines Vorschaubild für die Kachel)"
              />
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  id="imageFile"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (imagePreviewUrl) {
                      URL.revokeObjectURL(imagePreviewUrl);
                    }
                    setImageFile(file);
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setImagePreviewUrl(url);
                    } else {
                      setImagePreviewUrl(null);
                    }
                  }}
                  className="block w-full text-xs text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-100 hover:file:bg-slate-700"
                />
                {imageFile && previewImageUrl && (
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <div className="flex h-10 w-16 items-center justify-center overflow-hidden rounded-md bg-black/40">
                      <img
                        src={previewImageUrl}
                        alt="Ausgewähltes Bild (verkleinerte Vorschau)"
                        className="max-h-10 max-w-[4rem] object-contain"
                      />
                    </div>
                    <span>Wird auf maximal ca. 250×150 Pixel verkleinert (Seitenverhältnis bleibt erhalten).</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Bitte lade nur Bilder hoch, an denen du die erforderlichen Nutzungsrechte besitzt (z.&nbsp;B. eigene Fotos
                oder lizenzierte Grafiken). Mit dem Upload bestätigst du, dass keine Urheberrechte verletzt werden und
                dass du für eventuelle Verstöße selbst verantwortlich bist.
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
                <option value="DACH">DACH (Deutschland, Österreich, Schweiz)</option>
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
                Du kannst hier wählen, für welche Region deine Prognose gedacht ist. Wenn du nichts änderst, gilt die
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
                    Wie lange die Community Zeit hat, die Qualität deiner Frage zu bewerten (Standard: 72 Stunden).
                  </p>
                </>
              ) : (
                <>
                  <input
                    id="endDateTime"
                    type="datetime-local"
                    value={endDateTime}
                    onChange={(e) => setEndDateTime(e.target.value)}
                    min={getMinEndDateTimeString()}
                    className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                  />
                  <p className="text-xs text-slate-400">
                    Wähle genau, bis wann die Community deine Frage reviewen kann. Intern wird daraus eine Dauer in
                    Stunden berechnet.
                  </p>
                </>
              )}
            </div>

            {error && <p className="text-sm text-rose-300">{error}</p>}

            <div className="mt-6 space-y-3 rounded-2xl border border-white/15 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">Kachel-Vorschau</h2>
                <span className="text-[11px] text-slate-400">
                  So ungefähr wird deine Frage im Feed aussehen.
                </span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-md shadow-emerald-500/10">
                <div className="flex items-start gap-3 text-xs font-semibold text-slate-100">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-base text-emerald-100">
                    {getPreviewCategoryLetter(category, customCategory, useCustomCategory)}
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[10px] uppercase tracking-[0.18rem] text-slate-300">
                      {currentCategoryLabel}
                    </span>
                    <span className="text-xs text-slate-200">
                      {regionSelect === "__custom_region"
                        ? customRegion || "Region"
                        : regionSelect || "Global"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex gap-3">
                  {previewImageUrl && (
                    <div className="flex w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/30">
                      <img
                        src={previewImageUrl}
                        alt={title || "Vorschau-Bild"}
                        className="max-h-20 max-w-[6rem] object-contain"
                      />
                    </div>
                  )}
                  <div className="flex-1 space-y-1">
                    <h3 className="text-base font-bold leading-snug text-white">
                      {title || "Dein Fragetitel erscheint hier."}
                    </h3>
                    {description && (
                      <p className="text-xs text-slate-200 line-clamp-2">
                        {description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
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
