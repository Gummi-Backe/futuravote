"use client";

import Link from "next/link";

export default function QuestionError({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-screen bg-transparent text-slate-50">
      <div className="mx-auto max-w-4xl px-4 pb-12 pt-10 lg:px-6 space-y-4">
        <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 px-6 py-6 shadow-2xl shadow-rose-500/20 backdrop-blur">
          <h1 className="text-xl font-semibold text-white">Fehler beim Laden</h1>
          <p className="mt-2 text-sm text-rose-100/90">
            Die Frage konnte nicht geladen werden. Bitte versuche es erneut.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow hover:-translate-y-0.5 transition"
            >
              Noch einmal laden
            </button>
            <Link
              href="/"
              className="rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:-translate-y-0.5 transition"
            >
              Zum Feed
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
