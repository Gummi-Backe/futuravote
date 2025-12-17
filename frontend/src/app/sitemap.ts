import type { MetadataRoute } from "next";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

function getSiteUrl() {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://www.future-vote.de";
  return base.replace(/\/+$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/archiv`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/regeln`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/impressum`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/datenschutz`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("questions")
    .select("id, created_at, visibility")
    .eq("visibility", "public");

  if (error) {
    console.warn("sitemap: failed to load questions", error);
    return staticRoutes;
  }

  const questionRoutes: MetadataRoute.Sitemap = (data ?? [])
    .map((row: any) => {
      const id = String(row.id);
      const createdAt = typeof row.created_at === "string" ? row.created_at : null;
      const lastModified = createdAt ? new Date(createdAt) : now;

      return {
        url: `${siteUrl}/questions/${encodeURIComponent(id)}`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      };
    })
    .filter(Boolean);

  return [...staticRoutes, ...questionRoutes];
}

