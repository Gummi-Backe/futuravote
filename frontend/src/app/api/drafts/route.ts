import { NextResponse } from "next/server";
import { createDraft } from "@/app/data/db";

export const revalidate = 0;

type DraftInput = {
  title?: string;
  description?: string;
  category?: string;
  region?: string;
  imageUrl?: string;
  timeLeftHours?: number;
};

export async function POST(request: Request) {
  let body: DraftInput;
  try {
    body = (await request.json()) as DraftInput;
  } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const category = (body.category ?? "").trim();
  const description = (body.description ?? "").trim() || undefined;
  const region = (body.region ?? "").trim() || undefined;
  const imageUrlRaw = (body.imageUrl ?? "").trim();
  const imageUrl =
    imageUrlRaw && imageUrlRaw.length > 4 && imageUrlRaw.length < 500 ? imageUrlRaw : undefined;

  if (!title) {
    return NextResponse.json({ error: "Bitte gib einen Titel ein." }, { status: 400 });
  }
  if (!category) {
    return NextResponse.json({ error: "Bitte waehle eine Kategorie." }, { status: 400 });
  }

  const timeLeftHours =
    typeof body.timeLeftHours === "number" && Number.isFinite(body.timeLeftHours) && body.timeLeftHours > 0
      ? body.timeLeftHours
      : 72;

  const draft = createDraft({ title, category, description, region, imageUrl, timeLeftHours });
  return NextResponse.json({ draft }, { status: 201 });
}
