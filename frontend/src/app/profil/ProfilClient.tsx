"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileRegionForm } from "./ProfileRegionForm";
import { ProfilePollTabs } from "./ProfilePollTabs";
import { PROFILE_SUMMARY_CACHE_KEY } from "@/app/lib/profileCache";

type UserMe = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  defaultRegion: string | null;
  emailVerified: boolean;
  createdAt?: string | null;
};

type ProfileStats = {
  draftsTotal: number;
  draftsAccepted: number;
  draftsRejected: number;
  votesTotal: number;
  votesYes: number;
  votesNo: number;
  reviewsTotal: number;
  trustScorePct: number | null;
  trustScoreSample: number;
  topCategories: { category: string; votes: number; yes: number; no: number }[];
};

const PROFILE_CACHE_TTL_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "unbekannt";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "unbekannt";
  return new Date(parsed).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function readCache():
  | { user: UserMe; stats: ProfileStats; cachedAt: number }
  | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PROFILE_SUMMARY_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (typeof parsed.cachedAt !== "number") return null;
    if (!isRecord(parsed.user) || !isRecord(parsed.stats)) return null;
    return parsed as unknown as { user: UserMe; stats: ProfileStats; cachedAt: number };
  } catch {
    return null;
  }
}

function writeCache(user: UserMe, stats: ProfileStats) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      PROFILE_SUMMARY_CACHE_KEY,
      JSON.stringify({ cachedAt: Date.now(), user, stats }),
    );
  } catch {
    // ignore
  }
}

export function clearProfileCache() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PROFILE_SUMMARY_CACHE_KEY);
  } catch {
    // ignore
  }
}

function SkeletonCard() {
  return (
    <div className="mt-5 animate-pulse space-y-3 rounded-2xl bg-black/30 px-3 py-3 text-xs text-slate-300">
      <div className="h-4 w-40 rounded bg-white/10" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="h-9 rounded-full border border-white/10 bg-white/5" />
        ))}
      </div>
      <div className="h-4 w-44 rounded bg-white/10" />
    </div>
  );
}

export function ProfilClient({ baseUrl }: { baseUrl: string }) {
  const router = useRouter();
  const [user, setUser] = useState<UserMe | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const inflightRef = useRef(false);
  const hasDataRef = useRef(false);
  const initialModeRef = useRef<"foreground" | "background">("foreground");

  useEffect(() => {
    hasDataRef.current = user !== null && stats !== null;
  }, [stats, user]);

  useLayoutEffect(() => {
    // Wichtig fuer Next/React Hydration:
    // Keine sessionStorage/window Reads im initialen Render, sonst Hydration mismatch.
    const cached = readCache();
    if (cached) {
      setUser(cached.user);
      setStats(cached.stats);
      setUpdatedAt(cached.cachedAt);
      setLoading(false);
      initialModeRef.current = "background";
    } else {
      initialModeRef.current = "foreground";
    }
  }, []);

  const refresh = useCallback(
    async (mode: "foreground" | "background") => {
      if (inflightRef.current) return;
      inflightRef.current = true;

      const hasData = hasDataRef.current;
      if (mode === "foreground") {
        if (!hasData) setLoading(true);
        setError(null);
      }

      try {
        const [meRes, statsRes] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/profil/stats", { cache: "no-store" }),
        ]);

        const meJson: unknown = await meRes.json().catch(() => null);
        const meObj = isRecord(meJson) ? meJson : {};
        const meError = typeof meObj.error === "string" ? meObj.error : "Konnte Profil nicht laden.";
        if (!meRes.ok) throw new Error(meError);
        const nextUser = (isRecord(meObj.user) ? (meObj.user as unknown as UserMe) : null) as UserMe | null;
        if (!nextUser) {
          router.replace("/auth");
          return;
        }

        const statsJson: unknown = await statsRes.json().catch(() => null);
        const statsObj = isRecord(statsJson) ? statsJson : {};
        const statsError = typeof statsObj.error === "string" ? statsObj.error : "Konnte Statistiken nicht laden.";
        if (!statsRes.ok) throw new Error(statsError);
        const nextStats = statsObj as unknown as ProfileStats;

        setUser(nextUser);
        setStats(nextStats);
        const now = Date.now();
        setUpdatedAt(now);
        writeCache(nextUser, nextStats);
      } catch (e: unknown) {
        if (mode === "foreground" && !hasData) {
          const message = e instanceof Error ? e.message : "Konnte Profil nicht laden.";
          setError(message);
        }
      } finally {
        inflightRef.current = false;
        if (mode === "foreground" && !hasData) setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    void refresh(initialModeRef.current);
  }, [refresh]);

  useEffect(() => {
    if (!updatedAt) return;
    const remaining = Math.max(500, PROFILE_CACHE_TTL_MS - (Date.now() - updatedAt));
    const timer = window.setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      void refresh("background");
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [refresh, updatedAt]);

  return (
    <main className="page-enter min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-16 pt-10">
        <Link href="/" className="self-start text-sm text-emerald-100 hover:text-emerald-200">
          &larr; Zurück zum Feed
        </Link>

        <section className="mt-4 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
          <h1 className="text-2xl font-bold text-white">Dein Profil</h1>
          <p className="mt-1 text-sm text-slate-300">Hier siehst du die wichtigsten Daten zu deinem Future-Vote-Account.</p>

          {error ? (
            <p className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </p>
          ) : null}

          <div className="mt-4 space-y-3 text-sm text-slate-100">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">Anzeige-Name</span>
              <span className="font-semibold text-white">{user?.displayName ?? "…"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">E-Mail</span>
              <span className="truncate font-medium text-slate-50">{user?.email ?? "…"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">Rolle</span>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">
                {user?.role === "admin" ? "Admin" : user ? "User" : "…"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">Registriert seit</span>
              <span className="font-medium text-slate-100">{formatDate(user?.createdAt ?? null)}</span>
            </div>
          </div>

          <ProfileRegionForm initialRegion={user?.defaultRegion ?? null} />

          {stats ? (
            <div className="mt-5 space-y-3 rounded-2xl bg-black/30 px-3 py-3 text-xs text-slate-300">
              <p className="font-semibold text-slate-100">Deine Aktivität (bisher)</p>
              <div className="space-y-2">
                <Link
                  href="/profil/aktivitaet?typ=drafts_all"
                  className="group flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 shadow-sm shadow-black/20 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-emerald-500/10"
                >
                  <span className="font-medium text-slate-100 group-hover:text-white">Vorgeschlagene Fragen</span>
                  <span className="rounded-full bg-black/40 px-2 py-1 text-[11px] font-semibold text-slate-50 group-hover:bg-black/60">
                    {stats.draftsTotal}
                  </span>
                </Link>

                <Link
                  href="/profil/aktivitaet?typ=drafts_accepted"
                  className="group flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 shadow-sm shadow-black/20 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-emerald-500/10"
                >
                  <span className="font-medium text-slate-100 group-hover:text-white">Davon angenommen</span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-100 group-hover:bg-emerald-500/30">
                    {stats.draftsAccepted}
                  </span>
                </Link>

                <Link
                  href="/profil/aktivitaet?typ=drafts_rejected"
                  className="group flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 shadow-sm shadow-black/20 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-emerald-500/10"
                >
                  <span className="font-medium text-slate-100 group-hover:text-white">Davon abgelehnt</span>
                  <span className="rounded-full bg-rose-500/20 px-2 py-1 text-[11px] font-semibold text-rose-100 group-hover:bg-rose-500/30">
                    {stats.draftsRejected}
                  </span>
                </Link>

                <Link
                  href="/profil/aktivitaet?typ=votes_all"
                  className="group flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 shadow-sm shadow-black/20 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-emerald-500/10"
                >
                  <span className="font-medium text-slate-100 group-hover:text-white">Abgegebene Stimmen (gesamt)</span>
                  <span className="rounded-full bg-black/40 px-2 py-1 text-[11px] font-semibold text-slate-50 group-hover:bg-black/60">
                    {stats.votesTotal}
                  </span>
                </Link>

                <Link
                  href="/profil/aktivitaet?typ=votes_yes"
                  className="group flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 shadow-sm shadow-black/20 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-emerald-500/10"
                >
                  <span className="font-medium text-slate-100 group-hover:text-white">Davon Ja</span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-100 group-hover:bg-emerald-500/30">
                    {stats.votesYes}
                  </span>
                </Link>

                <Link
                  href="/profil/aktivitaet?typ=votes_no"
                  className="group flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 shadow-sm shadow-black/20 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-emerald-500/10"
                >
                  <span className="font-medium text-slate-100 group-hover:text-white">Davon Nein</span>
                  <span className="rounded-full bg-rose-500/20 px-2 py-1 text-[11px] font-semibold text-rose-100 group-hover:bg-rose-500/30">
                    {stats.votesNo}
                  </span>
                </Link>
              </div>

              <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
                <div className="flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 shadow-sm shadow-black/20">
                  <span className="font-medium text-slate-100">Draft-Reviews (dieses Gerät)</span>
                  <span className="rounded-full bg-black/40 px-2 py-1 text-[11px] font-semibold text-slate-50">
                    {stats.reviewsTotal}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 shadow-sm shadow-black/20">
                  <span className="font-medium text-slate-100">Vertrauens-Score</span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-100">
                    {stats.trustScorePct === null ? "-" : `${stats.trustScorePct}%`}
                  </span>
                </div>
                <p className="px-3 text-[11px] text-slate-400">
                  Der Vertrauens-Score basiert aktuell nur auf angenommen/abgelehnt bei deinen Vorschlägen (mind. 3
                  Entscheidungen nötig). Reviews zählen nur für dieses Gerät.
                </p>
              </div>

              {stats.topCategories.length > 0 ? (
                <div className="mt-2 border-t border-white/10 pt-2">
                  <p className="mb-1 font-semibold text-slate-100">Deine Top-Kategorien</p>
                  <div className="space-y-1.5">
                    {stats.topCategories.map((cat) => (
                      <div key={cat.category} className="flex items-center justify-between gap-3">
                        <span className="truncate">{cat.category}</span>
                        <span className="text-[11px] font-semibold text-slate-200">
                          {cat.votes} Stimmen{" "}
                          <span className="text-emerald-200">(Ja {cat.yes}</span>
                          <span className="text-slate-400"> · </span>
                          <span className="text-rose-200">Nein {cat.no}</span>)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : loading ? (
            <SkeletonCard />
          ) : null}

          <p className="mt-1 text-[11px] text-slate-400">
            Hinweis: Die Zahlen basieren auf Daten, die seit Einführung der Supabase-DB gesammelt werden.
          </p>

          <ProfilePollTabs baseUrl={baseUrl} />
        </section>
      </div>
    </main>
  );
}
