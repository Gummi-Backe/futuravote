"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileRegionForm } from "./ProfileRegionForm";
import { ProfilePollTabs } from "./ProfilePollTabs";
import { PROFILE_SUMMARY_CACHE_KEY } from "@/app/lib/profileCache";
import { SmartBackButton } from "@/app/components/SmartBackButton";
import { EmailNotificationSettings } from "./EmailNotificationSettings";

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
  trackTotal: number;
  trackCorrect: number;
  trackIncorrect: number;
  trackAccuracyPct: number | null;
  trackByCategory: { category: string; total: number; correct: number; incorrect: number; accuracyPct: number | null }[];
  pointsTotal: number;
  pointsTier: "none" | "bronze" | "silver" | "gold";
  badges: { id: string; label: string; description: string }[];
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

function normalizeProfileStats(raw: unknown): ProfileStats | null {
  if (!isRecord(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const topCategories = Array.isArray(obj.topCategories) ? (obj.topCategories as any[]) : [];
  const trackByCategory = Array.isArray(obj.trackByCategory) ? (obj.trackByCategory as any[]) : [];
  const badges = Array.isArray(obj.badges) ? (obj.badges as any[]) : [];

  return {
    draftsTotal: Number(obj.draftsTotal ?? 0) || 0,
    draftsAccepted: Number(obj.draftsAccepted ?? 0) || 0,
    draftsRejected: Number(obj.draftsRejected ?? 0) || 0,
    votesTotal: Number(obj.votesTotal ?? 0) || 0,
    votesYes: Number(obj.votesYes ?? 0) || 0,
    votesNo: Number(obj.votesNo ?? 0) || 0,
    reviewsTotal: Number(obj.reviewsTotal ?? 0) || 0,
    trustScorePct: typeof obj.trustScorePct === "number" ? obj.trustScorePct : null,
    trustScoreSample: Number(obj.trustScoreSample ?? 0) || 0,
    topCategories: topCategories
      .map((c) => ({
        category: String((c as any).category ?? ""),
        votes: Number((c as any).votes ?? 0) || 0,
        yes: Number((c as any).yes ?? 0) || 0,
        no: Number((c as any).no ?? 0) || 0,
      }))
      .filter((c) => c.category),
    trackTotal: Number(obj.trackTotal ?? 0) || 0,
    trackCorrect: Number(obj.trackCorrect ?? 0) || 0,
    trackIncorrect: Number(obj.trackIncorrect ?? 0) || 0,
    trackAccuracyPct: typeof obj.trackAccuracyPct === "number" ? obj.trackAccuracyPct : null,
    trackByCategory: trackByCategory
      .map((r) => ({
        category: String((r as any).category ?? ""),
        total: Number((r as any).total ?? 0) || 0,
        correct: Number((r as any).correct ?? 0) || 0,
        incorrect: Number((r as any).incorrect ?? 0) || 0,
        accuracyPct: typeof (r as any).accuracyPct === "number" ? (r as any).accuracyPct : null,
      }))
      .filter((r) => r.category),
    pointsTotal: Number(obj.pointsTotal ?? 0) || 0,
    pointsTier:
      obj.pointsTier === "bronze" || obj.pointsTier === "silver" || obj.pointsTier === "gold" ? obj.pointsTier : "none",
    badges: badges
      .map((b) => ({
        id: String((b as any).id ?? ""),
        label: String((b as any).label ?? ""),
        description: String((b as any).description ?? ""),
      }))
      .filter((b) => b.id && b.label),
  };
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
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteAcknowledge, setDeleteAcknowledge] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const inflightRef = useRef(false);
  const hasDataRef = useRef(false);
  const initialModeRef = useRef<"foreground" | "background">("foreground");

  const canDeleteAccount =
    !!user &&
    deleteAcknowledge &&
    deletePassword.trim().length > 0 &&
    deleteConfirmText.trim().toUpperCase() === "LÖSCHEN" &&
    !deleteSubmitting;

  const deleteAccount = useCallback(async () => {
    if (!canDeleteAccount) return;
    setDeleteError(null);
    setDeleteSubmitting(true);
    try {
      const res = await fetch("/api/profil/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: deletePassword,
          confirmText: deleteConfirmText,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) {
        setDeleteError(typeof data?.error === "string" ? data.error : "Account konnte nicht gelöscht werden.");
        return;
      }

      setDeleteSuccess(true);
      try {
        window.sessionStorage.removeItem(PROFILE_SUMMARY_CACHE_KEY);
      } catch {
        // ignore
      }
      router.push("/");
    } catch {
      setDeleteError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setDeleteSubmitting(false);
    }
  }, [canDeleteAccount, deleteConfirmText, deletePassword, router]);

  useEffect(() => {
    hasDataRef.current = user !== null && stats !== null;
  }, [stats, user]);

  useLayoutEffect(() => {
    // Wichtig fuer Next/React Hydration:
    // Keine sessionStorage/window Reads im initialen Render, sonst Hydration mismatch.
    const cached = readCache();
    if (cached) {
      setUser(cached.user);
      setStats(normalizeProfileStats(cached.stats) ?? cached.stats);
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
        const nextStats = normalizeProfileStats(statsObj) ?? (statsObj as unknown as ProfileStats);

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
        <SmartBackButton
          fallbackHref="/"
          label="← Zurück"
        />

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
              <span className="font-semibold text-white">{user?.displayName ?? "â€¦"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">E-Mail</span>
              <span className="truncate font-medium text-slate-50">{user?.email ?? "â€¦"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">Rolle</span>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">
                {user?.role === "admin" ? "Admin" : user ? "User" : "â€¦"}
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

              <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
                <div className="flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 shadow-sm shadow-black/20">
                  <span className="font-medium text-slate-100">Dein Track Record</span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-100">
                    {stats.trackAccuracyPct === null ? "-" : `${stats.trackAccuracyPct}%`}
                  </span>
                </div>
                <p className="px-3 text-[11px] text-slate-400">
                  {stats.trackTotal <= 0
                    ? "Noch keine aufgelösten Fragen, bei denen du abgestimmt hast."
                    : `${stats.trackCorrect} richtig · ${stats.trackIncorrect} falsch (${stats.trackTotal} entschieden)`}
                </p>

                <div className="px-3 pt-1 text-[11px] text-slate-300">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-100">Punkte</span>
                    <span className="font-semibold text-slate-200">
                      {stats.pointsTotal}
                      {stats.pointsTier !== "none" ? (
                        <span className="text-slate-400">
                          {" "}
                          · {stats.pointsTier === "bronze" ? "Bronze" : stats.pointsTier === "silver" ? "Silber" : "Gold"}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-400">10 Punkte pro richtige Prognose nach Auflösung.</p>
                </div>

                {stats.badges?.length ? (
                  <div className="px-3 pt-1">
                    <p className="mb-1 font-semibold text-slate-100">Badges</p>
                    <div className="flex flex-wrap gap-2">
                      {stats.badges.map((b) => (
                        <span
                          key={b.id}
                          title={b.description}
                          className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-100"
                        >
                          {b.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {stats.trackByCategory?.length ? (
                  <div className="px-3 pt-1 text-[11px] text-slate-300">
                    <p className="mb-1 font-semibold text-slate-100">Top-Kategorien (Trefferquote)</p>
                    <div className="space-y-1">
                      {stats.trackByCategory.slice(0, 3).map((row) => (
                        <div key={row.category} className="flex items-center justify-between gap-3">
                          <span className="truncate">{row.category}</span>
                          <span className="font-semibold text-slate-200">
                            {row.accuracyPct === null ? "-" : `${row.accuracyPct}%`}{" "}
                            <span className="text-slate-400">·</span> {row.total}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
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

          <EmailNotificationSettings />

          <ProfilePollTabs baseUrl={baseUrl} />

          <div className="mt-8 rounded-3xl border border-rose-400/30 bg-rose-500/10 p-6 shadow-2xl shadow-rose-500/10 backdrop-blur">
            <h2 className="text-lg font-bold text-rose-100">Account löschen</h2>
            <p className="mt-2 text-sm text-slate-200">
              Wenn du deinen Account löschst, werden deine personenbezogenen Daten dauerhaft entfernt. Öffentliche Inhalte (z. B.
              Abstimmungen, Fragen oder Kommentare) können aus Gründen der Nachvollziehbarkeit anonymisiert bestehen bleiben (ohne Bezug
              zu deiner Person).
            </p>

            {deleteSuccess ? (
              <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                Account wurde gelöscht. Du wirst abgemeldet…
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <label className="flex items-start gap-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={deleteAcknowledge}
                    onChange={(e) => setDeleteAcknowledge(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-white/40 bg-slate-900 text-rose-500 focus:ring-rose-400"
                  />
                  <span>
                    Ich verstehe, dass das Löschen nicht rückgängig gemacht werden kann.
                    <span className="block text-xs text-slate-400">Tipp: Wenn du unsicher bist, melde dich vorher per Feedback.</span>
                  </span>
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-100" htmlFor="deletePassword">
                      Passwort bestätigen
                    </label>
                    <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 shadow-inner shadow-black/40">
                      <input
                        id="deletePassword"
                        type={showDeletePassword ? "text" : "password"}
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        className="w-full bg-transparent text-sm text-white outline-none"
                        placeholder="Dein Passwort"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDeletePassword((prev) => !prev)}
                        className="text-xs font-semibold text-slate-300 hover:text-slate-100"
                      >
                        {showDeletePassword ? "Verbergen" : "Anzeigen"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-100" htmlFor="deleteConfirmText">
                      Zur Bestätigung tippen
                    </label>
                    <input
                      id="deleteConfirmText"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-rose-300"
                      placeholder="LÖSCHEN"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    <p className="text-xs text-slate-400">Bitte exakt: LÖSCHEN</p>
                  </div>
                </div>

                {deleteError ? <p className="text-sm font-semibold text-rose-200">{deleteError}</p> : null}

                <button
                  type="button"
                  onClick={deleteAccount}
                  disabled={!canDeleteAccount}
                  className="w-full rounded-xl border border-rose-300/40 bg-rose-500/20 px-4 py-3 text-sm font-bold text-rose-100 shadow-lg shadow-rose-500/10 transition hover:-translate-y-0.5 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteSubmitting ? "Lösche Account…" : "Account endgültig löschen"}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
