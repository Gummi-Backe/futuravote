"use client";

import {
  AtSign,
  BriefcaseBusiness,
  Check,
  Copy,
  Download,
  Mail,
  MessageCircle,
  QrCode,
  Send,
  Share2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { trackEvent, trackShare } from "@/app/lib/analytics";
import { resolveShareUrl } from "@/app/lib/referralClient";
import { addShareTracking, type ShareChannel } from "@/app/lib/shareChannels";

type ExternalShareChannel = "whatsapp" | "telegram" | "bluesky" | "linkedin" | "email";

type ShareOption = {
  channel: ExternalShareChannel;
  label: string;
  icon: LucideIcon;
  destination: (url: string, title: string) => string;
};

const SHARE_OPTIONS: ShareOption[] = [
  {
    channel: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    destination: (url, title) => `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`,
  },
  {
    channel: "telegram",
    label: "Telegram",
    icon: Send,
    destination: (url, title) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    channel: "bluesky",
    label: "Bluesky",
    icon: AtSign,
    destination: (url, title) =>
      `https://bsky.app/intent/compose?text=${encodeURIComponent(`${title}\n${url}`)}`,
  },
  {
    channel: "linkedin",
    label: "LinkedIn",
    icon: BriefcaseBusiness,
    destination: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    channel: "email",
    label: "E-Mail",
    icon: Mail,
    destination: (url, title) =>
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\r\n\r\n${url}`)}`,
  },
];

function safeFilename(title: string): string {
  const normalized = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `futurevote-${normalized || "umfrage"}-qr.png`;
}

function targetPath(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname;
  } catch {
    return url.slice(0, 200);
  }
}

export function QuestionShareMenu({
  url,
  title,
  className = "",
}: {
  url: string;
  title: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [preparedUrl, setPreparedUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPreparing(true);
    setPreparedUrl(null);
    setQrDataUrl(null);
    setError(null);

    void (async () => {
      let nextUrl: string;
      try {
        nextUrl = await resolveShareUrl(url, "share_menu");
      } catch {
        if (!cancelled) {
          setError("Teilen-Link konnte nicht vorbereitet werden.");
          setPreparing(false);
        }
        return;
      }

      if (cancelled) return;
      setPreparedUrl(nextUrl);

      try {
        const qrUrl = addShareTracking(nextUrl, "qr", window.location.origin);
        const { toDataURL } = await import("qrcode");
        const nextQrDataUrl = await toDataURL(qrUrl, {
          width: 720,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#07140f", light: "#ffffff" },
        });
        if (cancelled) return;
        setQrDataUrl(nextQrDataUrl);
      } catch {
        if (!cancelled) setError("QR-Code konnte nicht erstellt werden.");
      } finally {
        if (!cancelled) setPreparing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, url]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const shareTitle = useMemo(() => `FutureVote: ${title}`, [title]);

  const channelUrl = useCallback(
    (channel: ShareChannel) => addShareTracking(preparedUrl ?? url, channel, window.location.origin),
    [preparedUrl, url]
  );

  const openChannel = useCallback(
    (option: ShareOption) => {
      if (preparing) return;
      const trackedUrl = channelUrl(option.channel);
      const destination = option.destination(trackedUrl, shareTitle);
      trackShare("share", url, option.channel);
      if (option.channel === "email") {
        window.location.href = destination;
      } else {
        window.open(destination, "_blank", "noopener,noreferrer");
      }
    },
    [channelUrl, preparing, shareTitle, url]
  );

  const copyLink = useCallback(async () => {
    if (preparing) return;
    const trackedUrl = channelUrl("copy");
    try {
      await navigator.clipboard.writeText(trackedUrl);
      setCopied(true);
      trackShare("copy", url, "share_menu_clipboard");
    } catch {
      window.prompt("Link kopieren:", trackedUrl);
    }
  }, [channelUrl, preparing, url]);

  const nativeShare = useCallback(async () => {
    if (preparing || !canNativeShare) return;
    try {
      await navigator.share({ title: shareTitle, text: title, url: channelUrl("native") });
      trackShare("share", url, "native_menu");
    } catch (shareError: unknown) {
      if (shareError instanceof Error && shareError.name === "AbortError") return;
      setError("Der Systemdialog konnte nicht geöffnet werden.");
    }
  }, [canNativeShare, channelUrl, preparing, shareTitle, title, url]);

  const onQrDownload = useCallback(() => {
    trackEvent("qr_download", { target: targetPath(channelUrl("qr")) });
  }, [channelUrl]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300/50 bg-emerald-500/20 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/15 transition hover:-translate-y-0.5 hover:bg-emerald-500/30 ${className}`}
        aria-haspopup="dialog"
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        Teilen
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
        <div
          className="overlay-enter fixed inset-0 z-[998] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="question-share-title"
            className="overlay-panel max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-lg border border-white/15 bg-slate-950 p-4 shadow-2xl shadow-black/60 sm:p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="question-share-title" className="text-lg font-semibold text-white">
                  Umfrage teilen
                </h2>
                <p className="mt-1 line-clamp-2 text-sm text-slate-300">{title}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 hover:border-white/25 hover:text-white"
                aria-label="Teilen-Menü schließen"
                title="Schließen"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SHARE_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.channel}
                    type="button"
                    onClick={() => openChannel(option)}
                    disabled={preparing}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold text-slate-100 transition hover:border-emerald-200/35 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {option.label}
                  </button>
                );
              })}
              {canNativeShare ? (
                <button
                  type="button"
                  onClick={nativeShare}
                  disabled={preparing}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold text-slate-100 transition hover:border-emerald-200/35 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
                >
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  Weitere Apps
                </button>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={copyLink}
                disabled={preparing}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:border-emerald-200/35 disabled:cursor-wait disabled:opacity-60 sm:flex-none"
              >
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copied ? "Kopiert" : "Link kopieren"}
              </button>
              {preparing ? <span className="text-xs text-slate-400">Link wird vorbereitet...</span> : null}
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <QrCode className="h-4 w-4" aria-hidden="true" />
                QR-Code
              </div>
              <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-end">
                <div className="flex h-[220px] w-[220px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-2">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrDataUrl} alt={`QR-Code für ${title}`} className="h-full w-full" />
                  ) : (
                    <span className="text-xs font-semibold text-slate-700">Wird erstellt...</span>
                  )}
                </div>
                {qrDataUrl ? (
                  <a
                    href={qrDataUrl}
                    download={safeFilename(title)}
                    onClick={onQrDownload}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-emerald-300/45 bg-emerald-500/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500/30 sm:w-auto"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    QR-Code herunterladen
                  </a>
                ) : null}
              </div>
            </div>

            <p aria-live="polite" className={`mt-3 min-h-5 text-xs ${error ? "text-rose-200" : "text-slate-400"}`}>
              {error ?? (copied ? "Link wurde kopiert." : "")}
            </p>
          </section>
        </div>,
        document.body
      )
        : null}
    </>
  );
}
