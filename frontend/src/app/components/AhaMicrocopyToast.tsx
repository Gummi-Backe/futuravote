"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AhaPayload = { closesAt?: string | null };

function formatClosesAt(closesAt?: string | null) {
  if (!closesAt) return null;
  const ms = Date.parse(closesAt);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleDateString("de-DE", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function AhaMicrocopyToast() {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<AhaPayload>({});

  useEffect(() => {
    const onAha = (event: Event) => {
      const detail = (event as CustomEvent).detail as AhaPayload;
      setPayload(detail ?? {});
      setOpen(true);
    };
    window.addEventListener("fv:aha", onAha);
    return () => window.removeEventListener("fv:aha", onAha);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setOpen(false), 10000);
    return () => window.clearTimeout(t);
  }, [open]);

  const closesAtLabel = useMemo(() => formatClosesAt(payload.closesAt), [payload.closesAt]);

  if (!open) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-40 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2">
      <div className="rounded-3xl border border-emerald-200/25 bg-slate-950/95 p-4 shadow-2xl shadow-emerald-500/15 backdrop-blur sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/90">
              So funktioniert Future-Vote
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              Du hast abgestimmt — jetzt zählt, ob du später recht hattest.
            </p>
            <p className="mt-2 text-sm text-slate-200">
              {closesAtLabel ? (
                <>
                  Diese Frage endet am <span className="font-semibold text-slate-50">{closesAtLabel}</span>. Danach wird sie{" "}
                  <span className="font-semibold text-slate-50">mit Quelle</span> aufgelöst.
                </>
              ) : (
                <>
                  Nach der Deadline wird diese Frage <span className="font-semibold text-slate-50">mit Quelle</span> aufgelöst.
                </>
              )}{" "}
              Dann siehst du, ob dein Tipp richtig war.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href="/archiv"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100 hover:border-emerald-200/40"
              >
                Archiv ansehen
              </Link>
              <Link
                href="/regeln"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100 hover:border-emerald-200/40"
              >
                Regeln &amp; Auflösung
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center rounded-full border border-emerald-200/25 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-500/25"
              >
                Verstanden
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 hover:border-emerald-200/40 hover:text-white"
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
      </div>
    </div>
  );
}
