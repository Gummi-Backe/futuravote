import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import {
  getDraftsForCreatorFromSupabase,
  getQuestionsVotedByUserFromSupabase,
  type QuestionWithUserVote,
} from "@/app/data/dbSupabase";
import type { Draft } from "@/app/data/mock";

export const revalidate = 0;

type SearchParams = {
  typ?: string;
  category?: string;
};

type ViewConfig =
  | {
      mode: "drafts";
      typ: string;
      title: string;
      description: string;
      status: "all" | "open" | "accepted" | "rejected";
    }
  | {
      mode: "votes";
      typ: string;
      title: string;
      description: string;
      choice: "all" | "yes" | "no";
    };

function resolveViewConfig(typ?: string): ViewConfig {
  switch (typ) {
    case "drafts_accepted":
      return {
        mode: "drafts",
        typ: "drafts_accepted",
        title: "Vorgeschlagene Fragen - angenommen",
        description: "Alle deine Vorschlaege, die es in die Hauptabstimmung geschafft haben.",
        status: "accepted",
      };
    case "drafts_rejected":
      return {
        mode: "drafts",
        typ: "drafts_rejected",
        title: "Vorgeschlagene Fragen - abgelehnt",
        description: "Vorschlaege, die von der Community abgelehnt wurden.",
        status: "rejected",
      };
    case "votes_yes":
      return {
        mode: "votes",
        typ: "votes_yes",
        title: "Meine Abstimmungen - Ja",
        description: "Fragen, bei denen du mit Ja abgestimmt hast.",
        choice: "yes",
      };
    case "votes_no":
      return {
        mode: "votes",
        typ: "votes_no",
        title: "Meine Abstimmungen - Nein",
        description: "Fragen, bei denen du mit Nein abgestimmt hast.",
        choice: "no",
      };
    case "votes_all":
      return {
        mode: "votes",
        typ: "votes_all",
        title: "Meine Abstimmungen - alle",
        description: "Alle Fragen, bei denen du bereits abgestimmt hast.",
        choice: "all",
      };
    case "drafts_all":
    default:
      return {
        mode: "drafts",
        typ: "drafts_all",
        title: "Vorgeschlagene Fragen - alle",
        description: "Alle Fragen, die du bisher als Draft vorgeschlagen hast.",
        status: "all",
      };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params: SearchParams = {
    typ: url.searchParams.get("typ") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
  };

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Bitte einloggen." }, { status: 401 });
  }

  const user = await getUserBySessionSupabase(sessionId).catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Bitte einloggen." }, { status: 401 });
  }

  const config = resolveViewConfig(params.typ);
  const categoryFilter = params.category;

  let drafts: Draft[] = [];
  let questions: QuestionWithUserVote[] = [];

  if (config.mode === "drafts") {
    drafts = await getDraftsForCreatorFromSupabase({ creatorId: user.id, status: config.status });
  } else {
    questions = await getQuestionsVotedByUserFromSupabase({
      userId: user.id,
      choice: config.choice === "all" ? "all" : config.choice,
      limit: 100,
    });

    if (categoryFilter) {
      const norm = categoryFilter.toLowerCase();
      questions = questions.filter((q) => q.category.toLowerCase() === norm);
    }
  }

  return NextResponse.json({
    ok: true,
    config,
    drafts,
    questions,
    itemCount: config.mode === "drafts" ? drafts.length : questions.length,
  });
}

