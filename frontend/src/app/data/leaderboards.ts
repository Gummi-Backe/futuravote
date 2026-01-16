import "server-only";

import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export type LeaderboardView = "treffer" | "community";

export type TrefferLeaderRow = {
  userId: string;
  displayName: string;
  total: number;
  correct: number;
  incorrect: number;
  accuracyPct: number;
  pointsTotal: number;
  tier: "none" | "bronze" | "silver" | "gold";
};

export type CommunityLeaderRow = {
  userId: string;
  displayName: string;
  acceptedDrafts: number;
  comments: number;
  commentsWithSource: number;
  resolutionProposals: number;
  appliedCommunitySuggestions: number;
  emailVerifiedBonus: boolean;
  pointsTotal: number;
  tier: "none" | "bronze" | "silver" | "gold";
};

const REFERRAL_VISIT_POINTS = 10;
const REFERRAL_DAILY_CAP_POINTS = 100;

type ResolvedQuestionRow = {
  id: string;
  answer_mode: "binary" | "options" | null;
  resolved_outcome: "yes" | "no" | null;
  resolved_option_id: string | null;
};

type VoteRow = {
  user_id: string | null;
  question_id: string;
  choice: "yes" | "no" | null;
  option_id: string | null;
};

type UserRow = {
  id: string;
  display_name: string;
  email_verified?: boolean | null;
  role?: string | null;
};

function pointsTier(pointsTotal: number): "none" | "bronze" | "silver" | "gold" {
  if (pointsTotal >= 200) return "gold";
  if (pointsTotal >= 50) return "silver";
  if (pointsTotal >= 10) return "bronze";
  return "none";
}

async function fetchAdminUserIds(supabase: ReturnType<typeof getSupabaseAdminClient>): Promise<Set<string>> {
  const { data, error } = await supabase.from("users").select("id").eq("role", "admin").limit(50);
  if (error) throw new Error(`Rangliste: admin users query fehlgeschlagen: ${error.message}`);
  return new Set(((data ?? []) as any[]).map((r) => String(r.id)).filter(Boolean));
}

async function fetchAllRows<T>(options: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  table: string;
  select: string;
  filters?: (query: any) => any;
  orderBy?: { column: string; ascending: boolean };
  chunkSize?: number;
  maxRows?: number;
}): Promise<T[]> {
  const {
    supabase,
    table,
    select,
    filters,
    orderBy,
    chunkSize = 1000,
    maxRows = 20000,
  } = options;

  const result: T[] = [];
  for (let offset = 0; offset < maxRows; offset += chunkSize) {
    let query = supabase.from(table).select(select);
    if (filters) query = filters(query);
    if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending });
    query = query.range(offset, offset + chunkSize - 1);

    const { data, error } = await query;
    if (error) throw new Error(`${table}: Query fehlgeschlagen: ${error.message}`);
    const rows = (data ?? []) as T[];
    result.push(...rows);
    if (rows.length < chunkSize) break;
  }

  return result;
}

export async function getTrefferLeaderboard(options: {
  days: number;
  category: string;
  minSamples?: number;
  limit?: number;
}): Promise<{ resolvedCount: number; leaders: TrefferLeaderRow[] }> {
  const supabase = getSupabaseAdminClient();
  const adminUserIds = await fetchAdminUserIds(supabase);
  const days = Math.max(7, Math.min(365, Math.round(options.days)));
  const category = (options.category ?? "all").trim() || "all";
  const minSamples = Math.max(1, Math.min(100, Math.round(options.minSamples ?? 5)));
  const limit = Math.max(1, Math.min(100, Math.round(options.limit ?? 25)));
  const startIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let resolvedQuery = supabase
    .from("questions")
    .select("id,answer_mode,resolved_outcome,resolved_option_id", { count: "exact" })
    .eq("visibility", "public")
    .or("resolved_outcome.not.is.null,resolved_option_id.not.is.null")
    .gte("resolved_at", startIso)
    .limit(5000);

  if (category !== "all") {
    resolvedQuery = resolvedQuery.eq("category", category);
  }

  const { data: resolvedRows, error: resolvedError } = await resolvedQuery;
  if (resolvedError) {
    throw new Error(`Rangliste (Treffer): resolved questions query fehlgeschlagen: ${resolvedError.message}`);
  }

  const resolved = (resolvedRows ?? []) as ResolvedQuestionRow[];
  const resolvedByQuestionId = new Map<
    string,
    { mode: "binary"; outcome: "yes" | "no" } | { mode: "options"; optionId: string }
  >();

  resolved.forEach((q) => {
    if (!q?.id) return;
    const mode: "binary" | "options" = q.answer_mode === "options" ? "options" : "binary";
    if (mode === "binary") {
      if (q.resolved_outcome === "yes" || q.resolved_outcome === "no") {
        resolvedByQuestionId.set(q.id, { mode, outcome: q.resolved_outcome });
      }
    } else {
      if (q.resolved_option_id) {
        resolvedByQuestionId.set(q.id, { mode, optionId: q.resolved_option_id });
      }
    }
  });

  const questionIds = Array.from(resolvedByQuestionId.keys());
  if (questionIds.length === 0) return { resolvedCount: 0, leaders: [] };

  const statsByUser = new Map<string, { total: number; correct: number; incorrect: number }>();

  const chunkSize = 200;
  for (let i = 0; i < questionIds.length; i += chunkSize) {
    const chunk = questionIds.slice(i, i + chunkSize);
    const { data: voteRows, error: voteError } = await supabase
      .from("votes")
      .select("user_id,question_id,choice,option_id")
      .in("question_id", chunk)
      .not("user_id", "is", null)
      .limit(20000);

    if (voteError) {
      throw new Error(`Rangliste (Treffer): votes query fehlgeschlagen: ${voteError.message}`);
    }

    (voteRows ?? []).forEach((v) => {
      const row = v as VoteRow;
      if (!row.user_id || !row.question_id) return;
      if (adminUserIds.has(String(row.user_id))) return;
      const resolved = resolvedByQuestionId.get(row.question_id);
      if (!resolved) return;

      let isCorrect: boolean | null = null;
      if (resolved.mode === "binary") {
        if (row.choice !== "yes" && row.choice !== "no") return;
        isCorrect = row.choice === resolved.outcome;
      } else {
        if (!row.option_id) return;
        isCorrect = row.option_id === resolved.optionId;
      }

      const cur = statsByUser.get(row.user_id) ?? { total: 0, correct: 0, incorrect: 0 };
      cur.total += 1;
      if (isCorrect) cur.correct += 1;
      else cur.incorrect += 1;
      statsByUser.set(row.user_id, cur);
    });
  }

  const userIds = Array.from(statsByUser.keys());
  const userById = new Map<string, { displayName: string; role: string }>();
  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200);
    const { data: userRows, error: userError } = await supabase
      .from("users")
      .select("id,display_name,role")
      .in("id", chunk);
    if (userError) throw new Error(`Rangliste (Treffer): users query fehlgeschlagen: ${userError.message}`);
    ((userRows ?? []) as UserRow[]).forEach((u) =>
      userById.set(String(u.id), {
        displayName: String(u.display_name ?? "User"),
        role: String(u.role ?? "user"),
      })
    );
  }

  const leaders: TrefferLeaderRow[] = [];
  statsByUser.forEach((s, userId) => {
    const meta = userById.get(userId);
    if (meta?.role === "admin") return;
    if (s.total < minSamples) return;
    const accuracyPct = Math.round((s.correct / s.total) * 100);
    const pointsTotal = Math.max(0, s.correct) * 10;
    leaders.push({
      userId,
      displayName: meta?.displayName ?? "Anonym",
      total: s.total,
      correct: s.correct,
      incorrect: s.incorrect,
      accuracyPct,
      pointsTotal,
      tier: pointsTier(pointsTotal),
    });
  });

  leaders.sort((a, b) => {
    if (b.correct !== a.correct) return b.correct - a.correct;
    if (b.accuracyPct !== a.accuracyPct) return b.accuracyPct - a.accuracyPct;
    if (b.total !== a.total) return b.total - a.total;
    return a.displayName.localeCompare(b.displayName, "de");
  });

  return { resolvedCount: questionIds.length, leaders: leaders.slice(0, limit) };
}

export async function getCommunityLeaderboard(options: {
  category: string;
  limit?: number;
}): Promise<CommunityLeaderRow[]> {
  const supabase = getSupabaseAdminClient();
  const adminUserIds = await fetchAdminUserIds(supabase);
  const category = (options.category ?? "all").trim() || "all";
  const limit = Math.max(1, Math.min(100, Math.round(options.limit ?? 25)));

  const pointsByUser = new Map<
    string,
    {
      acceptedDrafts: number;
      comments: Map<string, { hasSource: boolean }>;
      resolutionProposals: number;
      appliedCommunitySuggestions: number;
      referralPoints: number;
    }
  >();

  const ensure = (userId: string) => {
    const cur =
      pointsByUser.get(userId) ??
      {
        acceptedDrafts: 0,
        comments: new Map<string, { hasSource: boolean }>(),
        resolutionProposals: 0,
        appliedCommunitySuggestions: 0,
        referralPoints: 0,
      };
    pointsByUser.set(userId, cur);
    return cur;
  };

  type DraftRow = { creator_id: string | null; status: string | null; category?: string | null };
  const acceptedDrafts = await fetchAllRows<DraftRow>({
    supabase,
    table: "drafts",
    select: "creator_id,status,category",
    filters: (q) => {
      q = q.eq("status", "accepted").not("creator_id", "is", null);
      if (category !== "all") q = q.eq("category", category);
      return q;
    },
  });
  acceptedDrafts.forEach((d) => {
    const userId = d.creator_id ? String(d.creator_id) : null;
    if (!userId) return;
    if (adminUserIds.has(userId)) return;
    ensure(userId).acceptedDrafts += 1;
  });

  type CommentRow = { user_id: string | null; question_id: string | null; source_url: string | null };
  const comments = await fetchAllRows<CommentRow>({
    supabase,
    table: "question_comments",
    select: "user_id,question_id,source_url",
    filters: (q) => q.not("user_id", "is", null),
    orderBy: { column: "created_at", ascending: false },
  });

  const categoryByQuestionId = new Map<string, string>();
  const ensureCategories = async (questionIds: string[]) => {
    if (category === "all" || questionIds.length === 0) return;
    const missing = questionIds.filter((id) => !categoryByQuestionId.has(id));
    for (let i = 0; i < missing.length; i += 400) {
      const chunk = missing.slice(i, i + 400);
      const { data: qRows, error: qErr } = await supabase.from("questions").select("id,category").in("id", chunk);
      if (qErr) throw new Error(`Rangliste (Community): questions (Kategorie) query fehlgeschlagen: ${qErr.message}`);
      ((qRows ?? []) as { id: string; category: string | null }[]).forEach((q) =>
        categoryByQuestionId.set(String(q.id), q.category ?? "Sonstiges")
      );
    }
  };

  await ensureCategories(
    Array.from(
      new Set(comments.map((c) => (c.question_id ? String(c.question_id) : null)).filter((x): x is string => Boolean(x)))
    )
  );

  comments.forEach((c) => {
    const userId = c.user_id ? String(c.user_id) : null;
    const questionId = c.question_id ? String(c.question_id) : null;
    if (!userId || !questionId) return;
    if (adminUserIds.has(userId)) return;
    if (category !== "all") {
      const qCat = categoryByQuestionId.get(questionId);
      if (qCat !== category) return;
    }
    const state = ensure(userId);
    const existing = state.comments.get(questionId) ?? { hasSource: false };
    const hasSource = Boolean(String(c.source_url ?? "").trim());
    state.comments.set(questionId, { hasSource: existing.hasSource || hasSource });
  });

  type ProposalRow = { user_id: string | null; question_id: string | null };
  const proposals = await fetchAllRows<ProposalRow>({
    supabase,
    table: "question_resolution_proposals",
    select: "user_id,question_id",
    filters: (q) => q.not("user_id", "is", null),
    orderBy: { column: "updated_at", ascending: false },
  });

  await ensureCategories(
    Array.from(
      new Set(proposals.map((p) => (p.question_id ? String(p.question_id) : null)).filter((x): x is string => Boolean(x)))
    )
  );

  proposals.forEach((p) => {
    const userId = p.user_id ? String(p.user_id) : null;
    const questionId = p.question_id ? String(p.question_id) : null;
    if (!userId || !questionId) return;
    if (adminUserIds.has(userId)) return;
    if (category !== "all") {
      const qCat = categoryByQuestionId.get(questionId);
      if (qCat !== category) return;
    }
    ensure(userId).resolutionProposals += 1;
  });

  type SuggestionRow = { created_by_user_id: string | null; question_id: string | null };
  const appliedCommunity = await fetchAllRows<SuggestionRow>({
    supabase,
    table: "question_resolution_suggestions",
    select: "created_by_user_id,question_id,source_kind,status",
    filters: (q) => q.eq("source_kind", "community").eq("status", "applied").not("created_by_user_id", "is", null),
    orderBy: { column: "created_at", ascending: false },
  });

  await ensureCategories(
    Array.from(
      new Set(
        appliedCommunity.map((s: any) => (s.question_id ? String(s.question_id) : null)).filter((x): x is string => Boolean(x))
      )
    )
  );

  appliedCommunity.forEach((s: any) => {
    const userId = s.created_by_user_id ? String(s.created_by_user_id) : null;
    const questionId = s.question_id ? String(s.question_id) : null;
    if (!userId || !questionId) return;
    if (adminUserIds.has(userId)) return;
    if (category !== "all") {
      const qCat = categoryByQuestionId.get(questionId);
      if (qCat !== category) return;
    }
    ensure(userId).appliedCommunitySuggestions += 1;
  });

  // Referral-Punkte: zählt, wenn jemand über einen geteilten Link auf eine Frage kommt.
  type ReferralRow = {
    session_id: string | null;
    created_at: string | null;
    meta: { sharerUserId?: string | null; questionId?: string | null } | null;
  };
  const referralRows = await fetchAllRows<ReferralRow>({
    supabase,
    table: "analytics_events",
    select: "session_id,created_at,meta",
    filters: (q) => q.eq("event", "referral_visit"),
    orderBy: { column: "created_at", ascending: false },
    maxRows: 20000,
  }).catch(() => []);

  const referralQuestionIds = Array.from(
    new Set(
      referralRows
        .map((r) => (r?.meta?.questionId ? String(r.meta.questionId) : null))
        .filter((x): x is string => Boolean(x))
    )
  );
  await ensureCategories(referralQuestionIds);

  const referralKeysByUserDay = new Map<string, Map<string, Set<string>>>();
  const getDayKey = (iso: string): string => {
    try {
      return new Date(iso).toISOString().slice(0, 10);
    } catch {
      return iso.slice(0, 10);
    }
  };

  referralRows.forEach((row) => {
    const sharerUserId = row?.meta?.sharerUserId ? String(row.meta.sharerUserId) : null;
    const questionId = row?.meta?.questionId ? String(row.meta.questionId) : null;
    const sessionId = row?.session_id ? String(row.session_id) : null;
    const createdAt = row?.created_at ? String(row.created_at) : null;
    if (!sharerUserId || !sessionId || !createdAt) return;
    if (adminUserIds.has(sharerUserId)) return;
    if (questionId && category !== "all") {
      const qCat = categoryByQuestionId.get(questionId);
      if (qCat !== category) return;
    } else if (category !== "all") {
      return;
    }

    const dayKey = getDayKey(createdAt);
    const userDay = referralKeysByUserDay.get(sharerUserId) ?? new Map<string, Set<string>>();
    referralKeysByUserDay.set(sharerUserId, userDay);
    const set = userDay.get(dayKey) ?? new Set<string>();
    userDay.set(dayKey, set);

    const dedupeKey = `${sessionId}|${questionId ?? ""}`;
    set.add(dedupeKey);
  });

  referralKeysByUserDay.forEach((days, userId) => {
    const state = ensure(userId);
    let points = 0;
    days.forEach((keys) => {
      const dayPoints = Math.min(keys.size * REFERRAL_VISIT_POINTS, REFERRAL_DAILY_CAP_POINTS);
      points += dayPoints;
    });
    state.referralPoints += points;
  });

  const userIds = Array.from(pointsByUser.keys());
  if (userIds.length === 0) return [];

  const userMeta = new Map<string, { displayName: string; emailVerified: boolean; role: string }>();
  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200);
    const { data: userRows, error: userError } = await supabase
      .from("users")
      .select("id,display_name,email_verified,role")
      .in("id", chunk);
    if (userError) throw new Error(`Rangliste (Community): users query fehlgeschlagen: ${userError.message}`);
    ((userRows ?? []) as UserRow[]).forEach((u) =>
      userMeta.set(String(u.id), {
        displayName: String(u.display_name ?? "User"),
        emailVerified: Boolean(u.email_verified),
        role: String(u.role ?? "user"),
      })
    );
  }

  const leaders: Array<CommunityLeaderRow & { actionPoints: number }> = userIds
    .map((userId) => {
      const s = pointsByUser.get(userId)!;
      const meta = userMeta.get(userId);
      if (meta?.role === "admin") return null;
      const commentsTotal = s.comments.size;
      const commentsWithSource = Array.from(s.comments.values()).filter((c) => c.hasSource).length;
      const commentsWithoutSource = commentsTotal - commentsWithSource;

      const emailVerifiedBonus = category === "all" && Boolean(meta?.emailVerified);
      const pointsTotal =
        (emailVerifiedBonus ? 5 : 0) +
        s.acceptedDrafts * 30 +
        commentsWithSource * 4 +
        commentsWithoutSource * 2 +
        s.resolutionProposals * 3 +
        s.appliedCommunitySuggestions * 15 +
        s.referralPoints;

      const actionPoints =
        s.acceptedDrafts * 30 +
        commentsWithSource * 4 +
        commentsWithoutSource * 2 +
        s.resolutionProposals * 3 +
        s.appliedCommunitySuggestions * 15 +
        s.referralPoints;

      return {
        userId,
        displayName: meta?.displayName ?? "User",
        acceptedDrafts: s.acceptedDrafts,
        comments: commentsTotal,
        commentsWithSource,
        resolutionProposals: s.resolutionProposals,
        appliedCommunitySuggestions: s.appliedCommunitySuggestions,
        emailVerifiedBonus,
        pointsTotal,
        tier: pointsTier(pointsTotal),
        actionPoints,
      };
    })
    .filter((r): r is CommunityLeaderRow & { actionPoints: number } => Boolean(r))
    .filter((r) => r.actionPoints > 0)
    .sort((a, b) => {
      if (b.pointsTotal !== a.pointsTotal) return b.pointsTotal - a.pointsTotal;
      if (b.acceptedDrafts !== a.acceptedDrafts) return b.acceptedDrafts - a.acceptedDrafts;
      if (b.appliedCommunitySuggestions !== a.appliedCommunitySuggestions) return b.appliedCommunitySuggestions - a.appliedCommunitySuggestions;
      if (b.comments !== a.comments) return b.comments - a.comments;
      return a.displayName.localeCompare(b.displayName, "de");
    })
    .slice(0, limit);

  return leaders.map(({ actionPoints, ...rest }) => rest);
}
