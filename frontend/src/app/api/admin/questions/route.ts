import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import {
  adminArchiveQuestionInSupabase,
  adminDeleteQuestionInSupabase,
  adminResolveQuestionInSupabase,
} from "@/app/data/dbSupabase";
import { mutationRequestGuard } from "@/app/lib/requestSecurity";

export const revalidate = 0;

type AdminQuestionBody = {
  questionId?: string;
  action?: "archive" | "delete" | "resolve";
  resolvedOutcome?: "yes" | "no";
  resolvedOptionId?: string;
  resolvedSource?: string;
  resolvedNote?: string;
};

export async function POST(request: Request) {
  const invalidSource = mutationRequestGuard(request);
  if (invalidSource) return invalidSource;

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId) : null;

  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "Nur Admins dürfen diese Aktion ausführen." },
      { status: 403 }
    );
  }

  let body: AdminQuestionBody;
  try {
    body = (await request.json()) as AdminQuestionBody;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const questionId = body.questionId?.trim();
  const action = body.action;
  if (!questionId || !action) {
    return NextResponse.json(
      { error: "Fragen-ID oder Aktion fehlt/ungültig." },
      { status: 400 }
    );
  }

  let question;
  if (action === "archive") {
    question = await adminArchiveQuestionInSupabase(questionId);
  } else if (action === "delete") {
    question = await adminDeleteQuestionInSupabase(questionId);
  } else if (action === "resolve") {
    const outcome = body.resolvedOutcome === "yes" || body.resolvedOutcome === "no" ? body.resolvedOutcome : null;
    const resolvedOptionId = (body.resolvedOptionId ?? "").trim() || null;
    const resolvedSource = (body.resolvedSource ?? "").trim() || null;
    const resolvedNote = (body.resolvedNote ?? "").trim() || null;
    question = await adminResolveQuestionInSupabase({
      id: questionId,
      outcome,
      resolvedOptionId,
      resolvedSource,
      resolvedNote,
    });
  } else {
    return NextResponse.json({ error: "Unbekannte Admin-Aktion." }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ error: "Frage nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ question });
}
