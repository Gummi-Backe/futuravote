"use client";

import { useCallback, useMemo, useRef, useState } from "react";

type ReportKind = "question" | "draft";
type ReportReason = "spam" | "abuse" | "hate" | "misinfo" | "copyright" | "other";

const reasonOptions: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "abuse", label: "Beleidigung / Belästigung" },
  { value: "hate", label: "Hass / Hetze" },
  { value: "misinfo", label: "Irreführend / Falschinfo" },
  { value: "copyright", label: "Urheberrecht" },
  { value: "other", label: "Sonstiges" },
];

export function ReportButton({
  kind,
  itemId,
  itemTitle,
  shareId,
  className,
  label = "Melden",
}: {
  kind: ReportKind;
  itemId: string;
  itemTitle?: string | null;
  shareId?: string | null;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("abuse");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | { type: "ok" | "duplicate" | "error"; message: string }>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const reset = useCallback(() => {
    setReason("abuse");
    setMessage("");
    setSubmitting(false);
    setResult(null);
  }, []);

  const openModal = useCallback(() => {
    lastFocus.current = (document.activeElement as HTMLElement | null) ?? null;
    setOpen(true);
    setResult(null);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setSubmitting(false);
    setResult(null);
    setTimeout(() => lastFocus.current?.focus?.(), 0);
  }, []);

  const canSubmit = useMemo(() => {
    if (!itemId) return false;
    if (!reason) return false;
    return true;
  }, [itemId, reason]);

  const submit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          itemId,
          itemTitle: itemTitle ?? null,
          shareId: shareId ?? null,
          reason,
          message: message.trim() || null,
          pageUrl: typeof window !== "undefined" ? window.location.href : null,
        }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (res.ok && json?.ok) {
        if (json?.duplicate) {
          setResult({ type: "duplicate", message: "Du hast diese Kachel bereits gemeldet. Danke!" });
        } else {
          setResult({ type: "ok", message: "Danke! Deine Meldung wurde gespeichert." });
        }
        return;
      }
      const msg = json?.error ?? "Meldung konnte nicht gespeichert werden.";
      setResult({ type: "error", message: msg });
    } catch {
      setResult({ type: "error", message: "Netzwerkfehler. Bitte versuche es erneut." });
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, itemId, itemTitle, kind, message, reason, shareId, submitting]);

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={
          className ??
          "inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-rose-200/40"
        }
      >
        {label}
      </button>

      {open ? (
        <div
          className="overlay-enter fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => {
            closeModal();
            reset();
          }}
        >
          <div
            className="overlay-panel absolute left-1/2 top-24 w-full max-w-lg -translate-x-1/2 rounded-3xl border border-white/15 bg-slate-900/95 p-5 shadow-2xl shadow-black/40"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">Kachel melden</h3>
                <p className="mt-1 text-xs text-slate-300">
                  Danke! Deine Meldung wird nur dem Admin angezeigt.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/20 px-2 py-1 text-xs text-slate-100 hover:border-emerald-300/60"
                onClick={() => {
                  closeModal();
                  reset();
                }}
              >
                Schliessen
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-200">
                Grund
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ReportReason)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/50"
                >
                  {reasonOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-200">
                Optionaler Hinweis (max. 1000 Zeichen)
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/50"
                  placeholder="Was genau ist problematisch?"
                />
              </label>

              {result ? (
                <div
                  className={`rounded-2xl border px-4 py-3 text-xs ${
                    result.type === "ok" || result.type === "duplicate"
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                      : "border-rose-400/30 bg-rose-500/10 text-rose-100"
                  }`}
                >
                  {result.message}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:border-emerald-200/40"
                  onClick={() => {
                    closeModal();
                    reset();
                  }}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  disabled={!canSubmit || submitting || result?.type === "ok" || result?.type === "duplicate"}
                  className="rounded-xl border border-rose-300/30 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-500/10 transition hover:-translate-y-0.5 hover:border-rose-300/60 disabled:opacity-60"
                  onClick={submit}
                >
                  {submitting ? "Sende..." : "Meldung senden"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

