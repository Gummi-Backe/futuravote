type SizeToken = "xxl" | "xl" | "lg" | "sm";

function collapseSpaces(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
}

function wrapWithMarker(value: string, open: string, close: string): string {
  const match = value.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return value;
  const leading = match[1] ?? "";
  const core = match[2] ?? "";
  const trailing = match[3] ?? "";
  if (!core.trim()) return value;
  return `${leading}${open}${core}${close}${trailing}`;
}

function parseInlinePx(styleText: string): number | null {
  const match = styleText.match(/font-size\s*:\s*([0-9.]+)\s*(px|pt)?/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = (match[2] ?? "px").toLowerCase();
  if (unit === "pt") return value * 1.3333;
  return value;
}

function mapPxToSizeToken(px: number): SizeToken | null {
  if (px >= 30) return "xxl";
  if (px >= 24) return "xl";
  if (px >= 19) return "lg";
  if (px <= 12) return "sm";
  return null;
}

function getSizeTokenForElement(el: Element): SizeToken | null {
  const tag = el.tagName.toUpperCase();
  if (tag === "H1") return "xxl";
  if (tag === "H2") return "xl";
  if (tag === "H3" || tag === "H4") return "lg";

  const style = (el.getAttribute("style") ?? "").trim();
  const px = parseInlinePx(style);
  if (px) return mapPxToSizeToken(px);
  return null;
}

function isBoldElement(el: Element): boolean {
  const tag = el.tagName.toUpperCase();
  if (tag === "B" || tag === "STRONG") return true;
  const style = (el.getAttribute("style") ?? "").toLowerCase();
  const weightMatch = style.match(/font-weight\s*:\s*([^;]+)/);
  if (!weightMatch) return false;
  const raw = weightMatch[1]?.trim() ?? "";
  if (!raw) return false;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric >= 600;
  return raw.includes("bold");
}

function isUnderlineElement(el: Element): boolean {
  const tag = el.tagName.toUpperCase();
  if (tag === "U") return true;
  const style = (el.getAttribute("style") ?? "").toLowerCase();
  return /text-decoration[^;]*:\s*[^;]*underline/.test(style) || /text-decoration-line\s*:\s*underline/.test(style);
}

function isBlockElement(tag: string): boolean {
  return [
    "P",
    "DIV",
    "SECTION",
    "ARTICLE",
    "HEADER",
    "FOOTER",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "UL",
    "OL",
    "LI",
    "BLOCKQUOTE",
    "PRE",
  ].includes(tag);
}

function normalizeOutput(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function convertNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return collapseSpaces(node.nodeValue ?? "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as Element;
  const tag = el.tagName.toUpperCase();

  if (tag === "BR") return "\n";

  const children = Array.from(el.childNodes).map(convertNode).join("");
  let text = children;

  if (tag === "LI") {
    text = `- ${text.trim()}`;
  }

  const size = getSizeTokenForElement(el);
  if (size) {
    text = wrapWithMarker(text, `[size=${size}]`, "[/size]");
  }
  if (isBoldElement(el)) {
    text = wrapWithMarker(text, "**", "**");
  }
  if (isUnderlineElement(el)) {
    text = wrapWithMarker(text, "__", "__");
  }

  if (isBlockElement(tag)) {
    return `${text.trim()}\n\n`;
  }

  return text;
}

export function convertHtmlToMarkup(html: string): string {
  if (typeof window === "undefined") return "";
  const raw = String(html ?? "").trim();
  if (!raw) return "";

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "text/html");
    const body = doc.body;
    const result = Array.from(body.childNodes).map(convertNode).join("");
    return normalizeOutput(result);
  } catch {
    return "";
  }
}

