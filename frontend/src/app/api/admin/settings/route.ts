import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getAdminSettings, updateAdminSettings } from "@/app/lib/adminSettings";
import { mutationRequestGuard } from "@/app/lib/requestSecurity";
import { getErrorMessage } from "@/app/lib/unknownValue";

export const revalidate = 0;

type SettingsBody = Partial<{
  reportQuarantineThreshold: number;
  draftMinTotalReviews: number;
  draftMinLead: number;
}>;

async function requireAdmin() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId).catch(() => null) : null;
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Nur Admins dürfen diese Route nutzen." }, { status: 403 });
  }

  const settings = await getAdminSettings();
  return NextResponse.json({ ok: true, settings }, { status: 200 });
}

export async function PUT(request: Request) {
  const invalidSource = mutationRequestGuard(request);
  if (invalidSource) return invalidSource;

  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Nur Admins dürfen diese Route nutzen." }, { status: 403 });
  }

  let body: SettingsBody;
  try {
    body = (await request.json()) as SettingsBody;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const patch: SettingsBody = {};
  if (typeof body.reportQuarantineThreshold === "number") patch.reportQuarantineThreshold = body.reportQuarantineThreshold;
  if (typeof body.draftMinTotalReviews === "number") patch.draftMinTotalReviews = body.draftMinTotalReviews;
  if (typeof body.draftMinLead === "number") patch.draftMinLead = body.draftMinLead;

  try {
    const settings = await updateAdminSettings(patch);
    return NextResponse.json({ ok: true, settings }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e, "Speichern fehlgeschlagen.") }, { status: 500 });
  }
}
