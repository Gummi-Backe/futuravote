type FutureVoteGptLinkProps = {
  href: string;
  className?: string;
  label?: string;
};

export function FutureVoteGptLink({
  href,
  className,
  label = "Mit FutureVote GPT sprechen",
}: FutureVoteGptLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={
        className ??
        "inline-flex items-center justify-center rounded-xl border border-cyan-200/40 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-50 shadow-lg shadow-cyan-900/20 transition hover:-translate-y-0.5 hover:border-cyan-200/70 hover:bg-cyan-500/25"
      }
      title="Öffnet den FutureVote GPT mit Kontext zu dieser Umfrage"
    >
      {label}
    </a>
  );
}

