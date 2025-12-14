"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShareLinkButton } from "@/app/components/ShareLinkButton";

type Tab = "drafts" | "private";

type MyDraft = {
  id: string;
  title: string;
  status: string;
  createdAt: string | null;
};

type PrivateQuestion = {
  id: string;
  title: string;
  shareId: string;
  createdAt: string | null;
  status: string;
};

type PrivateDraft = {
  id: string;
  title: string;
  shareId: string;
  createdAt: string | null;
  status: string;
};

function formatDate(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function StatusChip({ status }: { status: string }) {
  const label = status === "accepted" ? "Angenommen" : status === "rejected" ? "Abgelehnt" : "Offen";
  const cls =
    status === "accepted"
      ? "bg-emerald-500/15 text-emerald-100 border border-emerald-400/40"
      : status === "rejected"
        ? "bg-rose-500/15 text-rose-100 border border-rose-400/40"
        : "bg-sky-500/15 text-sky-100 border border-sky-400/30";
  return <span className={`rounded-full border px-2 py-0.5 font-semibold ${cls}`}>{label}</span>;
}

function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="animate-pulse rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-sm shadow-black/20"
        >
          <div className="h-4 w-2/3 rounded bg-white/10" />
          <div className="mt-2 flex items-center gap-2">
            <div className="h-5 w-16 rounded-full bg-white/10" />
            <div className="h-4 w-20 rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfilePollTabs({ baseUrl }: { baseUrl: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("drafts");
  const [drafts, setDrafts] = useState<MyDraft[] | null>(null);
  const [privateQuestions, setPrivateQuestions] = useState<PrivateQuestion[] | null>(null);
  const [privateDrafts, setPrivateDrafts] = useState<PrivateDraft[] | null>(null);
  const [loading, setLoading] = useState<Tab | null>(null);
  const [error, setError] = useState<string | null>(null);

  const privateLoaded = privateQuestions !== null && privateDrafts !== null;

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "private" || tab === "drafts") setActiveTab(tab);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const fetchTab = async () => {
      if (activeTab === "drafts" && drafts !== null) return;
      if (activeTab === "private" && privateLoaded) return;

      setLoading(activeTab);
      setError(null);
      try {
        if (activeTab === "drafts") {
          const res = await fetch("/api/profil/drafts");
          const json = (await res.json().catch(() => null)) as any;
          if (!res.ok) throw new Error(json?.error ?? "Konnte Drafts nicht laden.");
          setDrafts((json?.drafts ?? []) as MyDraft[]);
        } else {
          const res = await fetch("/api/profil/private");
          const json = (await res.json().catch(() => null)) as any;
          if (!res.ok) throw new Error(json?.error ?? "Konnte private Umfragen nicht laden.");
          setPrivateQuestions((json?.privateQuestions ?? []) as PrivateQuestion[]);
          setPrivateDrafts((json?.privateDrafts ?? []) as PrivateDraft[]);
        }
      } catch (e: any) {
        setError(e?.message ?? "Konnte Daten nicht laden.");
      } finally {
        setLoading(null);
      }
    };
    void fetchTab();
  }, [activeTab, drafts, privateLoaded]);

  const setTab = (tab: Tab) => {
    setActiveTab(tab);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    } catch {
      // ignore
    }
  };

  const privateCount = useMemo(() => {
    const q = privateQuestions?.length ?? 0;
    const d = privateDrafts?.length ?? 0;
    return q + d;
  }, [privateDrafts?.length, privateQuestions?.length]);

  return (
    <div className="mt-5 space-y-3 rounded-2xl bg-black/30 px-3 py-3 text-xs text-slate-300">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-slate-100">Deine Umfragen</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("drafts")}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition hover:-translate-y-0.5 ${
              activeTab === "drafts"
                ? "border-emerald-200/40 bg-emerald-500/15 text-emerald-50 shadow-lg shadow-emerald-500/20"
                : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/30"
            }`}
          >
            Meine Drafts
          </button>
          <button
            type="button"
            onClick={() => setTab("private")}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition hover:-translate-y-0.5 ${
              activeTab === "private"
                ? "border-emerald-200/40 bg-emerald-500/15 text-emerald-50 shadow-lg shadow-emerald-500/20"
                : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/30"
            }`}
          >
            Privat (Link){privateLoaded && privateCount > 0 ? ` (${privateCount})` : ""}
          </button>
        </div>
      </div>

      {error ? <p className="text-[11px] text-rose-200">{error}</p> : null}

      {activeTab === "drafts" ? (
        <>
          <p className="text-[11px] text-slate-400">
            Deine eingereichten Drafts sind im Review-Bereich. Sobald sie angenommen werden, landen sie in der Abstimmung.
          </p>
          {loading === "drafts" || drafts === null ? (
            <SkeletonRows rows={3} />
          ) : drafts.length === 0 ? (
            <p className="text-[11px] text-slate-400">Noch keine Drafts erstellt.</p>
          ) : (
            <div className="space-y-2">
              {drafts.map((d) => {
                const created = formatDate(d.createdAt);
                const href = `/drafts/${encodeURIComponent(d.id)}`;
                return (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-sm shadow-black/20"
                  >
                    <div className="min-w-0">
                      <Link href={href} className="block truncate text-slate-100 hover:text-white">
                        {d.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <StatusChip status={d.status} />
                        {created ? <span>{created}</span> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-[11px] text-slate-400">
            Diese Umfragen erscheinen nicht im Feed. Du kannst den Link kopieren und teilen.
          </p>
          {loading === "private" || !privateLoaded ? (
            <SkeletonRows rows={3} />
          ) : privateQuestions!.length === 0 && privateDrafts!.length === 0 ? (
            <p className="text-[11px] text-slate-400">Noch keine privaten Umfragen erstellt.</p>
          ) : (
            <div className="space-y-2">
              {privateQuestions!.map((q) => {
                const url = `${baseUrl}/p/${encodeURIComponent(q.shareId)}`;
                const created = formatDate(q.createdAt);
                return (
                  <div
                    key={q.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-sm shadow-black/20"
                  >
                    <div className="min-w-0">
                      <Link href={`/p/${encodeURIComponent(q.shareId)}`} className="block truncate text-slate-100 hover:text-white">
                        {q.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-50">
                          Abstimmung
                        </span>
                        {created ? <span>{created}</span> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ShareLinkButton url={url} label="Teilen" action="share" variant="icon" />
                      <ShareLinkButton url={url} label="Link kopieren" action="copy" variant="icon" />
                    </div>
                  </div>
                );
              })}
              {privateDrafts!.map((d) => {
                const url = `${baseUrl}/p/${encodeURIComponent(d.shareId)}`;
                const created = formatDate(d.createdAt);
                return (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-sm shadow-black/20"
                  >
                    <div className="min-w-0">
                      <Link href={`/p/${encodeURIComponent(d.shareId)}`} className="block truncate text-slate-100 hover:text-white">
                        {d.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <StatusChip status={d.status} />
                        {created ? <span>{created}</span> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ShareLinkButton url={url} label="Teilen" action="share" variant="icon" />
                      <ShareLinkButton url={url} label="Link kopieren" action="copy" variant="icon" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
