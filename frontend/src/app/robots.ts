import type { MetadataRoute } from "next";

function getSiteUrl() {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://www.future-vote.de";
  return base.replace(/\/+$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/auth/", "/profil", "/p/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

