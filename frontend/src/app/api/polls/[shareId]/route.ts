import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPollByShareIdFromSupabase } from "@/app/data/dbSupabase";

export const revalidate = 0;

type Params = { params: Promise<{ shareId: string }> };

export async function GET(_: Request, context: Params) {
  const resolvedParams = await context.params;
  const shareId = (resolvedParams.shareId ?? "").trim();
  if (!shareId) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const cookieStore = await cookies();
  const existingSession = cookieStore.get("fv_session")?.value;
  const sessionId = existingSession ?? randomUUID();

  const poll = await getPollByShareIdFromSupabase({ shareId, sessionId });
  if (!poll) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const response = NextResponse.json(poll, { status: 200 });
  if (!existingSession) {
    response.cookies.set("fv_session", sessionId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

