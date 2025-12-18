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
      <path
        d="M6 6l12 12M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
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
        title: "So benutzt du Future‑Vote",
        body: (
          <div className="space-y-2 text-sm text-slate-200">
            <p>
              Future‑Vote ist eine Plattform für Prognose‑Fragen. Du kannst mit <span className="font-semibold text-white">Ja</span>{" "}
              oder <span className="font-semibold text-white">Nein</span> abstimmen, neue Fragen vorschlagen und sehen, wie die Community
              denkt.
            </p>
            <p className="rounded-2xl border border-emerald-200/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100">
              Abstimmen → Deadline → Auflösung mit Quellen → Archiv → deine Trefferquote.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold text-slate-100">1) Feed entdecken</p>
                <p className="mt-1 text-xs text-slate-300">
                  Scrolle durch die Kacheln, filtere nach Kategorien und schau dir Details an.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold text-slate-100">2) Abstimmen</p>
                <p className="mt-1 text-xs text-slate-300">
                  Tippe auf <span className="font-semibold">Ja</span> oder <span className="font-semibold">Nein</span>.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold text-slate-100">3) Frage vorschlagen</p>
                <p className="mt-1 text-xs text-slate-300">
                  Erstelle eine neue Frage. Sie geht zuerst in den Review‑Bereich.
                </p>
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
              Oben im Feed kannst du zwischen Tabs wechseln, z.B. <span className="font-semibold text-white">Alle</span>,{" "}
              <span className="font-semibold text-white">Top heute</span>, <span className="font-semibold text-white">Endet bald</span>{" "}
              oder <span className="font-semibold text-white">Neu & unbewertet</span>.
            </p>
            <p>
              Mit den <span className="font-semibold text-white">Kategorie‑Buttons</span> filterst du nach Themen. Wenn du eine{" "}
              <span className="font-semibold text-white">Region</span> ausgewählt hast, kannst du zusätzlich nach deiner Region filtern.
            </p>
            <p className="text-xs text-slate-300">
              Tipp: Ein erneuter Klick auf einen aktiven Filter schaltet ihn wieder aus.
            </p>
          </div>
        ),
      },
      {
        id: "review",
        title: "Review‑Bereich (Drafts)",
        body: (
          <div className="space-y-2 text-sm text-slate-200">
            <p>
              Neue Vorschläge starten als <span className="font-semibold text-white">Draft</span>. Im Review‑Bereich bewertet die Community,
              ob eine Frage in die Hauptabstimmung soll.
            </p>
            <p>
              Du kannst bei einem Draft <span className="font-semibold text-white">Gute Frage</span> oder{" "}
              <span className="font-semibold text-white">Ablehnen</span> wählen. Unter der Kachel siehst du, wie viele Reviews noch fehlen,
              bis eine Entscheidung fällt.
            </p>
          </div>
        ),
      },
      {
        id: "questions",
        title: "Fragen (Ja/Nein‑Abstimmung)",
        body: (
          <div className="space-y-2 text-sm text-slate-200">
            <p>
              Wenn ein Draft angenommen wird, landet er als <span className="font-semibold text-white">Frage</span> in der Abstimmung. Dort
              stimmt man mit <span className="font-semibold text-white">Ja</span> oder <span className="font-semibold text-white">Nein</span>.
            </p>
            <p>
              In der Detailansicht siehst du zusätzlich Verlauf/Trend und mehr Kontext. Über <span className="font-semibold text-white">Details ansehen</span>{" "}
              kommst du direkt dorthin.
            </p>
          </div>
        ),
      },
      {
        id: "private",
        title: "Private Umfragen (nur per Link)",
        body: (
          <div className="space-y-2 text-sm text-slate-200">
            <p>
              Beim Erstellen kannst du die Sichtbarkeit auf <span className="font-semibold text-white">Privat (nur per Link)</span> setzen.
              Dann erscheint die Umfrage nicht im Feed.
            </p>
            <p>
              Nach dem Einreichen bekommst du direkt die Teilen‑Ansicht. Teile den Link mit Freunden – wer den Link hat, kann bewerten oder
              später abstimmen (je nach Status der Umfrage).
            </p>
            <p className="text-xs text-slate-300">Im Profil findest du deine privaten Umfragen unter dem Tab „Privat (Link)“.</p>
          </div>
        ),
      },
      {
        id: "trend",
        title: "Trend in den Details",
        body: (
          <div className="space-y-2 text-sm text-slate-200">
            <p>
              In der Detailansicht zeigt der Bereich <span className="font-semibold text-white">Trend</span>, wie sich Stimmen/Views/Ranking
              über die Zeit entwickeln.
            </p>
            <p>
              Mit den Buttons (z.B. <span className="font-semibold text-white">Stimmen</span>,{" "}
              <span className="font-semibold text-white">Ja/Nein</span>, <span className="font-semibold text-white">Views</span>) wechselst
              du die Ansicht. Mit <span className="font-semibold text-white">7T / 30T / 90T</span> stellst du den Zeitraum um.
            </p>
          </div>
        ),
      },
      {
        id: "profile",
        title: "Dein Profil",
        body: (
          <div className="space-y-2 text-sm text-slate-200">
            <p>
              Im Profil siehst du deine Statistik (z.B. eigene Vorschläge, Abstimmungen und Reviews) und kannst deine Region setzen.
            </p>
            <p>
              Unter <span className="font-semibold text-white">Deine Umfragen</span> findest du deine eingereichten Drafts und deine privaten
              Link‑Umfragen.
            </p>
          </div>
        ),
      },
      {
        id: "report",
        title: "Problematische Inhalte melden",
        body: (
          <div className="space-y-2 text-sm text-slate-200">
            <p>
              Wenn dir eine Kachel als Spam, beleidigend oder irreführend auffällt, nutze den Button{" "}
              <span className="font-semibold text-white">Melden</span>.
            </p>
            <p>
              Wähle einen Grund aus und gib optional einen kurzen Hinweis. So hilfst du dabei, die Qualität im Feed hoch zu halten.
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
              In der <span className="font-semibold text-white">Rangliste</span> siehst du, wer bei bereits{" "}
              <span className="font-semibold text-white">aufgelösten</span> Fragen oft richtig lag (Trefferquote &amp; Anzahl).
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
        title: "Archiv & Statistiken",
        body: (
          <div className="space-y-2 text-sm text-slate-200">
            <p>
              Im Archiv findest du beendete Umfragen und einen Überblick über die Plattform.
            </p>
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
    ],
    []
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
        <div
          data-fv-help="1"
          className="overlay-enter fixed inset-0 z-50 overflow-y-auto bg-black/55 backdrop-blur-sm"
          onClick={close}
        >
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
              {sections.map((s) => (
                <details
                  key={s.id}
                  open={s.id === "start"}
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
