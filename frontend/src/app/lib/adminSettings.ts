import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export type AdminSettingKey =
  | "report_quarantine_threshold"
  | "draft_min_total_reviews"
  | "draft_min_lead";

export type AdminSettings = {
  reportQuarantineThreshold: number;
  draftMinTotalReviews: number;
  draftMinLead: number;
};

export const ADMIN_SETTINGS_DEFAULTS: AdminSettings = {
  reportQuarantineThreshold: 3,
  draftMinTotalReviews: 5,
  draftMinLead: 2,
};

const CACHE_TTL_MS = 60_000;
let lastLoadMs = 0;
let cached: Partial<Record<AdminSettingKey, unknown>> | null = null;

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function clampInt(value: number, min: number, max: number): number {
  const v = Math.round(value);
  return Math.min(max, Math.max(min, v));
}

async function loadRawSettings(): Promise<Partial<Record<AdminSettingKey, unknown>>> {
  const supabase = getSupabaseAdminClient();
  try {
    const { data, error } = await supabase.from("admin_settings").select("key,value");
    if (error) {
      const code = (error as any)?.code as string | undefined;
      if (code === "42P01") return {};
      return {};
    }
    const map: Partial<Record<AdminSettingKey, unknown>> = {};
    for (const row of (data as any[]) ?? []) {
      const key = String((row as any).key ?? "") as AdminSettingKey;
      if (!key) continue;
      map[key] = (row as any).value;
    }
    return map;
  } catch {
    return {};
  }
}

async function getRawSetting(key: AdminSettingKey): Promise<unknown> {
  const now = Date.now();
  if (!cached || now - lastLoadMs > CACHE_TTL_MS) {
    cached = await loadRawSettings();
    lastLoadMs = now;
  }
  return cached?.[key];
}

export async function getAdminSettings(): Promise<AdminSettings> {
  const [reportQuarantineThresholdRaw, draftMinTotalReviewsRaw, draftMinLeadRaw] = await Promise.all([
    getRawSetting("report_quarantine_threshold"),
    getRawSetting("draft_min_total_reviews"),
    getRawSetting("draft_min_lead"),
  ]);

  const reportQuarantineThreshold = clampInt(
    toNumber(reportQuarantineThresholdRaw ?? (reportQuarantineThresholdRaw as any)?.value) ??
      ADMIN_SETTINGS_DEFAULTS.reportQuarantineThreshold,
    1,
    50
  );

  const draftMinTotalReviews = clampInt(
    toNumber(draftMinTotalReviewsRaw ?? (draftMinTotalReviewsRaw as any)?.value) ??
      ADMIN_SETTINGS_DEFAULTS.draftMinTotalReviews,
    1,
    100
  );

  const draftMinLead = clampInt(
    toNumber(draftMinLeadRaw ?? (draftMinLeadRaw as any)?.value) ?? ADMIN_SETTINGS_DEFAULTS.draftMinLead,
    1,
    50
  );

  return { reportQuarantineThreshold, draftMinTotalReviews, draftMinLead };
}

export async function updateAdminSettings(patch: Partial<AdminSettings>): Promise<AdminSettings> {
  const supabase = getSupabaseAdminClient();

  const rows: { key: AdminSettingKey; value: any; updated_at: string }[] = [];
  const nowIso = new Date().toISOString();

  if (typeof patch.reportQuarantineThreshold === "number") {
    rows.push({
      key: "report_quarantine_threshold",
      value: clampInt(patch.reportQuarantineThreshold, 1, 50),
      updated_at: nowIso,
    });
  }
  if (typeof patch.draftMinTotalReviews === "number") {
    rows.push({
      key: "draft_min_total_reviews",
      value: clampInt(patch.draftMinTotalReviews, 1, 100),
      updated_at: nowIso,
    });
  }
  if (typeof patch.draftMinLead === "number") {
    rows.push({
      key: "draft_min_lead",
      value: clampInt(patch.draftMinLead, 1, 50),
      updated_at: nowIso,
    });
  }

  if (rows.length) {
    const { error } = await supabase.from("admin_settings").upsert(rows, { onConflict: "key" });
    if (error) {
      const code = (error as any)?.code as string | undefined;
      if (code === "42P01") {
        throw new Error("Supabase table 'admin_settings' fehlt. Führe supabase/admin_settings.sql aus.");
      }
      throw new Error(`Admin-Settings konnten nicht gespeichert werden: ${error.message}`);
    }
  }

  cached = null;
  lastLoadMs = 0;
  return await getAdminSettings();
}
