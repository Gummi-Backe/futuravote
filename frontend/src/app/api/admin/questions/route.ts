import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  adminArchiveQuestion,
  adminDeleteQuestion,
  getUserBySession,
} from "@/app/data/db";

export const revalidate = 0;

type AdminQuestionBody = {
  questionId?: string;
  action?: "archive" | "delete";
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? getUserBySession(sessionId) : null;

  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "Nur Admins duerfen diese Aktion ausfuehren." },
      { status: 403 }
    );
  }

  let body: AdminQuestionBody;
  try {
    body = (await request.json()) as AdminQuestionBody;
  } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const questionId = body.questionId?.trim();
  const action = body.action;
  if (!questionId || !action) {
    return NextResponse.json(
      { error: "Fragen-ID oder Aktion fehlt/ungueltig." },
      { status: 400 }
    );
  }

  let question;
  if (action === "archive") {
    question = adminArchiveQuestion(questionId);
  } else if (action === "delete") {
    question = adminDeleteQuestion(questionId);
  } else {
    return NextResponse.json({ error: "Unbekannte Admin-Aktion." }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ error: "Frage nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ question });
}

