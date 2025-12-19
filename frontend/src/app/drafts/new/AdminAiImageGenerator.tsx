"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

function b64ToBlob(b64: string, mime: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function defaultPrompt(opts: { title: string; description: string }) {
  const title = (opts.title || "").trim();
  const description = (opts.description || "").trim();
  const context = description ? `Context: ${description}` : "";
  return [
    "Create a clean, modern editorial illustration for a prediction question.",
    "No text, no logos, no watermarks, no brand names, no recognizable real people, no politicians, no celebrities.",
    "High quality, neutral mood, suitable as a small card thumbnail.",
    title ? `Topic / Question: ${title}` : "",
    context,
  ]
    .filter(Boolean)
    .join("\n");
}

export function AdminAiImageGenerator({
  isAdmin,
  title,
  description,
  disabled,
  onAdoptImageFile,
}: {
  isAdmin: boolean;
  title: string;
  description: string;
  disabled: boolean;
  onAdoptImageFile: (file: File, previewUrl: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [promptTouched, setPromptTouched] = useState(false);
  const [lastAutoPrompt, setLastAutoPrompt] = useState("");
  const [size, setSize] = useState<"1024x1024" | "1024x1536" | "1536x1024">("1024x1024");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [b64, setB64] = useState<string | null>(null);
  const [mime, setMime] = useState<string>("image/png");

  const autoPrompt = useMemo(() => defaultPrompt({ title, description }), [description, title]);

  const previewDataUrl = useMemo(() => {
    if (!b64) return null;
    return `data:${mime};base64,${b64}`;
  }, [b64, mime]);

  useEffect(() => {
    if (!isAdmin) return;
    // Auto-fill prompt until the user edits it manually.
    if (promptTouched) return;
    if (prompt.trim() && prompt !== lastAutoPrompt) return;
    setPrompt(autoPrompt);
    setLastAutoPrompt(autoPrompt);
  }, [autoPrompt, isAdmin, lastAutoPrompt, prompt, promptTouched]);

  const toggleOpen = useCallback(() => {
    setOpen((v) => !v);
    if (!open) {
      // When opening: ensure the current title/description are already included (unless user edited prompt).
      if (!promptTouched || !prompt.trim() || prompt === lastAutoPrompt) {
        setPrompt(autoPrompt);
        setLastAutoPrompt(autoPrompt);
        setPromptTouched(false);
      }
    }
  }, [autoPrompt, lastAutoPrompt, open, prompt, promptTouched]);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/image-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size }),
      });
      const json: any = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Bild konnte nicht generiert werden.");
      setB64(typeof json?.b64 === "string" ? json.b64 : null);
      setMime(typeof json?.mime === "string" ? json.mime : "image/png");
    } catch (e: unknown) {
      setB64(null);
      setError(e instanceof Error ? e.message : "Bild konnte nicht generiert werden.");
    } finally {
      setLoading(false);
    }
  }, [prompt, size]);

  const adopt = useCallback(() => {
    if (!b64) return;
    const blob = b64ToBlob(b64, mime || "image/png");
    const file = new File([blob], "ai-generated.png", { type: mime || "image/png" });
    const objectUrl = URL.createObjectURL(blob);
    onAdoptImageFile(file, objectUrl);
    setOpen(false);
  }, [b64, mime, onAdoptImageFile]);

  if (!isAdmin) return null;

  return (
    <div className="mt-3 rounded-2xl border border-emerald-300/15 bg-emerald-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">Bild mit KI generieren (Admin)</div>
          <div className="mt-1 text-xs text-slate-300">
            Prompt anpassen → Bild generieren → Vorschau → übernehmen (wird wie ein normales Upload-Bild verwendet).
          </div>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={toggleOpen}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-emerald-200/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {open ? "Schließen" : "Öffnen"}
        </button>
      </div>

      {open ? (
        <div className="mt-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => {
                setPromptTouched(true);
                setPrompt(e.target.value);
              }}
              rows={6}
              className="w-full resize-none rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
              placeholder="Beschreibe das gewünschte Bild."
            />
            <div className="text-[11px] text-slate-400">
              Tipp: Keine Logos/Marken, kein Text im Bild, keine erkennbaren realen Personen.
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">Format</label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as any)}
                className="rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
              >
                <option value="1024x1024">Quadrat</option>
                <option value="1536x1024">Querformat</option>
                <option value="1024x1536">Hochformat</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={disabled || loading || prompt.trim().length < 10}
                onClick={() => void generate()}
                className="rounded-xl bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Generiere…" : "Bild generieren"}
              </button>
              {previewDataUrl ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={adopt}
                  className="rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-50 hover:border-emerald-300/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Übernehmen
                </button>
              ) : null}
            </div>
          </div>

          {error ? <div className="text-sm text-rose-200">{error}</div> : null}

          {previewDataUrl ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs font-semibold text-slate-200">Vorschau</div>
              <div className="mt-2 flex items-center justify-center overflow-hidden rounded-xl bg-black/30 p-2">
                <img src={previewDataUrl} alt="KI Vorschau" className="max-h-72 w-auto rounded-lg object-contain" />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
