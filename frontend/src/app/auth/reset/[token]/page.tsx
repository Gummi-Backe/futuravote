"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function PasswordResetTokenPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const token = params.token;

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!password || password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Die Passwoerter stimmen nicht ueberein.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, passwordConfirm }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as any)?.error ?? "Passwort konnte nicht zurueckgesetzt werden.");
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
        <button
          type="button"
          onClick={() => router.push("/auth")}
          className="self-start text-sm text-emerald-100 hover:text-emerald-200"
        >
          &larr; Zurueck zu Login
        </button>

        <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
          <h1 className="text-2xl font-bold text-white">Neues Passwort setzen</h1>

          {success ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <p>Dein Passwort wurde aktualisiert. Bitte logge dich jetzt mit dem neuen Passwort ein.</p>
              <button
                type="button"
                onClick={() => router.push("/auth")}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900"
              >
                Zum Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="space-y-1">
                <label htmlFor="password" className="text-sm font-medium text-slate-100">
                  Neues Passwort
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 shadow-inner shadow-black/40">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent text-sm text-white outline-none"
                    placeholder="Mindestens 8 Zeichen"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="text-xs text-slate-300 hover:text-slate-100"
                  >
                    {showPassword ? "Verbergen" : "Anzeigen"}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="passwordConfirm" className="text-sm font-medium text-slate-100">
                  Passwort bestaetigen
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 shadow-inner shadow-black/40">
                  <input
                    id="passwordConfirm"
                    type={showPasswordConfirm ? "text" : "password"}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="w-full bg-transparent text-sm text-white outline-none"
                    placeholder="Passwort wiederholen"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm((prev) => !prev)}
                    className="text-xs text-slate-300 hover:text-slate-100"
                  >
                    {showPasswordConfirm ? "Verbergen" : "Anzeigen"}
                  </button>
                </div>
              </div>

              {error && <div className="text-sm text-rose-200">{error}</div>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-emerald-500/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-500 disabled:opacity-60"
              >
                {submitting ? "Speichere..." : "Passwort setzen"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}