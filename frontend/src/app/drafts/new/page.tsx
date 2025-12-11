"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { categories } from "@/app/data/mock";

function getMinEndDateTimeString(): string {
  const now = new Date();
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

async function resizeImageClientSide(file: File, maxWidth: number, maxHeight: number): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    img.src = dataUrl;
  });

  const { width, height } = image;
  if (!width || !height) {
    throw new Error("Bild hat keine gültigen Abmessungen.");
  }

  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas-Kontext konnte nicht initialisiert werden.");
  }

  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Bild konnte nicht verkleinert werden."));
      },
      "image/jpeg",
      0.8
    );
  });

  return blob;
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
  const [imageCredit, setImageCredit] = useState("");
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
    if (target.tagName !== "TEXTAREA") {
      event.preventDefault();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      setError("Bitte gib einen Titel für deine Frage ein.");
      return;
    }
    if (trimmedTitle.length < 10) {
      setError("Der Titel sollte mindestens 10 Zeichen lang sein, damit die Frage verständlich ist.");
      return;
    }

    let finalCategory = useCustomCategory ? customCategory.trim() : category.trim();
    if (!finalCategory) {
      setError("Bitte wähle eine Kategorie oder gib eine eigene ein.");
      return;
    }
    if (useCustomCategory && finalCategory.length < 3) {
      setError("Die eigene Kategorie sollte mindestens 3 Zeichen haben.");
      return;
    }

    let finalRegion = "";
    if (regionSelect === "__custom_region") {
      finalRegion = customRegion.trim();
    } else if (regionSelect !== "Global") {
      finalRegion = regionSelect;
    }

    let finalTimeLeftHours = timeLeftHours;
    let finalClosesAt: string | undefined;

    if (reviewMode === "duration") {
      if (!Number.isFinite(timeLeftHours) || timeLeftHours <= 0) {
        setError("Bitte gib eine gültige Dauer in Stunden an.");
        return;
      }
      finalTimeLeftHours = timeLeftHours;
    } else {
      if (!endDateTime) {
        setError("Bitte wähle ein Datum und eine Uhrzeit für das Ende des Reviews.");
        return;
      }
      const closesAt = new Date(endDateTime);
      const now = new Date();
      if (Number.isNaN(closesAt.getTime()) || closesAt <= now) {
        setError("Das gewählte Datum liegt in der Vergangenheit. Bitte wähle einen Zeitpunkt in der Zukunft.");
        return;
      }
      finalClosesAt = closesAt.toISOString();
      const diffMs = closesAt.getTime() - now.getTime();
      finalTimeLeftHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
    }

    setSubmitting(true);
    setError(null);

    try {
      let finalImageUrl: string | undefined = imageUrl.trim() || undefined;

      if (imageFile) {
        const resizedBlob = await resizeImageClientSide(imageFile, 250, 150);
        const uploadData = new FormData();
        uploadData.append("file", resizedBlob, imageFile.name || "image.jpg");

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

      const trimmedImageCredit = imageCredit.trim();

      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDescription || undefined,
          category: finalCategory,
          region: finalRegion || undefined,
          imageUrl: finalImageUrl,
          imageCredit: trimmedImageCredit || undefined,
          timeLeftHours: finalTimeLeftHours,
          closesAt: finalClosesAt,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Konnte deine Frage nicht speichern.");
        return;
      }

      navigateHome(true);
    } catch (err) {
      console.error(err);
      setError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentCategoryLabel = (useCustomCategory ? customCategory : category) || "Kategorie";

  const previewCard = (
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
            {regionSelect === "__custom_region" ? customRegion || "Region" : regionSelect || "Global"}
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
          {description && <p className="text-xs text-slate-200 line-clamp-2">{description}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <main
      className={`${isLeaving ? "page-leave" : "page-enter"} min-h-screen bg-slate-950 text-slate-50`}
    >
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-8 lg:max-w-5xl">
        <Link href="/" className="inline-flex items-center text-sm text-emerald-100 hover:text-emerald-200">
          &larr; Zurück zum Feed
        </Link>

        <section className="mt-4 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
          <div className="sticky top-4 z-20 mb-4">
            <div className="space-y-3 rounded-2xl border border-white/20 bg-slate-950/95 p-4 shadow-xl shadow-emerald-500/25">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">Kachel-Vorschau</h2>
                <span className="text-[11px] text-slate-400">
                  So ungefähr wird deine Frage im Feed aussehen.
                </span>
              </div>
              {previewCard}
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white">Frage vorschlagen</h1>
          <p className="mt-1 text-sm text-slate-300">
            Formuliere eine neue Prognosefrage. Die Community entscheidet im Review-Bereich, ob sie es in die
            Hauptabstimmung schafft.
          </p>

          <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="mt-6 space-y-5">
            <div className="space-y-3 rounded-2xl border border-white/15 bg-black/20 p-4">
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
            </div>

            <div className="space-y-3 rounded-2xl border border-white/15 bg-black/20 p-4">
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
                      <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-md bg-black/40">
                        <img
                          src={previewImageUrl}
                          alt={title || "Vorschau-Bild"}
                          className="max-h-16 max-w-[6rem] object-contain"
                        />
                      </div>
                      <span>Wird auf maximal ca. 250×150 Pixel verkleinert (Seitenverhältnis bleibt erhalten).</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Bitte lade nur Bilder hoch, an denen du die erforderlichen Nutzungsrechte besitzt (z.&nbsp;B. eigene
                  Fotos oder lizenzierte Grafiken). Mit dem Upload bestätigst du, dass keine Urheberrechte verletzt
                  werden und dass du für eventuelle Verstöße selbst verantwortlich bist.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="imageCredit" className="text-sm font-medium text-slate-100">
                  Bildquelle / Urheberangabe (optional)
                </label>
                <input
                  id="imageCredit"
                  type="text"
                  value={imageCredit}
                  onChange={(e) => setImageCredit(e.target.value)}
                  maxLength={140}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                  placeholder='z. B. "Foto: Name / Agentur"'
                />
                <p className="text-xs text-slate-400">
                  Diese Angabe erscheint klein unter der Frage (z.&nbsp;B. in der Kachel und in der Detailansicht),
                  damit die Bildquelle klar erkennbar ist.
                </p>
              </div>
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
                  placeholder="z. B. Gesundheit, Bildung, Energie …"
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
                  placeholder="z. B. Berlin, NRW, Bodensee-Region"
                />
              )}
              <p className="text-xs text-slate-400">
                Du kannst hier wählen, für welche Region deine Prognose gedacht ist. Wenn du nichts änderst, gilt die
                Frage global.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-100">Review-Zeitraum</label>
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
