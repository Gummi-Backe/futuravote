import { NextResponse } from "next/server";
import { getQuestions } from "@/app/data/db";

export const revalidate = 0;

export async function GET() {
  try {
    const questions = getQuestions();
    return NextResponse.json({ ok: true, questions: questions.length });
  } catch {
    return NextResponse.json({ ok: false, error: "DB unavailable" }, { status: 500 });
  }
}
