import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { createDraftInSupabase, createLinkOnlyQuestionInSupabase } from "@/app/data/dbSupabase";
import type { PollVisibility } from "@/app/data/mock";

export const revalidate = 0;

type DraftInput = {
  title?: string;
  description?: string;
  category?: string;
  region?: string;
  imageUrl?: string;
  imageCredit?: string;
  timeLeftHours?: number;
  closesAt?: string;
  visibility?: PollVisibility;
  resolutionCriteria?: string;
  resolutionSource?: string;
  resolutionDeadline?: string;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId) : null;
  if (!sessionId || !user) {
    return NextResponse.json(
      { error: "Bitte melde dich an, bevor du eine Frage vorschlägst." },
      { status: 401 }
    );
  }

  let body: DraftInput;
  try {
    body = (await request.json()) as DraftInput;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const category = (body.category ?? "").trim();
  const description = (body.description ?? "").trim() || undefined;
  const region = (body.region ?? "").trim() || undefined;
  const imageUrlRaw = (body.imageUrl ?? "").trim();
  const imageUrl =
    imageUrlRaw && imageUrlRaw.length > 4 && imageUrlRaw.length < 500 ? imageUrlRaw : undefined;
  const imageCredit = (body.imageCredit ?? "").trim() || undefined;
  const closesAtRaw = (body.closesAt ?? "").trim();
  const targetClosesAt =
    closesAtRaw && !Number.isNaN(Date.parse(closesAtRaw)) ? closesAtRaw : undefined;
  const resolutionCriteria = (body.resolutionCriteria ?? "").trim() || undefined;
  const resolutionSource = (body.resolutionSource ?? "").trim() || undefined;
  const resolutionDeadlineRaw = (body.resolutionDeadline ?? "").trim();
  const resolutionDeadline =
    resolutionDeadlineRaw && !Number.isNaN(Date.parse(resolutionDeadlineRaw)) ? resolutionDeadlineRaw : undefined;

  if (!title) {
    return NextResponse.json({ error: "Bitte gib einen Titel ein." }, { status: 400 });
  }
  if (!category) {
    return NextResponse.json({ error: "Bitte wähle eine Kategorie." }, { status: 400 });
  }

  const visibility: PollVisibility =
    body.visibility === "link_only" || body.visibility === "public" ? body.visibility : "public";

  if (visibility === "public") {
    if (!resolutionCriteria) {
      return NextResponse.json(
        { error: "Bitte beschreibe, wie die Frage aufgeloest wird (Aufloesungs-Regeln)." },
        { status: 400 }
      );
    }
    if (!resolutionSource) {
      return NextResponse.json(
        { error: "Bitte gib eine Quelle an (z. B. offizielle Seite/Institution oder Link)." },
        { status: 400 }
      );
    }
    if (!resolutionDeadline) {
      return NextResponse.json(
        { error: "Bitte setze eine Aufloesungs-Deadline (Datum/Uhrzeit)." },
        { status: 400 }
      );
    }
  }

  if (visibility === "link_only") {
    const anyResolution = Boolean(resolutionCriteria || resolutionSource || resolutionDeadline);
    if (anyResolution && !resolutionDeadline) {
      return NextResponse.json(
        { error: "Wenn du Aufloesungs-Regeln angibst, setze bitte auch eine Aufloesungs-Deadline (Datum/Uhrzeit)." },
        { status: 400 }
      );
    }
  }

  const timeLeftHours =
    typeof body.timeLeftHours === "number" && Number.isFinite(body.timeLeftHours) && body.timeLeftHours > 0
      ? body.timeLeftHours
      : 72;

  if (visibility === "link_only") {
    const question = await createLinkOnlyQuestionInSupabase({
      title,
      category,
      description,
      region,
      imageUrl,
      imageCredit,
      timeLeftHours,
      targetClosesAt,
      creatorId: user.id,
      resolutionCriteria,
      resolutionSource,
      resolutionDeadline,
    });
    return NextResponse.json({ question }, { status: 201 });
  }

  const draft = await createDraftInSupabase({
    title,
    category,
    description,
    region,
    imageUrl,
    imageCredit,
    timeLeftHours,
    targetClosesAt,
    creatorId: user.id,
    visibility,
    resolutionCriteria,
    resolutionSource,
    resolutionDeadline,
  });
  return NextResponse.json({ draft }, { status: 201 });
}
