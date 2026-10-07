import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { callFutureVoteTextAi } from "../src/app/lib/futureVoteTextAi.ts";

function completed(content = '{"suggestions":[]}') {
  return {
    status: "completed",
    output: [
      { type: "reasoning", content: [{ type: "output_text", text: "Do not parse reasoning" }] },
      { type: "web_search_call", status: "completed" },
      { type: "message", role: "assistant", content: [{ type: "output_text", text: content }] },
    ],
  };
}

test("FutureVote uses only GPT-6.1 Sol xhigh with researched JSON and enough reasoning tokens", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async (url, init) => {
    calls += 1;
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "gpt-6.1-sol");
    assert.deepEqual(body.reasoning, { effort: "xhigh" });
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 32_768 + 4_200);
    assert.equal(body.max_tool_calls, 6);
    assert.deepEqual(body.tools, [{ type: "web_search" }]);
    assert.equal(body.tool_choice, "required");
    assert.deepEqual(body.text.format, { type: "json_object" });
    assert.equal(body.temperature, undefined);
    assert.equal(body.messages, undefined);
    assert.equal(init?.cache, "no-store");
    assert.ok(init?.signal);
    return Response.json(completed());
  };
  assert.deepEqual(await callFutureVoteTextAi({ apiKey: "test", prompt: "JSON", maxTokens: 4_200, fetchImpl }), {
    ok: true, content: '{"suggestions":[]}', finishReason: "completed",
  });
  assert.equal(calls, 1);
});

test("incomplete, unresearched, malformed and refused responses are not accepted", async () => {
  for (const response of [
    { ...completed(), status: "incomplete", incomplete_details: { reason: "max_output_tokens" } },
    { ...completed(), status: "failed" },
    { status: "completed", output: [] },
    completed("not JSON"),
    completed("[]"),
    { ...completed(), output: [{ type: "web_search_call", status: "completed" }, { type: "message", role: "assistant", content: [{ type: "refusal", refusal: "no" }] }] },
  ]) {
    const result = await callFutureVoteTextAi({ apiKey: "test", prompt: "JSON", maxTokens: 700, fetchImpl: async () => Response.json(response) });
    assert.equal(result.ok, false);
  }
});

test("API failures are redacted and never trigger automatic paid retries", async () => {
  for (const status of [401, 403, 404, 429, 500]) {
    let calls = 0;
    const result = await callFutureVoteTextAi({ apiKey: "secret", prompt: "JSON", maxTokens: 700, fetchImpl: async () => {
      calls += 1;
      return Response.json({ error: { message: "secret" } }, { status });
    } });
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(!result.error.includes("secret"));
    assert.equal(calls, 1);
  }
});

test("timeouts cancel the provider call and missing keys do not call it", async () => {
  const result = await callFutureVoteTextAi({ apiKey: "test", prompt: "JSON", maxTokens: 700, timeoutMs: 5, fetchImpl: async (_url, init) => {
    return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
  } });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Zeitlimit/);
  const forbiddenFetch: typeof fetch = async () => { throw new Error("must not call"); };
  assert.equal((await callFutureVoteTextAi({ apiKey: "", prompt: "JSON", maxTokens: 700, fetchImpl: forbiddenFetch })).ok, false);
  assert.equal((await callFutureVoteTextAi({ apiKey: "test", prompt: "JSON", maxTokens: 700, timeoutMs: 0, fetchImpl: forbiddenFetch })).ok, false);
});

test("all four website text routes use the same client without Perplexity fallback", () => {
  for (const path of ["admin/question-suggest", "admin/question-update-suggest", "admin/resolve-suggest", "cron/resolution-suggestions"]) {
    const code = readFileSync(new URL(`../src/app/api/${path}/route.ts`, import.meta.url), "utf8");
    assert.match(code, /callFutureVoteTextAi/);
    assert.match(code, /OPENAI_API_KEY/);
    assert.doesNotMatch(code, /PERPLEXITY|sonar-pro|callPerplexity/);
    assert.match(code, /maxDuration = 300/);
  }
});
