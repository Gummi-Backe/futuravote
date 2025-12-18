"use client";

import { useMemo } from "react";
import { ShareLinkButton } from "@/app/components/ShareLinkButton";

type VoteChoice = "yes" | "no";

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function outcomeLabel(outcome: VoteChoice) {
  return outcome === "yes" ? "Ja" : "Nein";
}

export function ResolvedSuccessCard({
  title,
  url,
  resolvedOutcome,
  yesVotes,
  noVotes,
  userChoice,
  variant = "full",
}: {
  title: string;
  url: string;
  resolvedOutcome: VoteChoice;
  yesVotes: number;
  noVotes: number;
  userChoice?: VoteChoice | null;
  variant?: "full" | "compact";
}) {
  const total = Math.max(0, yesVotes + noVotes);
  const yesPct = pct(yesVotes, total);
  const noPct = 100 - yesPct;

  const communityMajority: VoteChoice | "tie" = useMemo(() => {
    if (yesVotes === noVotes) return "tie";
    return yesVotes > noVotes ? "yes" : "no";
  }, [noVotes, yesVotes]);

  const personalVerdict =
    userChoice && (userChoice === resolvedOutcome ? "richtig" : "falsch");

  const shareText = useMemo(() => {
    const parts: string[] = [];
    parts.push(`Ergebnis: ${outcomeLabel(resolvedOutcome)}.`);
    parts.push(`Community: ${yesPct}% Ja · ${noPct}% Nein (${total} Stimmen).`);
    if (personalVerdict) {
      parts.push(`Mein Tipp war ${personalVerdict}.`);
    }
    return `${title}\n${parts.join(" ")}`;
  }, [noPct, personalVerdict, resolvedOutcome, title, total, yesPct]);

  const buttonVariant = "icon";

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-emerald-200/25 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.22),transparent_60%),radial-gradient(ellipse_at_bottom,_rgba(99,102,241,0.18),transparent_60%)] p-4 shadow-[0_25px_80px_rgba(16,185,129,0.16)] backdrop-blur sm:p-6 ${
        variant === "compact" ? "py-4" : ""
      }`}
      aria-label="Ergebnis teilen"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-200/90">
            Ergebnis ist da
          </p>
          <p className="mt-1 card-title-wrap text-base font-semibold text-white">
            {title}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ShareLinkButton
            url={url}
            label="Teilen"
            variant={buttonVariant}
            shareTitle="Future‑Vote Ergebnis"
            shareText={shareText}
          />
          <ShareLinkButton
            url={url}
            label="Link kopieren"
            variant={buttonVariant}
            action="copy"
            shareTitle="Future‑Vote Ergebnis"
            shareText={shareText}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span
          className={`rounded-full border px-3 py-1 ${
            resolvedOutcome === "yes"
              ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-100"
              : "border-rose-300/30 bg-rose-500/15 text-rose-100"
          }`}
        >
          Tatsächliches Ergebnis: {outcomeLabel(resolvedOutcome)}
        </span>

        {communityMajority === "tie" ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
            Community‑Mehrheit: Unentschieden
          </span>
        ) : (
          <span
            className={`rounded-full border px-3 py-1 ${
              communityMajority === "yes"
                ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
                : "border-rose-300/20 bg-rose-500/10 text-rose-100"
            }`}
          >
            Community‑Mehrheit: {outcomeLabel(communityMajority)}
          </span>
        )}

        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
          {yesPct}% Ja · {noPct}% Nein <span className="text-slate-400">({total})</span>
        </span>

        {personalVerdict ? (
          <span
            className={`rounded-full border px-3 py-1 ${
              personalVerdict === "richtig"
                ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-50"
                : "border-amber-300/30 bg-amber-500/15 text-amber-50"
            }`}
          >
            Dein Tipp: {personalVerdict}
          </span>
        ) : null}
      </div>

      {variant !== "compact" ? (
        <p className="mt-3 text-xs text-slate-200/90">
          Teilen hilft, neue Stimmen zu sammeln — und zeigt transparent, wie die Community lag.
        </p>
      ) : null}
    </section>
  );
}
