import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getQuestionById } from "@/app/data/db";

export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const cookieStore = await cookies();
  const existingSession = cookieStore.get("fv_session")?.value;
  const sessionId = existingSession ?? randomUUID();

  const question = getQuestionById(id, sessionId);
  if (!question) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  const response = NextResponse.json({ question });
  if (!existingSession) {
    response.cookies.set("fv_session", sessionId, { path: "/", httpOnly: true, sameSite: "lax" });
  }
  return response;
}
