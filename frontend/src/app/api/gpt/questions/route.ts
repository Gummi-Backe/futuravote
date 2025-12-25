import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const revalidate = 0;

type ListStatus = "active" | "ended" | "all";

export async function GET(request: Request) {
  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);

  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 5, 1), 20);
  const cursor = searchParams.get("cursor");
  const category = searchParams.get("category");
  const region = searchParams.get("region");
  const status = (searchParams.get("status") as ListStatus | null) ?? "active";

  const todayIso = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("questions")
    .select(
      "id,title,summary,description,category,category_icon,category_color,region,image_url,closes_at,created_at,visibility,answer_mode,is_resolvable"
    )
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status === "active") query = query.gte("closes_at", todayIso);
  if (status === "ended") query = query.lt("closes_at", todayIso);
  if (category) query = query.eq("category", category);
  if (region) query = query.eq("region", region);

  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      query = query.lt("created_at", cursorDate.toISOString());
    }
  }

  const { data: rows } = await query;

  const items =
    (rows as any[])?.map((row) => ({
      id: String(row.id),
      title: String(row.title ?? ""),
      summary: typeof row.summary === "string" ? row.summary : null,
      description: typeof row.description === "string" ? row.description : null,
      category: typeof row.category === "string" ? row.category : null,
      categoryIcon: typeof row.category_icon === "string" ? row.category_icon : null,
      categoryColor: typeof row.category_color === "string" ? row.category_color : null,
      region: typeof row.region === "string" ? row.region : null,
      imageUrl: typeof row.image_url === "string" ? row.image_url : null,
      closesAt: typeof row.closes_at === "string" ? row.closes_at : null,
      createdAt: typeof row.created_at === "string" ? row.created_at : null,
      answerMode: typeof row.answer_mode === "string" ? row.answer_mode : null,
      isResolvable: typeof row.is_resolvable === "boolean" ? row.is_resolvable : null,
    })) ?? [];

  const nextCursor =
    items.length > 0 && items[items.length - 1]?.createdAt ? String(items[items.length - 1].createdAt) : null;

  return NextResponse.json({ items, nextCursor });
}

