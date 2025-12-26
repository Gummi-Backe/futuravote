"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SmartBackButton } from "@/app/components/SmartBackButton";

type ReportStatus = "open" | "resolved" | "dismissed";

type ReportRow = {
  id: string;
  kind: "question" | "draft";
  item_id: string;
  item_title: string | null;
  share_id: string | null;
  reason: string;
  message: string | null;
  page_url: string | null;
  reporter_user_id: string | null;
  status: ReportStatus;
  created_at: string;
};

const reasonLabel: Record<string, string> = {
  spam: "Spam",
  abuse: "Beleidigung / Belästigung",
  hate: "Hass / Hetze",
  misinfo: "Irreführend / Falschinfo",
  copyright: "Urheberrecht",
  other: "Sonstiges",
};

function formatDate(value: string) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value;
  return new Date(ms).toLocaleString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveTargetLink(r: ReportRow): string | null {
  const withFrom = (href: string) => (href.includes("?") ? `${href}&from=admin_reports` : `${href}?from=admin_reports`);
  if (r.share_id) return withFrom(`/p/${encodeURIComponent(r.share_id)}`);
  if (r.kind === "question") return withFrom(`/questions/${encodeURIComponent(r.item_id)}`);
  // Drafts haben keine oeffentliche Detailseite; Admin kann notfalls ueber Home/DB prüfen.
  return null;
}

export default function ReportsClient() {
  const [status, setStatus] = useState<ReportStatus>("open");
  const [reports, setReports] = useState<ReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async (nextStatus: ReportStatus) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports?status=${encodeURIComponent(nextStatus)}&limit=150`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        throw new Error(json?.error ?? "Reports konnten nicht geladen werden.");
      }
      setReports((Array.isArray(json?.reports) ? json.reports : []) as ReportRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reports konnten nicht geladen werden.");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReports(status);
  }, [fetchReports, status]);

  const updateStatus = useCallback(
    async (id: string, next: ReportStatus) => {
      setError(null);
      try {
        const res = await fetch("/api/admin/reports", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status: next }),
        });
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          throw new Error(json?.error ?? "Update fehlgeschlagen.");
        }
        setReports((prev) => (prev ?? []).filter((r) => r.id !== id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update fehlgeschlagen.");
      }
    },
    []
  );

  const runAdminAction = useCallback(
    async (opts: { kind: "question" | "draft"; id: string; action: string }) => {
      setError(null);
      try {
        if (opts.kind === "question") {
          const okDelete = opts.action === "delete" ? window.confirm("Diese Frage wirklich endgültig löschen?") : true;
          if (!okDelete) return;
          const res = await fetch("/api/admin/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId: opts.id, action: opts.action }),
          });
          const json = (await res.json().catch(() => null)) as any;
          if (!res.ok) throw new Error(json?.error ?? "Admin-Aktion fehlgeschlagen.");
          return;
        }

        const okDelete = opts.action === "delete" ? window.confirm("Diesen Draft wirklich endgültig löschen?") : true;
        if (!okDelete) return;
        const res = await fetch("/api/admin/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftId: opts.id, action: opts.action }),
        });
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok) throw new Error(json?.error ?? "Admin-Aktion fehlgeschlagen.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Admin-Aktion fehlgeschlagen.");
      }
    },
    []
  );

  const title = useMemo(() => {
    if (status === "resolved") return "Erledigte Meldungen";
    if (status === "dismissed") return "Ignorierte Meldungen";
    return "Offene Meldungen";
  }, [status]);

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Meldungen</h1>
          <p className="mt-1 text-sm text-slate-300">
            Nutzer können Fragen und Drafts melden (auch private Link-Umfragen). Hier bearbeitest du die Queue.
          </p>
        </div>
        <Link
          href="/admin/analytics"
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-emerald-200/30"
        >
          Analytics
        </Link>
        <SmartBackButton
          fallbackHref="/"
          label="← Zurück"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(
          [
            { id: "open" as const, label: "Offen" },
            { id: "resolved" as const, label: "Erledigt" },
            { id: "dismissed" as const, label: "Ignoriert" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setStatus(t.id)}
            className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition hover:-translate-y-0.5 ${
              status === t.id
                ? "border-emerald-300/60 bg-emerald-500/20 text-white"
                : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40"
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-300">{loading ? "Lade..." : title}</span>
      </div>

      {error ? <div className="mt-3 text-sm text-rose-200">{error}</div> : null}

      <div className="mt-4 space-y-3">
        {reports === null ? (
          <div className="text-sm text-slate-300">Lade...</div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200">
            Keine Meldungen in dieser Ansicht.
          </div>
        ) : (
          reports.map((r) => {
            const link = resolveTargetLink(r);
            return (
              <article key={r.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-100">
                        {r.kind === "question" ? "Frage" : "Draft"}
                      </span>
                      <span className="rounded-full border border-rose-300/30 bg-rose-500/15 px-3 py-1 text-[11px] font-semibold text-rose-50">
                        {reasonLabel[r.reason] ?? r.reason}
                      </span>
                      <span className="text-[11px] text-slate-400">{formatDate(r.created_at)}</span>
                    </div>
                    <h3 className="mt-2 card-title-wrap text-sm font-semibold text-white">
                      {r.item_title ?? `${r.kind}:${r.item_id}`}
                    </h3>
                    {r.message ? <p className="mt-1 text-sm text-slate-200">{r.message}</p> : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                      {link ? (
                        <Link href={link} className="text-emerald-100 hover:text-emerald-200">
                          Zur Kachel
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  {status === "open" ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      {r.kind === "question" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => runAdminAction({ kind: "question", id: r.item_id, action: "archive" })}
                            className="rounded-xl border border-amber-300/30 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-50 hover:border-amber-300/60"
                          >
                            Frage stoppen
                          </button>
                          <button
                            type="button"
                            onClick={() => runAdminAction({ kind: "question", id: r.item_id, action: "delete" })}
                            className="rounded-xl border border-rose-300/30 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-50 hover:border-rose-300/60"
                          >
                            Endgültig löschen
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => runAdminAction({ kind: "draft", id: r.item_id, action: "reject" })}
                            className="rounded-xl border border-amber-300/30 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-50 hover:border-amber-300/60"
                          >
                            Draft sperren
                          </button>
                          <button
                            type="button"
                            onClick={() => runAdminAction({ kind: "draft", id: r.item_id, action: "delete" })}
                            className="rounded-xl border border-rose-300/30 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-50 hover:border-rose-300/60"
                          >
                            Endgültig löschen
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => updateStatus(r.id, "resolved")}
                        className="rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-50 hover:border-emerald-300/60"
                      >
                        Erledigt
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(r.id, "dismissed")}
                        className="rounded-xl border border-slate-300/20 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-slate-300/40"
                      >
                        Ignorieren
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
