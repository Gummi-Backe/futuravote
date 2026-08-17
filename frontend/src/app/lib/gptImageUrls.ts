type GptImageHostEnvironment = {
  FV_GPT_ALLOWED_IMAGE_HOSTS?: string;
  FV_GPT_DEFAULT_IMAGE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
};

const SUPABASE_PUBLIC_STORAGE_PATH = "/storage/v1/object/public/";

function normalizeHost(raw: string | undefined): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

export function getAllowedGptImageHosts(
  environment: GptImageHostEnvironment = {
    FV_GPT_ALLOWED_IMAGE_HOSTS: process.env.FV_GPT_ALLOWED_IMAGE_HOSTS,
    FV_GPT_DEFAULT_IMAGE_URL: process.env.FV_GPT_DEFAULT_IMAGE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  }
): Set<string> {
  const hosts = new Set<string>();

  for (const entry of String(environment.FV_GPT_ALLOWED_IMAGE_HOSTS ?? "").split(",")) {
    const host = normalizeHost(entry);
    if (host) hosts.add(host);
  }

  for (const url of [environment.NEXT_PUBLIC_SUPABASE_URL, environment.FV_GPT_DEFAULT_IMAGE_URL]) {
    const host = normalizeHost(url);
    if (host) hosts.add(host);
  }

  return hosts;
}

export function getGptImageUrlHost(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

export function isAllowedGptImageUrl(
  rawUrl: string,
  environment: GptImageHostEnvironment = {
    FV_GPT_ALLOWED_IMAGE_HOSTS: process.env.FV_GPT_ALLOWED_IMAGE_HOSTS,
    FV_GPT_DEFAULT_IMAGE_URL: process.env.FV_GPT_DEFAULT_IMAGE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  }
): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;

    const hostname = url.hostname.toLowerCase();
    if (!getAllowedGptImageHosts(environment).has(hostname)) return false;

    // Supabase hosts must point to a public storage object, not an arbitrary endpoint.
    if (hostname.endsWith(".supabase.co")) {
      return url.pathname.includes(SUPABASE_PUBLIC_STORAGE_PATH);
    }

    return true;
  } catch {
    return false;
  }
}
