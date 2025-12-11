import { NextResponse } from "next/server";
import { getQuestionsFromSupabase } from "@/app/data/dbSupabase";

export const revalidate = 0;

export async function GET() {
  try {
    const questions = await getQuestionsFromSupabase();
    return NextResponse.json({ ok: true, questions: questions.length });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "DB unavailable" },
      { status: 500 }
    );
  }
}
