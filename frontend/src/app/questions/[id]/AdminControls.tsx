"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  questionId: string;
  isArchived: boolean;
};

export default function AdminControls({ questionId, isArchived }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: "archive" | "delete") => {
    setIsSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Admin-Aktion fehlgeschlagen.");
        return;
      }
      if (action === "archive") {
        setMessage("Frage wurde gestoppt und aus dem Feed entfernt.");
        router.refresh();
      } else {
        setMessage("Frage wurde endgueltig geloescht (inkl. Bild).");
        router.push("/");
      }
    } catch {
      setError("Admin-Aktion fehlgeschlagen (Netzwerkfehler).");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-xs text-slate-100">
      <p className="font-semibold text-amber-100">Admin-Bereich</p>
      <p className="text-[11px] text-amber-100/90">
        Hier kannst du diese Frage stoppen (aus dem Feed nehmen) oder im Ausnahmefall endgueltig loeschen.
        Beim endgueltigen Loeschen werden auch zugehoerige Bilder entfernt.
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        {!isArchived && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleAction("archive")}
            className="rounded-full border border-amber-300/70 bg-amber-500/30 px-3 py-1 text-[11px] font-semibold text-amber-50 hover:bg-amber-500/40 disabled:opacity-60"
          >
            Frage stoppen
          </button>
        )}
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleAction("delete")}
          className="rounded-full border border-rose-400/70 bg-rose-500/30 px-3 py-1 text-[11px] font-semibold text-rose-50 hover:bg-rose-500/40 disabled:opacity-60"
        >
          Endgueltig loeschen
        </button>
      </div>
      {message && <p className="text-[11px] text-emerald-100">{message}</p>}
      {error && <p className="text-[11px] text-rose-200">{error}</p>}
    </div>
  );
}

