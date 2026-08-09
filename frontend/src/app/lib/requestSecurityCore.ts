type MutationSourceInput = {
  requestUrl: string;
  origin: string | null;
  secFetchSite: string | null;
  configuredOrigins?: Array<string | null | undefined>;
};

function parseOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isTrustedMutationSource(input: MutationSourceInput): boolean {
  if (input.secFetchSite?.toLowerCase() === "cross-site") return false;
  if (!input.origin) return true;

  const requestOrigin = parseOrigin(input.requestUrl);
  const suppliedOrigin = parseOrigin(input.origin);
  if (!requestOrigin || !suppliedOrigin) return false;

  const trustedOrigins = new Set<string>([requestOrigin]);
  for (const configured of input.configuredOrigins ?? []) {
    if (!configured) continue;
    for (const candidate of configured.split(",")) {
      const normalized = parseOrigin(candidate.trim());
      if (normalized) trustedOrigins.add(normalized);
    }
  }

  return trustedOrigins.has(suppliedOrigin);
}
