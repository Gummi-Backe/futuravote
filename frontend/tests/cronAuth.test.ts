import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getCronSecret, isAuthorizedCronRequest } from "../src/app/lib/cronAuth.ts";

test("cron authentication fails closed without a secret and ignores spoofable headers and URL secrets", () => {
  const request = new Request("https://example.test/api/cron/job?secret=test", { headers: { "x-vercel-cron": "1" } });
  assert.equal(isAuthorizedCronRequest(request, {}), false);
  assert.equal(isAuthorizedCronRequest(request, { FV_CRON_SECRET: "test" }), false);
});

test("only the exact configured bearer secret is accepted", () => {
  const environment = { CRON_SECRET: "current", FV_CRON_SECRET: "legacy" };
  assert.equal(getCronSecret(environment), "current");
  for (const authorization of ["Bearer legacy", "Bearer current-extra", "Bearer", "Basic current", "bearer current"]) {
    assert.equal(isAuthorizedCronRequest(new Request("https://example.test", { headers: { authorization } }), environment), false);
  }
  assert.equal(isAuthorizedCronRequest(new Request("https://example.test", { headers: { authorization: "Bearer current" } }), environment), true);
  assert.equal(isAuthorizedCronRequest(new Request("https://example.test", { headers: { authorization: "Bearer legacy" } }), { FV_CRON_SECRET: "legacy" }), true);
});

test("every scheduled route is authenticated before database work", () => {
  for (const path of ["question-metrics", "private-poll-results", "creator-notifications", "resolution-suggestions", "private-poll-reminders"]) {
    const code = readFileSync(new URL(`../src/app/api/cron/${path}/route.ts`, import.meta.url), "utf8");
    assert.match(code, /if \(!isAuthorizedCronRequest\(request\)\)/);
    assert.doesNotMatch(code, /isVercelCron|providedSecret/);
    assert.ok(code.indexOf("if (!isAuthorizedCronRequest(request))") < code.indexOf("const supabase = getSupabaseAdminClient()"));
  }
});
