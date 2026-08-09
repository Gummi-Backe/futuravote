"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isRecord } from "@/app/lib/unknownValue";

type StatusResponse = {
  ok?: boolean;
  unresolvedCount?: number;
  lastCronAt?: string | null;
  lastCronMeta?: unknown;
};

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminResolutionBanner({
  enabled,
  onOpen,
}: {
  enabled: boolean;
  onOpen: () => void;
}) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!enabled) return;
    setError(null);
    try {
      const res = await fetch("/api/admin/resolution-status", { cache: "no-store" });
      const parsed: unknown = await res.json().catch(() => null);
      const json = isRecord(parsed) ? parsed : {};
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Status konnte nicht geladen werden.");
      }
      setData(json as StatusResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status konnte nicht geladen werden.");
      setData(null);
    }
  }, [enabled]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const unresolvedCount = Number(data?.unresolvedCount ?? 0) || 0;
  const lastCronAt = useMemo(() => formatDateTime(data?.lastCronAt), [data?.lastCronAt]);

  if (!enabled) return null;
  if (error) return null;
  if (unresolvedCount <= 0) return null;

  const text = unresolvedCount === 1 ? "1 Prognose braucht Auflösung." : `${unresolvedCount} Prognosen brauchen Auflösung.`;

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-slate-100 shadow-lg shadow-amber-500/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{text}</div>
          {lastCronAt ? <div className="mt-0.5 text-[11px] text-amber-100/80">Zuletzt geprüft: {lastCronAt}</div> : null}
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-xl bg-amber-500/80 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-amber-500/30 transition hover:-translate-y-0.5 hover:bg-amber-500"
        >
          Jetzt ansehen
        </button>
      </div>
    </div>
  );
}
