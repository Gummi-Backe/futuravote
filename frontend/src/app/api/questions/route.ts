import { NextResponse } from "next/server";
import { allQuestions, draftQueue } from "../../data/mock";

export async function GET() {
  return NextResponse.json({ questions: allQuestions, drafts: draftQueue });
}
