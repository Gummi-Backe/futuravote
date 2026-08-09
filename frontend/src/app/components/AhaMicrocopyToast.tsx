"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShareLinkButton } from "@/app/components/ShareLinkButton";
import { trackEvent } from "@/app/lib/analytics";

type AhaPayload = {
  closesAt?: string | null;
  questionId?: string;
  questionTitle?: string;
  shareUrl?: string;
  choiceLabel?: string;
  firstVote?: boolean;
};

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
    trackEvent("share_prompt_view", {
      questionId: payload.questionId ?? "",
      firstVote: payload.firstVote === true,
    });
    if (payload.firstVote === true) return;
    const timer = window.setTimeout(() => setOpen(false), 12_000);
    return () => window.clearTimeout(timer);
  }, [open, payload.firstVote, payload.questionId]);

  const closesAtLabel = useMemo(() => formatClosesAt(payload.closesAt), [payload.closesAt]);

  if (!open) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-40 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2">
      <div className="rounded-3xl border border-emerald-200/25 bg-slate-950/95 p-4 shadow-2xl shadow-emerald-500/15 backdrop-blur sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/90">
              {payload.firstVote ? "So funktioniert Future-Vote" : "Stimme gespeichert"}
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {payload.choiceLabel
                ? `Deine Antwort "${payload.choiceLabel}" wurde gezählt.`
                : "Deine Stimme wurde gezählt."}
            </p>
            {payload.firstVote ? (
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
            ) : (
              <p className="mt-2 text-sm text-slate-200">
                Lade andere ein, damit das Ergebnis mehr als nur eine Einzelmeinung zeigt.
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {payload.shareUrl ? (
                <ShareLinkButton
                  url={payload.shareUrl}
                  label="Umfrage teilen"
                  action="share"
                  variant="primary"
                  shareTitle="Future-Vote Umfrage"
                  shareText={payload.questionTitle ? `Stimme ab: ${payload.questionTitle}` : "Stimme bei Future-Vote ab."}
                  className="!rounded-full !px-4 !py-2 !text-xs"
                />
              ) : null}
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100 hover:border-emerald-200/40"
              >
                Weiter abstimmen
              </Link>
              {payload.firstVote ? (
                <Link
                  href="/regeln"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100 hover:border-emerald-200/40"
                >
                  So wird aufgelöst
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center rounded-full border border-emerald-200/25 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-500/25"
              >
                Schließen
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
