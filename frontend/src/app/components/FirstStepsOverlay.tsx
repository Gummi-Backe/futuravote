"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "fv_first_steps_v1_shown";

type Step = {
  title: string;
  body: React.ReactNode;
};

export function FirstStepsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
      setOpen(true);
    } catch {
      // Falls Storage geblockt ist: kein Overlay erzwingen.
    }
  }, []);

  const close = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const steps = useMemo<Step[]>(
    () => [
      {
        title: "1) Abstimmen",
        body: (
          <>
            Tippe auf <span className="font-semibold text-white">Ja</span> oder{" "}
            <span className="font-semibold text-white">Nein</span>. Du brauchst dafür kein Login.
          </>
        ),
      },
      {
        title: "2) Details & Trend",
        body: <>In den Details siehst du den Verlauf (Trend) und die wichtigsten Zahlen zur Frage.</>,
      },
      {
        title: "3) Auflösung & Archiv",
        body: (
          <>
            Wenn eine Frage endet, wird sie{" "}
            <span className="font-semibold text-white">mit Quelle</span> aufgelöst. Im{" "}
            <Link href="/archiv" className="font-semibold text-emerald-100 hover:text-emerald-50">
              Archiv
            </Link>{" "}
            siehst du das Ergebnis und ob die Community richtig lag.
          </>
        ),
      },
      {
        title: "4) Eigene Frage vorschlagen",
        body: (
          <>
            Über <span className="font-semibold text-white">Frage stellen</span> kannst du neue Fragen einreichen. Sie starten im{" "}
            <span className="font-semibold text-white">Review</span> und die Community entscheidet, ob sie live geht.
          </>
        ),
      },
      {
        title: "Privat per Link (optional)",
        body: (
          <>
            Du kannst beim Erstellen auch{" "}
            <span className="font-semibold text-white">Privat (nur per Link)</span> wählen. Dann erscheint die Umfrage nicht im Feed – nur
            wer den Link hat, kann abstimmen.
          </>
        ),
      },
    ],
    []
  );

  if (!open) return null;

  return (
    <div className="overlay-enter fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" onClick={close}>
      <div
        className="overlay-panel absolute left-1/2 top-12 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-3xl border border-white/15 bg-slate-950/95 p-5 shadow-2xl shadow-black/50 sm:top-16 sm:p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Erste Schritte"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/90">Willkommen bei Future‑Vote</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Kurz erklärt, wie’s hier läuft</h2>
            <p className="mt-2 rounded-2xl border border-emerald-200/20 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100">
              {"Abstimmen \u2192 Deadline \u2192 Aufl\u00f6sung mit Quellen \u2192 Archiv \u2192 deine Trefferquote."}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 hover:border-emerald-200/40 hover:text-white"
            aria-label="Schließen"
            title="Schließen"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6 6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {steps.map((s) => (
            <div key={s.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">{s.title}</p>
              <p className="mt-1 text-sm text-slate-200">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href="/regeln"
              onClick={close}
              className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100 hover:border-emerald-200/40 sm:w-auto"
            >
              Regeln ansehen
            </Link>
            <Link
              href="/archiv"
              onClick={close}
              className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100 hover:border-emerald-200/40 sm:w-auto"
            >
              Archiv öffnen
            </Link>
          </div>
          <button
            type="button"
            onClick={close}
            className="inline-flex w-full items-center justify-center rounded-full border border-emerald-200/25 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-500/25 sm:w-auto"
          >
            Los geht’s
          </button>
        </div>
      </div>
    </div>
  );
}
