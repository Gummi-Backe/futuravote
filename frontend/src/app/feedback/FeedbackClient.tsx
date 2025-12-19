"use client";

import { useEffect, useMemo, useState } from "react";

function buildFeedbackPayload(options: {
  message: string;
  contactEmail?: string;
  url: string;
  userAgent: string;
}) {
  const lines = [
    options.message.trim(),
    "",
    "---",
    `URL: ${options.url}`,
    `Browser: ${options.userAgent}`,
    options.contactEmail?.trim() ? `Kontakt: ${options.contactEmail.trim()}` : null,
  ].filter(Boolean) as string[];
  return lines.join("\n");
}

export function FeedbackClient() {
  const [url, setUrl] = useState<string>("");
  const [userAgent, setUserAgent] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [contactEmail, setContactEmail] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "r.kerner.developer@gmail.com";
  const formUrl = process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL?.trim() || "";

  useEffect(() => {
    if (typeof window === "undefined") return;
    setUrl(window.location.href);
    setUserAgent(window.navigator.userAgent || "");
  }, []);

  const payload = useMemo(
    () =>
      buildFeedbackPayload({
        message,
        contactEmail,
        url: url || "(unbekannt)",
        userAgent: userAgent || "(unbekannt)",
      }),
    [message, contactEmail, url, userAgent]
  );

  const mailtoHref = useMemo(() => {
    const subject = "Future‑Vote Feedback / Bug";
    const body = payload;
    return `mailto:${encodeURIComponent(supportEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [payload, supportEmail]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="fv-feedback-message" className="text-sm font-medium text-slate-100">
          Was ist passiert?
        </label>
        <textarea
          id="fv-feedback-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          className="w-full rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-3 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
          placeholder="Beschreibe kurz den Bug oder dein Feedback. Wenn möglich: was wolltest du tun, was ist passiert, was hast du erwartet?"
        />
        <p className="text-xs text-slate-400">
          Tipp: Ein Screenshot hilft oft. Den kannst du in deiner E‑Mail einfach anhängen.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="fv-feedback-contact" className="text-xs font-medium text-slate-200">
            Kontakt (optional)
          </label>
          <input
            id="fv-feedback-contact"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
            placeholder="deine@email.de"
          />
        </div>

        <div className="space-y-1">
          <span className="block text-xs font-medium text-slate-200">Seiten‑Kontext</span>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
            <div className="truncate">
              <span className="text-slate-400">URL:</span> {url || "…"}
            </div>
          </div>
          <p className="text-[11px] text-slate-500">Browser/Device wird automatisch in die Nachricht eingefügt.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={mailtoHref}
          className="inline-flex items-center justify-center rounded-xl bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-500"
        >
          E‑Mail öffnen
        </a>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(payload);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            } catch {
              setCopied(false);
            }
          }}
          className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60"
        >
          {copied ? "Kopiert" : "Text kopieren"}
        </button>
        {formUrl ? (
          <a
            href={formUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60"
          >
            Google‑Form öffnen
          </a>
        ) : null}
      </div>

      <details className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-200">
        <summary className="cursor-pointer select-none font-semibold text-slate-100">
          Vorschau (wird in die E‑Mail eingefügt)
        </summary>
        <pre className="mt-3 whitespace-pre-wrap break-words text-[11px] text-slate-300">{payload}</pre>
      </details>
    </div>
  );
}

