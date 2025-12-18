"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ShareLinkButton } from "@/app/components/ShareLinkButton";
import { PROFILE_LISTS_CACHE_KEY } from "@/app/lib/profileCache";

type Tab = "drafts" | "private" | "favorites";

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

type FavoriteQuestion = {
  id: string;
  title: string;
  category: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  region: string | null;
  closesAt: string | null;
  status: string | null;
  resolvedOutcome: string | null;
  resolvedAt: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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
  const LISTS_CACHE_TTL_MS = 30_000;

  const readListsCache = () => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.sessionStorage.getItem(PROFILE_LISTS_CACHE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) return null;
      if (typeof parsed.cachedAt !== "number") return null;
      return parsed as unknown as {
        cachedAt: number;
        drafts: MyDraft[] | null;
        privateQuestions: PrivateQuestion[] | null;
        privateDrafts: PrivateDraft[] | null;
        favorites: FavoriteQuestion[] | null;
      };
    } catch {
      return null;
    }
  };

  const writeListsCache = (value: {
    drafts: MyDraft[] | null;
    privateQuestions: PrivateQuestion[] | null;
    privateDrafts: PrivateDraft[] | null;
    favorites: FavoriteQuestion[] | null;
  }) => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(PROFILE_LISTS_CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), ...value }));
    } catch {
      // ignore
    }
  };

  const [activeTab, setActiveTab] = useState<Tab>("drafts");
  const [drafts, setDrafts] = useState<MyDraft[] | null>(null);
  const [privateQuestions, setPrivateQuestions] = useState<PrivateQuestion[] | null>(null);
  const [privateDrafts, setPrivateDrafts] = useState<PrivateDraft[] | null>(null);
  const [favorites, setFavorites] = useState<FavoriteQuestion[] | null>(null);
  const [loading, setLoading] = useState<Tab | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftsUpdatedAt, setDraftsUpdatedAt] = useState<number | null>(null);
  const [privateUpdatedAt, setPrivateUpdatedAt] = useState<number | null>(null);
  const [favoritesUpdatedAt, setFavoritesUpdatedAt] = useState<number | null>(null);
  const inflightRef = useRef<{ drafts: boolean; private: boolean; favorites: boolean }>({
    drafts: false,
    private: false,
    favorites: false,
  });

  const privateLoaded = privateQuestions !== null && privateDrafts !== null;
  const favoritesLoaded = favorites !== null;
  const draftsRef = useRef<MyDraft[] | null>(null);
  const privateQuestionsRef = useRef<PrivateQuestion[] | null>(null);
  const privateDraftsRef = useRef<PrivateDraft[] | null>(null);
  const favoritesRef = useRef<FavoriteQuestion[] | null>(null);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);
  useEffect(() => {
    privateQuestionsRef.current = privateQuestions;
  }, [privateQuestions]);
  useEffect(() => {
    privateDraftsRef.current = privateDrafts;
  }, [privateDrafts]);
  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  useLayoutEffect(() => {
    // Wichtig fuer Next/React Hydration:
    // Keine sessionStorage/window Reads im initialen Render, sonst Hydration mismatch.
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "private" || tab === "drafts" || tab === "favorites") setActiveTab(tab);
    } catch {
      // ignore
    }

    const cached = readListsCache();
    if (cached) {
      setDrafts(cached.drafts ?? null);
      setPrivateQuestions(cached.privateQuestions ?? null);
      setPrivateDrafts(cached.privateDrafts ?? null);
      setFavorites(cached.favorites ?? null);
      setDraftsUpdatedAt(cached.cachedAt);
      setPrivateUpdatedAt(cached.cachedAt);
      setFavoritesUpdatedAt(cached.cachedAt);
    }
  }, []);

  const fetchDrafts = async (mode: "foreground" | "background") => {
    if (inflightRef.current.drafts) return;
    inflightRef.current.drafts = true;
    if (mode === "foreground") {
      setLoading("drafts");
      setError(null);
    }
    try {
      const res = await fetch("/api/profil/drafts", { cache: "no-store" });
      const json: unknown = await res.json().catch(() => null);
      const obj = isRecord(json) ? json : {};
      const msg = typeof obj.error === "string" ? obj.error : "Konnte Drafts nicht laden.";
      if (!res.ok) throw new Error(msg);
      const nextDrafts = (Array.isArray(obj.drafts) ? obj.drafts : []) as MyDraft[];
      setDrafts(nextDrafts);
      const now = Date.now();
      setDraftsUpdatedAt(now);
      writeListsCache({
        drafts: nextDrafts,
        privateQuestions: privateQuestionsRef.current,
        privateDrafts: privateDraftsRef.current,
        favorites: favoritesRef.current,
      });
    } catch (e: unknown) {
      if (mode === "foreground") setError(e instanceof Error ? e.message : "Konnte Daten nicht laden.");
    } finally {
      if (mode === "foreground") setLoading(null);
      inflightRef.current.drafts = false;
    }
  };

  const fetchPrivate = async (mode: "foreground" | "background") => {
    if (inflightRef.current.private) return;
    inflightRef.current.private = true;
    if (mode === "foreground") {
      setLoading("private");
      setError(null);
    }
    try {
      const res = await fetch("/api/profil/private", { cache: "no-store" });
      const json: unknown = await res.json().catch(() => null);
      const obj = isRecord(json) ? json : {};
      const msg = typeof obj.error === "string" ? obj.error : "Konnte private Umfragen nicht laden.";
      if (!res.ok) throw new Error(msg);
      const nextPrivateQuestions = (Array.isArray(obj.privateQuestions) ? obj.privateQuestions : []) as PrivateQuestion[];
      const nextPrivateDrafts = (Array.isArray(obj.privateDrafts) ? obj.privateDrafts : []) as PrivateDraft[];
      setPrivateQuestions(nextPrivateQuestions);
      setPrivateDrafts(nextPrivateDrafts);
      const now = Date.now();
      setPrivateUpdatedAt(now);
      writeListsCache({
        drafts: draftsRef.current,
        privateQuestions: nextPrivateQuestions,
        privateDrafts: nextPrivateDrafts,
        favorites: favoritesRef.current,
      });
    } catch (e: unknown) {
      if (mode === "foreground") setError(e instanceof Error ? e.message : "Konnte Daten nicht laden.");
    } finally {
      if (mode === "foreground") setLoading(null);
      inflightRef.current.private = false;
    }
  };

  const fetchFavorites = async (mode: "foreground" | "background") => {
    if (inflightRef.current.favorites) return;
    inflightRef.current.favorites = true;
    if (mode === "foreground") {
      setLoading("favorites");
      setError(null);
    }
    try {
      const res = await fetch("/api/profil/favorites", { cache: "no-store" });
      const json: unknown = await res.json().catch(() => null);
      const obj = isRecord(json) ? json : {};
      const msg = typeof obj.error === "string" ? obj.error : "Konnte Favoriten nicht laden.";
      if (!res.ok) throw new Error(msg);
      const nextFavorites = (Array.isArray(obj.favorites) ? obj.favorites : []) as FavoriteQuestion[];
      setFavorites(nextFavorites);
      const now = Date.now();
      setFavoritesUpdatedAt(now);
      writeListsCache({
        drafts: draftsRef.current,
        privateQuestions: privateQuestionsRef.current,
        privateDrafts: privateDraftsRef.current,
        favorites: nextFavorites,
      });
    } catch (e: unknown) {
      if (mode === "foreground") setError(e instanceof Error ? e.message : "Konnte Daten nicht laden.");
    } finally {
      if (mode === "foreground") setLoading(null);
      inflightRef.current.favorites = false;
    }
  };

  useEffect(() => {
    // SWR: beim Tab-Wechsel immer refreshen (cache bleibt sichtbar)
    if (activeTab === "drafts") {
      const mode = drafts === null ? "foreground" : "background";
      void fetchDrafts(mode);
    } else if (activeTab === "private") {
      const mode = privateLoaded ? "background" : "foreground";
      void fetchPrivate(mode);
    } else {
      const mode = favoritesLoaded ? "background" : "foreground";
      void fetchFavorites(mode);
    }
    // `drafts`/`privateLoaded` absichtlich nicht in deps, sonst Re-Fetch-Loop nach State-Update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    // Auto-Revalidate nach TTL, solange die Seite offen ist.
    const tabUpdatedAt = activeTab === "drafts" ? draftsUpdatedAt : privateUpdatedAt;
    const effectiveUpdatedAt = activeTab === "favorites" ? favoritesUpdatedAt : tabUpdatedAt;
    if (!effectiveUpdatedAt) return;
    const remaining = Math.max(500, LISTS_CACHE_TTL_MS - (Date.now() - effectiveUpdatedAt));
    const timer = window.setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      if (activeTab === "drafts") void fetchDrafts("background");
      else if (activeTab === "private") void fetchPrivate("background");
      else void fetchFavorites("background");
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [activeTab, draftsUpdatedAt, privateUpdatedAt, favoritesUpdatedAt]);

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

  const handleRemoveFavorite = async (questionId: string) => {
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, action: "remove" }),
      });
      const json: unknown = await res.json().catch(() => null);
      const obj = isRecord(json) ? json : {};
      if (!res.ok) throw new Error(typeof obj.error === "string" ? obj.error : "Konnte Favorit nicht entfernen.");
      setFavorites((prev) => (prev ? prev.filter((q) => q.id !== questionId) : prev));
      const now = Date.now();
      setFavoritesUpdatedAt(now);
      writeListsCache({
        drafts: draftsRef.current,
        privateQuestions: privateQuestionsRef.current,
        privateDrafts: privateDraftsRef.current,
        favorites: (favoritesRef.current ?? []).filter((q) => q.id !== questionId),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Konnte Favorit nicht entfernen.");
    }
  };

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
          <button
            type="button"
            onClick={() => setTab("favorites")}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition hover:-translate-y-0.5 ${
              activeTab === "favorites"
                ? "border-emerald-200/40 bg-emerald-500/15 text-emerald-50 shadow-lg shadow-emerald-500/20"
                : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/30"
            }`}
          >
            Favoriten{favoritesLoaded && favorites && favorites.length > 0 ? ` (${favorites.length})` : ""}
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
        activeTab === "private" ? (
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
        ) : (
          <>
            <p className="text-[11px] text-slate-400">Hier siehst du Fragen, die du als Favorit markiert hast.</p>
            {loading === "favorites" || favorites === null ? (
              <SkeletonRows rows={3} />
            ) : favorites.length === 0 ? (
              <p className="text-[11px] text-slate-400">Noch keine Favoriten gespeichert.</p>
            ) : (
              <div className="space-y-2">
                {favorites.map((q) => {
                  const url = `${baseUrl}/questions/${encodeURIComponent(q.id)}`;
                  const created = formatDate(q.closesAt);
                  return (
                    <div
                      key={q.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-sm shadow-black/20"
                    >
                      <div className="min-w-0">
                        <Link href={`/questions/${encodeURIComponent(q.id)}`} className="block truncate text-slate-100 hover:text-white">
                          {q.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          {q.category ? (
                            <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-50">
                              {q.categoryIcon ? `${q.categoryIcon} ` : ""}{q.category}
                            </span>
                          ) : null}
                          {q.region ? <span>{q.region}</span> : null}
                          {created ? <span>Endet: {created}</span> : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <ShareLinkButton url={url} label="Teilen" action="share" variant="icon" />
                        <ShareLinkButton url={url} label="Link kopieren" action="copy" variant="icon" />
                        <button
                          type="button"
                          onClick={() => void handleRemoveFavorite(q.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-200/40 bg-amber-500/10 text-amber-100 shadow-sm shadow-amber-500/10 transition hover:-translate-y-0.5 hover:border-amber-200/60"
                          title="Aus Favoriten entfernen"
                          aria-label="Aus Favoriten entfernen"
                        >
                          <span className="text-[18px] leading-none">★</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
