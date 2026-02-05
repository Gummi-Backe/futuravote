"use client";

import { useMemo, useState } from "react";

type AdminSettings = {
  reportQuarantineThreshold: number;
  draftMinTotalReviews: number;
  draftMinLead: number;
};

export default function SettingsClient(props: { initial: AdminSettings }) {
  const [form, setForm] = useState<AdminSettings>(props.initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = useMemo(() => {
    const i = props.initial;
    return (
      form.reportQuarantineThreshold !== i.reportQuarantineThreshold ||
      form.draftMinTotalReviews !== i.draftMinTotalReviews ||
      form.draftMinLead !== i.draftMinLead
    );
  }, [form, props.initial]);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setForm(json.settings as AdminSettings);
      setSaved(true);
    } catch (e: any) {
      setError(e?.message ?? "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
      window.setTimeout(() => setSaved(false), 2500);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-white">Auto-Quarantäne bei Meldungen</span>
          <span className="text-xs text-slate-300">
            Ab wie vielen unabhängigen Meldungen (pro Inhalt) der Inhalt für Nutzer ausgeblendet wird (Admin sieht ihn weiterhin).
          </span>
          <input
            type="number"
            min={1}
            max={50}
            value={form.reportQuarantineThreshold}
            onChange={(e) => setForm((f) => ({ ...f, reportQuarantineThreshold: Number(e.target.value) }))}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-emerald-200/30"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-white">Review: Mindestanzahl Stimmen</span>
          <span className="text-xs text-slate-300">
            Wie viele Community-Stimmen insgesamt (Gute/Schlechte Frage) mindestens nötig sind, bevor ein Vorschlag entschieden werden kann.
          </span>
          <input
            type="number"
            min={1}
            max={100}
            value={form.draftMinTotalReviews}
            onChange={(e) => setForm((f) => ({ ...f, draftMinTotalReviews: Number(e.target.value) }))}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-emerald-200/30"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-white">Review: Mindest-Vorsprung</span>
          <span className="text-xs text-slate-300">
            Um wie viele Stimmen „Gute Frage“ vor „Schlechte Frage“ liegen muss (oder umgekehrt), damit entschieden wird.
          </span>
          <input
            type="number"
            min={1}
            max={50}
            value={form.draftMinLead}
            onChange={(e) => setForm((f) => ({ ...f, draftMinLead: Number(e.target.value) }))}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-emerald-200/30"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={onSave}
          className={
            saving || !dirty
              ? "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300"
              : "rounded-full border border-emerald-200/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500/20"
          }
        >
          {saving ? "Speichere…" : "Speichern"}
        </button>

        {saved ? <span className="text-sm font-semibold text-emerald-200">Gespeichert.</span> : null}
        {error ? <span className="text-sm font-semibold text-rose-200">{error}</span> : null}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Hinweis: Änderungen wirken sofort für neue Requests. Falls du die Tabelle noch nicht angelegt hast, führe{" "}
        <code className="rounded bg-white/5 px-1 py-0.5">supabase/admin_settings.sql</code> in Supabase aus.
      </p>
    </div>
  );
}

