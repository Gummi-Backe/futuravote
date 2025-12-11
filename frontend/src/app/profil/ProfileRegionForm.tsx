"use client";

import { useState, type FormEventHandler } from "react";

type ProfileRegionFormProps = {
  initialRegion: string | null;
};

export function ProfileRegionForm({ initialRegion }: ProfileRegionFormProps) {
  const [region, setRegion] = useState(initialRegion ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const trimmed = region.trim();
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: trimmed.length > 0 ? trimmed : null }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Region konnte nicht gespeichert werden.");
      }

      const newRegion: string | null = data.user?.defaultRegion ?? null;
      setRegion(newRegion ?? "");
      setMessage(
        newRegion
          ? `Standard-Region „${newRegion}“ gespeichert.`
          : "Standard-Region entfernt. Der Feed zeigt wieder alle Regionen."
      );
    } catch {
      setError("Region konnte nicht gespeichert werden. Bitte versuche es erneut.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-3 text-sm text-slate-100">
      <div className="space-y-1">
        <label htmlFor="default-region" className="block text-slate-300">
          Standard-Region im Feed (optional)
        </label>
        <input
          id="default-region"
          type="text"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="z. B. Deutschland, Europa oder deine Stadt"
          maxLength={100}
          className="w-full rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-emerald-300/70 focus:outline-none focus:ring-1 focus:ring-emerald-400/60"
        />
        <p className="text-xs text-slate-400">
          Wenn du hier eine Region einträgst, wird der Feed automatisch darauf gefiltert, sobald du Future-Vote
          öffnest. Lässt du das Feld leer, werden wie bisher alle Regionen angezeigt.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 transition hover:-translate-y-0.5 hover:bg-emerald-400 disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {saving ? "Speichere…" : "Region speichern"}
        </button>
        <button
          type="button"
          disabled={saving || !region}
          onClick={() => setRegion("")}
          className="rounded-full border border-white/30 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-emerald-300/70 disabled:opacity-60"
        >
          Eingabe löschen
        </button>
      </div>
      {message && <p className="text-xs text-emerald-200">{message}</p>}
      {error && <p className="text-xs text-rose-200">{error}</p>}
    </form>
  );
}
