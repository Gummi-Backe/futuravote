"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TermsContent } from "../terms/TermsContent";

type Mode = "login" | "register";

type AuthUser =
  | {
      id: string;
      email: string;
      displayName: string;
      role?: "user" | "admin";
      emailVerified?: boolean;
    }
  | null;

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [acceptTos, setAcceptTos] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser>(null);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setCurrentUser(data.user ?? null))
      .catch(() => setCurrentUser(null));
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setError("Bitte E-Mail und Passwort eingeben.");
      return;
    }

    if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".") || trimmedEmail.length < 5) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }

    if (mode === "register") {
      if (!displayName.trim()) {
        setError("Bitte gib einen Anzeige-Namen ein.");
        return;
      }
      if (password.length < 8) {
        setError("Das Passwort sollte mindestens 8 Zeichen lang sein.");
        return;
      }
      if (password !== passwordConfirm) {
        setError("Die Passwörter stimmen nicht überein.");
        return;
      }
      if (!acceptTos) {
        setError("Bitte akzeptiere die Nutzungsbedingungen.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          displayName: displayName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Anmeldung fehlgeschlagen.");
        return;
      }

      setCurrentUser(data.user ?? null);
      router.push("/");
    } catch (err) {
      console.error(err);
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
          onClick={() => router.push("/")}
          className="self-start text-sm text-emerald-100 hover:text-emerald-200"
        >
          &larr; Zurück zum Feed
        </button>

        <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
          <h1 className="text-2xl font-bold text-white">
            {mode === "login" ? "Login / Registrieren" : "Account anlegen"}
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Mit einem Account kannst du neue Fragen vorschlagen und im Review-Bereich mitentscheiden, welche Themen in
            die Hauptabstimmung übernommen werden.
          </p>

          {currentUser && (
            <div className="mt-3 space-y-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
              <p>
                Eingeloggt als <span className="font-semibold">{currentUser.displayName}</span>{" "}
                <span className="text-emerald-200">({currentUser.email})</span>. Du kannst die Seite normal nutzen oder
                dich mit einem anderen Account einloggen.
              </p>
              {currentUser.emailVerified === false && (
                <p className="text-[11px] text-amber-200">
                  Deine E-Mail-Adresse ist noch <span className="font-semibold">nicht bestätigt</span>. Bitte klicke auf
                  den Link in der Verifikations-E-Mail, die wir dir gerade geschickt haben. Ohne Bestätigung bleiben
                  manche Funktionen in Zukunft eventuell eingeschränkt.
                </p>
              )}
            </div>
          )}

          <div className="mt-4 inline-flex rounded-full bg-black/20 p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`rounded-full px-3 py-1 ${
                mode === "login" ? "bg-emerald-500/60 text-white" : "text-slate-200 hover:bg-white/10"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`rounded-full px-3 py-1 ${
                mode === "register" ? "bg-emerald-500/60 text-white" : "text-slate-200 hover:bg-white/10"
              }`}
            >
              Registrieren
            </button>
          </div>

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

            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium text-slate-100">
                Passwort
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

            {mode === "register" && (
              <>
                <div className="space-y-1">
                  <label htmlFor="passwordConfirm" className="text-sm font-medium text-slate-100">
                    Passwort bestätigen
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

                <div className="space-y-1">
                  <label htmlFor="displayName" className="text-sm font-medium text-slate-100">
                    Anzeige-Name (Nickname)
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                    placeholder="z. B. Zukunftsfan"
                  />
                </div>

                <div className="flex items-start gap-2 rounded-xl bg-black/30 px-3 py-2">
                  <input
                    id="acceptTos"
                    type="checkbox"
                    checked={acceptTos}
                    onChange={(e) => setAcceptTos(e.target.checked)}
                    className="mt-[3px] h-4 w-4 rounded border-white/40 bg-slate-900 text-emerald-500 focus:ring-emerald-400"
                  />
                  <label htmlFor="acceptTos" className="text-xs text-slate-200">
                    Ich akzeptiere die{" "}
                    <button
                      type="button"
                      onClick={() => setShowTerms(true)}
                      className="text-emerald-300 underline hover:text-emerald-200"
                    >
                      Nutzungsbedingungen
                    </button>{" "}
                    von Future-Vote und bestätige, dass ich nur Inhalte (z. B. Bilder) hochlade, an denen ich die
                    erforderlichen Rechte besitze.
                  </label>
                </div>
              </>
            )}

            {error && <p className="text-sm text-rose-300">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-xl bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-80"
            >
              {submitting
                ? mode === "login"
                  ? "Einloggen..."
                  : "Account wird erstellt..."
                : mode === "login"
                ? "Einloggen"
                : "Account erstellen"}
            </button>
          </form>
        </section>
      </div>

      {showTerms && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowTerms(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/15 bg-slate-950/95 p-6 text-slate-200 shadow-2xl shadow-black/60"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-200">
                Nutzungsbedingungen
              </h2>
              <button
                type="button"
                className="rounded-full border border-white/25 px-3 py-1 text-xs font-semibold text-slate-100 hover:border-emerald-300/60 hover:text-emerald-100"
                onClick={() => setShowTerms(false)}
              >
                Schließen
              </button>
            </div>

            <TermsContent />
          </div>
        </div>
      )}
    </main>
  );
}
