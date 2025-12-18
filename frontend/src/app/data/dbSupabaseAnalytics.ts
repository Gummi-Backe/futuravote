import "server-only";

import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export async function logAnalyticsEventServer(input: {
  event: string;
  sessionId: string;
  userId?: string | null;
  path?: string | null;
  referrer?: string | null;
  meta?: Record<string, unknown> | null;
}) {
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("analytics_events").insert({
      event: input.event,
      session_id: input.sessionId,
      user_id: input.userId ?? null,
      path: input.path ?? null,
      referrer: input.referrer ?? null,
      meta: input.meta ?? null,
    });
    if (error) {
      // 42P01 = table missing (if SQL not executed yet). We never want to break the app because of analytics.
      if ((error as any).code !== "42P01") {
        console.warn("logAnalyticsEventServer failed", error);
      }
    }
  } catch (e) {
    // never throw
    console.warn("logAnalyticsEventServer crashed", e);
  }
}

