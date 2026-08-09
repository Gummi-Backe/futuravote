import type { MetadataRoute } from "next";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const dynamic = "force-dynamic";

type SitemapQuestionRow = {
  id: unknown;
  created_at: unknown;
  resolved_at: unknown;
};

function getSiteUrl() {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://www.future-vote.de";
  return base.replace(/\/+$/, "");
}

function toValidDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function latestDate(...values: unknown[]): Date | undefined {
  return values
    .map(toValidDate)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0];
}

function getStaticRoutes(siteUrl: string, latestPollChange?: Date): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, ...(latestPollChange ? { lastModified: latestPollChange } : {}) },
    { url: `${siteUrl}/archiv`, ...(latestPollChange ? { lastModified: latestPollChange } : {}) },
    { url: `${siteUrl}/regeln` },
    { url: `${siteUrl}/terms` },
    { url: `${siteUrl}/impressum` },
    { url: `${siteUrl}/datenschutz` },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const fallbackRoutes = getStaticRoutes(siteUrl);

  let supabase: ReturnType<typeof getSupabaseAdminClient>;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    console.warn("sitemap: supabase not configured, falling back to static routes", error);
    return fallbackRoutes;
  }

  const { data, error } = await supabase
    .from("questions")
    .select("id, created_at, resolved_at")
    .eq("visibility", "public");

  if (error) {
    console.warn("sitemap: failed to load questions", error);
    return fallbackRoutes;
  }

  const questionRoutes = ((data ?? []) as SitemapQuestionRow[])
    .reduce<MetadataRoute.Sitemap>((routes, row) => {
      const id = String(row.id ?? "").trim();
      if (!id) return routes;
      const lastModified = latestDate(row.created_at, row.resolved_at);
      routes.push({
        url: `${siteUrl}/questions/${encodeURIComponent(id)}`,
        ...(lastModified ? { lastModified } : {}),
      });
      return routes;
    }, [])
    .sort((a, b) => {
      const aTime = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const bTime = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return bTime - aTime;
    });

  const latestPollChange = questionRoutes[0]?.lastModified
    ? new Date(questionRoutes[0].lastModified)
    : undefined;

  return [...getStaticRoutes(siteUrl, latestPollChange), ...questionRoutes];
}
