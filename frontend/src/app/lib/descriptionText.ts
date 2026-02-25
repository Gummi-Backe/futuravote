export const LONGTEXT_MARKER = "[[LANGTEXT]]";

export function splitDescriptionText(raw?: string | null): {
  shortText: string;
  longText: string | null;
} {
  const normalized = String(raw ?? "").trim();
  if (!normalized) {
    return { shortText: "", longText: null };
  }

  const markerMatch = normalized.match(/\n\s*\[\[\s*LANGTEXT\s*\]\]\s*\n/i);
  if (markerMatch && typeof markerMatch.index === "number") {
    const shortText = normalized.slice(0, markerMatch.index).trim();
    const longText = normalized.slice(markerMatch.index + markerMatch[0].length).trim();
    if (shortText && longText) {
      return { shortText, longText };
    }
  }

  const paragraphs = normalized
    .split(/\n\s*\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (paragraphs.length >= 2 && normalized.length >= 500) {
    return {
      shortText: paragraphs[0] ?? normalized,
      longText: paragraphs.slice(1).join("\n\n"),
    };
  }

  return { shortText: normalized, longText: null };
}

export function getShortDescription(raw?: string | null): string {
  return splitDescriptionText(raw).shortText;
}

