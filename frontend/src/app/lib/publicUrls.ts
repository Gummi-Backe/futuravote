const DEFAULT_SITE_URL = "https://www.future-vote.de";

export function getPublicSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim() || DEFAULT_SITE_URL;
  return configured.replace(/\/+$/, "");
}

export function buildQuestionUrl(id: string): string {
  return `${getPublicSiteUrl()}/questions/${encodeURIComponent(id)}`;
}

export function buildDraftReviewUrl(id: string): string {
  return `${getPublicSiteUrl()}/review/drafts/${encodeURIComponent(id)}`;
}

export function buildPrivatePollUrl(shareId: string): string {
  return `${getPublicSiteUrl()}/p/${encodeURIComponent(shareId)}`;
}
