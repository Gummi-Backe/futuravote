import { Fragment, type ReactNode } from "react";

type SizeToken = "xxl" | "xl" | "lg" | "sm";
const LINK_CLASS =
  "underline decoration-emerald-300/70 underline-offset-2 text-emerald-300 hover:text-emerald-200 break-all";

function sizeClass(size: SizeToken): string {
  if (size === "xxl") return "text-2xl sm:text-3xl font-semibold leading-tight text-white";
  if (size === "xl") return "text-xl sm:text-2xl font-semibold leading-tight text-white";
  if (size === "lg") return "text-lg font-semibold text-white";
  return "text-xs text-slate-300";
}

function renderInline(line: string): ReactNode[] {
  const chunks = line
    .split(
      /(\[size=(?:xxl|xl|lg|sm)\][\s\S]+?\[\/size\]|\*\*[^*]+?\*\*|__[^_]+?__|\[[^\]]+?\]\((?:https?:\/\/[^\s)]+)\)|https?:\/\/[^\s<>"')\]]+)/g
    )
    .filter(Boolean);
  return chunks.map((chunk, idx) => {
    if (chunk.startsWith("[size=") && chunk.endsWith("[/size]")) {
      const match = chunk.match(/^\[size=(xxl|xl|lg|sm)\]([\s\S]*?)\[\/size\]$/);
      if (match) {
        const size = match[1] as SizeToken;
        const inner = match[2] ?? "";
        return (
          <span key={`s-${idx}`} className={sizeClass(size)}>
            {renderInline(inner)}
          </span>
        );
      }
    }
    if (chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4) {
      return (
        <strong key={`b-${idx}`} className="font-semibold text-white">
          {renderInline(chunk.slice(2, -2))}
        </strong>
      );
    }
    if (chunk.startsWith("__") && chunk.endsWith("__") && chunk.length > 4) {
      return (
        <span key={`u-${idx}`} className="underline decoration-slate-300/80 underline-offset-2">
          {renderInline(chunk.slice(2, -2))}
        </span>
      );
    }
    const markdownLinkMatch = chunk.match(/^\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)$/);
    if (markdownLinkMatch) {
      const label = markdownLinkMatch[1] ?? markdownLinkMatch[2] ?? "";
      const href = markdownLinkMatch[2] ?? "";
      return (
        <a
          key={`md-link-${idx}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={LINK_CLASS}
        >
          {label}
        </a>
      );
    }
    if (chunk.startsWith("http://") || chunk.startsWith("https://")) {
      return (
        <a
          key={`url-${idx}`}
          href={chunk}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={LINK_CLASS}
        >
          {chunk}
        </a>
      );
    }
    return <Fragment key={`t-${idx}`}>{chunk}</Fragment>;
  });
}

function renderParagraph(paragraph: string): ReactNode[] {
  const lines = paragraph.split("\n");
  return lines.map((line, idx) => (
    <Fragment key={`line-${idx}`}>
      {renderInline(line)}
      {idx < lines.length - 1 ? <br /> : null}
    </Fragment>
  ));
}

export function FormattedText(props: {
  text: string;
  className?: string;
  paragraphClassName?: string;
  maxParagraphs?: number;
}) {
  const normalized = String(props.text ?? "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return null;

  const paragraphs = normalized
    .split(/\n\s*\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, typeof props.maxParagraphs === "number" ? props.maxParagraphs : Number.MAX_SAFE_INTEGER);

  return (
    <div className={props.className}>
      {paragraphs.map((paragraph, idx) => (
        <p key={`p-${idx}`} className={props.paragraphClassName}>
          {renderParagraph(paragraph)}
        </p>
      ))}
    </div>
  );
}
