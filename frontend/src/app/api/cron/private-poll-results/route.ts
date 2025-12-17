import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { sendPrivatePollResultEmail } from "@/app/lib/email";

export const revalidate = 0;

function isVercelCron(request: Request): boolean {
  const header = request.headers.get("x-vercel-cron");
  return header === "1" || header === "true";
}

function getSiteUrl(requestUrl: string) {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (envBase) return envBase.replace(/\/+$/, "");
  try {
    const u = new URL(requestUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "https://www.future-vote.de";
  }
}

function formatDateGerman(dateIso?: string | null) {
  if (!dateIso) return "unbekannt";
  const ms = Date.parse(dateIso);
  if (!Number.isFinite(ms)) return dateIso;
  return new Date(ms).toLocaleDateString("de-DE", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.trunc(limitRaw))) : 50;

  const secret = process.env.FV_CRON_SECRET?.trim() ?? "";
  const providedSecret = url.searchParams.get("secret") ?? "";

  if (!isVercelCron(request) && secret && providedSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();

  const todayUtcIso = new Date().toISOString().slice(0, 10);
  const siteUrl = getSiteUrl(request.url);

  // 1) Kandidaten: private (link_only) Questions, beendet (closes_at < heute), mit creator & share id.
  const { data: questions, error: qErr } = await supabase
    .from("questions")
    .select("id, title, closes_at, yes_votes, no_votes, creator_id, share_id, visibility")
    .eq("visibility", "link_only")
    .lt("closes_at", todayUtcIso)
    .not("creator_id", "is", null)
    .not("share_id", "is", null)
    .limit(limit);

  if (qErr) {
    return NextResponse.json(
      {
        ok: false,
        error: "Konnte private Umfragen nicht laden. Fehlt das Feld `visibility` oder stimmen Policies nicht?",
        details: qErr.message,
      },
      { status: 500 }
    );
  }

  const rows = (questions ?? []) as any[];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, checked: 0, note: "Keine faelligen privaten Umfragen." });
  }

  // 2) Bereits versendet? (idempotent)
  const ids = rows.map((r) => String(r.id));
  const { data: sentRows, error: sentErr } = await supabase
    .from("private_poll_result_emails")
    .select("question_id")
    .in("question_id", ids);

  if (sentErr) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Outbox-Tabelle fehlt oder ist nicht erreichbar. Fuehre `supabase/private_poll_result_emails.sql` in Supabase aus.",
        details: sentErr.message,
      },
      { status: 500 }
    );
  }

  const alreadySent = new Set((sentRows ?? []).map((r: any) => String(r.question_id)));
  const pending = rows.filter((r) => !alreadySent.has(String(r.id)));

  let sent = 0;
  let skipped = 0;

  for (const row of pending) {
    const questionId = String(row.id);
    const creatorId = String(row.creator_id);
    const shareId = String(row.share_id);
    const title = String(row.title ?? "");

    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("email, display_name")
      .eq("id", creatorId)
      .maybeSingle();

    if (userErr || !userRow || !(userRow as any).email) {
      skipped += 1;
      continue;
    }

    const to = String((userRow as any).email);
    const displayName = String((userRow as any).display_name ?? "");
    const closesAt = String(row.closes_at ?? "");

    const pollUrl = `${siteUrl}/p/${encodeURIComponent(shareId)}`;
    const yesVotes = Number(row.yes_votes ?? 0) || 0;
    const noVotes = Number(row.no_votes ?? 0) || 0;

    try {
      await sendPrivatePollResultEmail({
        to,
        displayName,
        title,
        pollUrl,
        closesAtLabel: `Ende: ${formatDateGerman(closesAt)}`,
        yesVotes,
        noVotes,
      });

      const { error: insertErr } = await supabase.from("private_poll_result_emails").insert({
        question_id: questionId,
        creator_id: creatorId,
        to_email: to,
        share_id: shareId,
        closes_at: closesAt || null,
        yes_votes: yesVotes,
        no_votes: noVotes,
      });

      if (insertErr) {
        // Wenn parallel schon eingetragen wurde, ignorieren.
        console.warn("private_poll_result_emails insert failed", insertErr);
      }

      sent += 1;
    } catch (err) {
      console.error("Failed to send private poll result email", { questionId }, err);
      skipped += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    checked: rows.length,
    pending: pending.length,
    sent,
    skipped,
    todayUtc: todayUtcIso,
  });
}

