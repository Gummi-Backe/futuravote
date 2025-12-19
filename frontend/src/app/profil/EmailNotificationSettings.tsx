"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PROFILE_NOTIFICATION_PREFS_CACHE_KEY } from "@/app/lib/profileCache";

type NotificationPrefs = {
  allEmailsEnabled: boolean;
  privatePollResults: boolean;
  privatePollEndingSoon: boolean;
  creatorPublicQuestionEnded: boolean;
  creatorPublicQuestionResolved: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  allEmailsEnabled: true,
  privatePollResults: true,
  privatePollEndingSoon: false,
  creatorPublicQuestionEnded: true,
  creatorPublicQuestionResolved: true,
};

const CACHE_TTL_MS = 30_000;

function readCache(): { prefs: NotificationPrefs; cachedAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PROFILE_NOTIFICATION_PREFS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { prefs?: NotificationPrefs; cachedAt?: number };
    if (!parsed?.prefs || typeof parsed.cachedAt !== "number") return null;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return { prefs: parsed.prefs, cachedAt: parsed.cachedAt };
  } catch {
    return null;
  }
}

function writeCache(prefs: NotificationPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      PROFILE_NOTIFICATION_PREFS_CACHE_KEY,
      JSON.stringify({ prefs, cachedAt: Date.now() })
    );
  } catch {
    // ignore
  }
}

export function EmailNotificationSettings() {
  const initial = useMemo(() => readCache(), []);
  const [prefs, setPrefs] = useState<NotificationPrefs>(initial?.prefs ?? DEFAULT_PREFS);
  const [loading, setLoading] = useState(!initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflightSaveRef = useRef(0);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading((prev) => prev || !initial);
    try {
      const res = await fetch("/api/profil/notifications", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        throw new Error(json?.error ?? "Konnte Einstellungen nicht laden.");
      }
      const next = (json?.prefs ?? DEFAULT_PREFS) as NotificationPrefs;
      setPrefs(next);
      writeCache(next);
    } catch (e: any) {
      setError(e?.message ?? "Konnte Einstellungen nicht laden.");
    } finally {
      setLoading(false);
    }
  }, [initial]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (next: NotificationPrefs) => {
    const token = Date.now();
    inflightSaveRef.current = token;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profil/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        throw new Error(json?.error ?? "Konnte Einstellungen nicht speichern.");
      }
      if (inflightSaveRef.current !== token) return;
      const saved = (json?.prefs ?? next) as NotificationPrefs;
      setPrefs(saved);
      writeCache(saved);
    } catch (e: any) {
      if (inflightSaveRef.current !== token) return;
      setError(e?.message ?? "Konnte Einstellungen nicht speichern.");
    } finally {
      if (inflightSaveRef.current === token) setSaving(false);
    }
  }, []);

  const setAndSave = (patch: Partial<NotificationPrefs>) => {
    const next: NotificationPrefs = { ...prefs, ...patch };
    setPrefs(next);
    writeCache(next);
    void save(next);
  };

  const masterOff = !prefs.allEmailsEnabled;

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">E-Mail-Benachrichtigungen</h2>
          <p className="mt-1 text-[11px] text-slate-400">
            Hier steuerst du optionale Benachrichtigungen. Verifikation und Passwort-Reset kommen immer an.
          </p>
        </div>
        {loading ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
            Lade…
          </span>
        ) : saving ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
            Speichere…
          </span>
        ) : (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
            Gespeichert
          </span>
        )}
      </div>

      {error ? <div className="mt-3 text-sm text-rose-200">{error}</div> : null}

      <div className="mt-4 space-y-3">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <span className="font-medium text-slate-100">Alle Benachrichtigungen per E-Mail</span>
          <input
            type="checkbox"
            checked={prefs.allEmailsEnabled}
            onChange={(e) => setAndSave({ allEmailsEnabled: e.target.checked })}
          />
        </label>

        <div className={`space-y-2 ${masterOff ? "opacity-50" : ""}`}>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="min-w-0">
              <div className="font-medium text-slate-100">Private Umfrage endet → Ergebnis</div>
              <div className="text-[11px] text-slate-400">
                Du bekommst eine E-Mail mit Ergebnis und Link, sobald deine private Umfrage endet.
              </div>
            </div>
            <input
              type="checkbox"
              checked={prefs.privatePollResults}
              disabled={masterOff}
              onChange={(e) => setAndSave({ privatePollResults: e.target.checked })}
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="min-w-0">
              <div className="font-medium text-slate-100">Erinnerung: private Umfrage endet bald</div>
              <div className="text-[11px] text-slate-400">
                Optionaler Hinweis kurz vor Ende (z.B. wenn du noch Stimmen einsammeln willst).
              </div>
            </div>
            <input
              type="checkbox"
              checked={prefs.privatePollEndingSoon}
              disabled={masterOff}
              onChange={(e) => setAndSave({ privatePollEndingSoon: e.target.checked })}
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="min-w-0">
              <div className="font-medium text-slate-100">Deine öffentliche Frage endet</div>
              <div className="text-[11px] text-slate-400">
                Hinweis an dich als Ersteller, wenn die Abstimmung vorbei ist (Enddatum erreicht).
              </div>
            </div>
            <input
              type="checkbox"
              checked={prefs.creatorPublicQuestionEnded}
              disabled={masterOff}
              onChange={(e) => setAndSave({ creatorPublicQuestionEnded: e.target.checked })}
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="min-w-0">
              <div className="font-medium text-slate-100">Deine öffentliche Frage wurde aufgelöst</div>
              <div className="text-[11px] text-slate-400">
                Du bekommst eine Mail, sobald das Ergebnis (Ja/Nein) mit Quelle eingetragen wurde.
              </div>
            </div>
            <input
              type="checkbox"
              checked={prefs.creatorPublicQuestionResolved}
              disabled={masterOff}
              onChange={(e) => setAndSave({ creatorPublicQuestionResolved: e.target.checked })}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
