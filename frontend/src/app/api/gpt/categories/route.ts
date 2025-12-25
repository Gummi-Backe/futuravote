import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { guardGptRateLimit, withCacheHeaders } from "../_lib";

export const revalidate = 0;

type CategoryInfo = {
  category: string;
  icon: string | null;
  color: string | null;
  questionsCount: number;
  draftsCount: number;
};

function normalizeCategory(value: unknown): string | null {
  const v = typeof value === "string" ? value.trim() : "";
  return v ? v : null;
}

export async function GET(request: Request) {
  const limited = guardGptRateLimit(request);
  if (limited) return limited;

  const supabase = getSupabaseAdminClient();

  try {
    const [{ data: questionRows }, { data: draftRows }] = await Promise.all([
      supabase
        .from("questions")
        .select("category,category_icon,category_color")
        .eq("visibility", "public"),
      supabase
        .from("drafts")
        .select("category,category_icon,category_color")
        .eq("visibility", "public"),
    ]);

    const map = new Map<string, CategoryInfo>();

    for (const row of (questionRows as any[]) ?? []) {
      const cat = normalizeCategory(row?.category);
      if (!cat) continue;
      const existing =
        map.get(cat) ??
        ({
          category: cat,
          icon: typeof row?.category_icon === "string" ? row.category_icon : null,
          color: typeof row?.category_color === "string" ? row.category_color : null,
          questionsCount: 0,
          draftsCount: 0,
        } satisfies CategoryInfo);
      existing.questionsCount += 1;
      if (!existing.icon && typeof row?.category_icon === "string") existing.icon = row.category_icon;
      if (!existing.color && typeof row?.category_color === "string") existing.color = row.category_color;
      map.set(cat, existing);
    }

    for (const row of (draftRows as any[]) ?? []) {
      const cat = normalizeCategory(row?.category);
      if (!cat) continue;
      const existing =
        map.get(cat) ??
        ({
          category: cat,
          icon: typeof row?.category_icon === "string" ? row.category_icon : null,
          color: typeof row?.category_color === "string" ? row.category_color : null,
          questionsCount: 0,
          draftsCount: 0,
        } satisfies CategoryInfo);
      existing.draftsCount += 1;
      if (!existing.icon && typeof row?.category_icon === "string") existing.icon = row.category_icon;
      if (!existing.color && typeof row?.category_color === "string") existing.color = row.category_color;
      map.set(cat, existing);
    }

    const items = Array.from(map.values()).sort((a, b) => {
      const aTotal = a.questionsCount + a.draftsCount;
      const bTotal = b.questionsCount + b.draftsCount;
      if (bTotal !== aTotal) return bTotal - aTotal;
      return a.category.localeCompare(b.category);
    });

    return withCacheHeaders(NextResponse.json({ categories: items }), 60);
  } catch (error) {
    console.warn("/api/gpt/categories failed", error);
    return withCacheHeaders(NextResponse.json({ categories: [], error: "temporarily_unavailable" }), 10);
  }
}
