"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type HelpSection = {
  id: string;
  title: string;
  body: React.ReactNode;
};

function HelpIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path
        d="M12 18h.01M9.8 9.2a2.3 2.3 0 1 1 3.5 2c-.8.5-1.3 1-1.3 1.8v.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.75" />
    </svg>
  );
}

export function HelpButton() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

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

  const sections = useMemo<HelpSection[]>(
    () => [
      {
        id: "start",
        title: "So benutzt du Future-Vote",
        body: (
          <div className="space-y-2 text-sm text-slate-200">
            <p>
              Future-Vote ist eine Plattform für <span className="font-semibold text-white">Umfragen</span> und{" "}
              <span className="font-semibold text-white">Prognosen</span>.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold text-slate-100">1) Feed entdecken</p>
                <p className="mt-1 text-xs text-slate-300">Scrolle durch die Kacheln und öffne Details.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold text-slate-100">2) Abstimmen</p>
                <p className="mt-1 text-xs text-slate-300">
                  Tippe auf <span className="font-semibold">Ja</span> / <span className="font-semibold">Nein</span> oder wähle eine Option.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold text-slate-100">3) Frage vorschlagen</p>
                <p className="mt-1 text-xs text-slate-300">Erstelle eine neue Frage – die Community entscheidet.</p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "feed",
        title: "Feed & Filter",
        body: (
          <div className="space-y-2 text-sm text-slate-200">
            <p>
              Oben kannst du Filter nutzen (z.B. <span className="font-semibold text-white">Alle</span>,{" "}
              <span className="font-semibold text-white">Top heute</span> oder <span className="font-semibold text-white">Endet bald</span>).
            </p>
            <p>
              Mit <span className="font-semibold text-white">Noch nicht abgestimmt</span> /{" "}
              <span className="font-semibold text-white">Abgestimmt</span> wechselst du zwischen offenen und bereits beantworteten Fragen.
            </p>
          </div>
        ),
      },
      {
        id: "leaderboard",
        title: "Rangliste",
        body: (
          <div className="space-y-2 text-sm text-slate-200">
            <p>
              In der Rangliste gibt es zwei Ansichten:
              <span className="font-semibold text-white"> Treffer</span> (aufgelöste Prognosen) und{" "}
              <span className="font-semibold text-white">Community</span> (Beiträge wie Vorschläge, Kommentare und geteilte Links).
            </p>
            <p className="text-xs text-slate-300">
              Teilen zählt erst dann, wenn jemand über deinen Link auf die Seite kommt.
            </p>
            <div>
              <Link
                href="/rangliste"
                onClick={close}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-emerald-100 hover:border-emerald-200/40 hover:text-emerald-50"
              >
                Rangliste öffnen →
              </Link>
            </div>
          </div>
        ),
      },
      {
        id: "archive",
        title: "Archiv",
        body: (
          <div className="space-y-2 text-sm text-slate-200">
            <p>Im Archiv findest du beendete Umfragen und Prognosen.</p>
            <div>
              <Link
                href="/archiv"
                onClick={close}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-emerald-100 hover:border-emerald-200/40 hover:text-emerald-50"
              >
                Archiv öffnen →
              </Link>
            </div>
          </div>
        ),
      },
      {
        id: "install",
        title: "Als App installieren (optional)",
        body: (
          <div className="space-y-3 text-sm text-slate-200">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold text-white">Desktop (Edge)</p>
                <p className="mt-1 text-xs text-slate-300">
                  Oben rechts auf <span className="font-semibold">⋯</span> → <span className="font-semibold">Apps</span> →{" "}
                  <span className="font-semibold">Installieren Sie Future-Vote</span>.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold text-white">Android (Edge)</p>
                <p className="mt-1 text-xs text-slate-300">
                  Unten rechts auf <span className="font-semibold">≡</span> → ggf. einmal nach links wischen →{" "}
                  <span className="font-semibold">Zu Smartphone hinzufügen</span>.
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Hinweis: Wenn du keinen Install-Button siehst, bietet dein Browser das für diese Seite gerade nicht an (oder sie ist bereits
              installiert).
            </p>
          </div>
        ),
      },
    ],
    [close]
  );

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        data-fv-help="1"
        className="fixed bottom-5 right-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white shadow-2xl shadow-emerald-500/10 backdrop-blur transition hover:-translate-y-0.5 hover:border-emerald-200/40 active:translate-y-0"
        aria-label={open ? "Hilfe schließen" : "Hilfe öffnen"}
        title={open ? "Hilfe schließen" : "Hilfe"}
      >
        <HelpIcon open={open} />
      </button>

      {open ? (
        <div data-fv-help="1" className="overlay-enter fixed inset-0 z-50 overflow-y-auto bg-black/55 backdrop-blur-sm" onClick={close}>
          <div
            className="overlay-panel absolute left-1/2 top-16 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-3xl border border-white/15 bg-slate-950/95 p-5 shadow-2xl shadow-black/50 max-h-[calc(100svh-8rem)] overflow-y-auto overscroll-contain sm:top-20 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Hilfe</h2>
                <p className="mt-1 text-xs text-slate-300">Kurz erklärt, was du wo findest.</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-100 hover:border-emerald-300/60"
              >
                Schließen
              </button>
            </div>

            <div className="mt-4 space-y-3 pr-1">
              {sections.map((s, idx) => (
                <details
                  key={s.id}
                  open={idx === 0}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-4 open:border-emerald-300/30 open:bg-emerald-500/10"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-white">{s.title}</span>
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5 text-slate-300 transition-transform group-open:rotate-180 group-open:text-emerald-50/90"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </summary>
                  <div className="mt-3">{s.body}</div>
                </details>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

