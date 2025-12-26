"use client";

import { useState, type FormEvent } from "react";
import { SmartBackButton } from "@/app/components/SmartBackButton";

export default function PasswordResetRequestPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (res.status === 429) {
        const json = await res.json().catch(() => ({}));
        const retryAfterMs = (json as any)?.retryAfterMs as number | undefined;
        const retry = Math.max(1, Math.ceil(((retryAfterMs ?? 60000) as number) / 1000));
        setError(`Bitte warte ${retry} Sekunde(n) und versuche es erneut.`);
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as any)?.error ?? "Passwort-Reset konnte nicht gestartet werden.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page-enter min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-16 pt-10">
        <SmartBackButton fallbackHref="/auth" label="← Zurück" />

        <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
          <h1 className="text-2xl font-bold text-white">Passwort vergessen</h1>
          <p className="mt-1 text-sm text-slate-300">
            Gib deine E-Mail-Adresse ein. Wenn ein Account existiert, senden wir dir einen Link zum Zurücksetzen.
          </p>

          {success ? (
            <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              Wenn ein Account existiert, wurde ein Reset-Link verschickt. Bitte prüfe auch den Spam-Ordner.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="space-y-1">
                <label htmlFor="email" className="text-sm font-medium text-slate-100">
                  E-Mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                  placeholder="du@example.com"
                />
              </div>

              {error && <div className="text-sm text-rose-200">{error}</div>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-emerald-500/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-500 disabled:opacity-60"
              >
                {submitting ? "Sende..." : "Reset-Link senden"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
