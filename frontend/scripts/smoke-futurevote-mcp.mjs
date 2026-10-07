import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const origin = process.argv[2];
if (!origin) throw new Error("Usage: node scripts/smoke-futurevote-mcp.mjs https://gpt-write.future-vote.de");
for (const path of ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp", "/.well-known/oauth-authorization-server"]) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, path);
  const data = await response.json();
  assert.ok(data.resource || data.issuer);
  console.log(`Discovery OK: ${path}`);
}
const client = new Client({ name: "futurevote-deploy-smoke", version: "1.0.0" });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", origin)));
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 7);
  console.log("MCP initialize + all 7 tools OK");
  const categories = await client.callTool({ name: "getCategories", arguments: {} });
  assert.equal(categories.isError, false, "Public categories handler must be available");
  assert.ok(Array.isArray(categories.structuredContent.categories));
  assert.ok(categories.structuredContent.categories.length > 0, "Live categories must not be empty");
  console.log("Public categories read OK");
  for (const [name, args] of [
    ["listQuestions", { limit: 1 }],
    ["listRecentVotes", { limit: 1 }],
    ["listRecentReviews", { limit: 1 }],
    ["listSimilarQuestions", { q: "Soll Deutschland junge Erwachsene wieder zum Wehrdienst verpflichten?", limit: 1 }],
  ]) {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, false, `${name} must be available`);
    assert.ok(result.structuredContent);
    assert.equal(result.structuredContent.error, undefined, `${name} must not mask backend errors`);
    console.log(`Public read OK: ${name}`);
  }
  const image = await client.callTool({ name: "generateDraftImage", arguments: { prompt: "Nicht ausfuehren: unangemeldeter Schutztest" } });
  assert.equal(image.isError, true);
  assert.ok(image._meta["mcp/www_authenticate"]);
  console.log("Unauthenticated image generation blocked, OAuth challenge OK (no image costs)");
  const draft = await client.callTool({ name: "createDraft", arguments: {
    title: "Unangemeldeter Schutztest, nicht einreichen",
    description: "Diese Aktion darf ohne OAuth-Anmeldung nicht ausgefuehrt werden.",
    confirmSubmit: true, category: "Politik", imageUrl: `${origin}/blocked-test.png`,
    imageCredit: "Schutztest", visibility: "public", answerMode: "binary", isResolvable: false,
  } });
  assert.equal(draft.isError, true);
  assert.ok(draft._meta["mcp/www_authenticate"]);
  console.log("Unauthenticated draft submission blocked (no draft created)");
} finally { await client.close(); }
const legacy = new URL("/api/oauth/authorize", origin);
legacy.searchParams.set("redirect_uri", "https://attacker.invalid/");
legacy.searchParams.set("state", "test");
const blocked = await fetch(legacy, { redirect: "manual", signal: AbortSignal.timeout(30000) });
assert.equal(blocked.status, 400);
assert.equal(blocked.headers.get("location"), null);
console.log("Legacy OAuth hostile redirect blocked");
const modern = new URL("/api/mcp/oauth/authorize", origin);
modern.search = new URLSearchParams({ response_type: "code", client_id: "futurevote_mcp",
  redirect_uri: "https://attacker.invalid/", resource: `${origin}/mcp`,
  code_challenge: "a".repeat(43), code_challenge_method: "S256", state: "deploy-smoke" }).toString();
const denied = await fetch(modern, { redirect: "manual", signal: AbortSignal.timeout(30000) });
assert.equal(denied.status, 400);
assert.equal(denied.headers.get("location"), null);
console.log("MCP OAuth hostile redirect blocked");
modern.searchParams.set("redirect_uri", "https://chatgpt.com/connector_platform_oauth_redirect");
const login = await fetch(modern, { redirect: "manual", signal: AbortSignal.timeout(30000) });
assert.equal(login.status, 303, "Configured OAuth must lead to FutureVote login");
assert.match(login.headers.get("content-security-policy") ?? "", /form-action 'self' https:\/\/chatgpt\.com;/,
  "OAuth consent must permit the configured ChatGPT callback through Chromium form redirects");
const location = new URL(login.headers.get("location"));
assert.equal(location.origin, origin);
assert.equal(location.pathname, "/auth");
assert.ok(location.searchParams.get("next").startsWith("/api/mcp/oauth/authorize?"));
console.log("MCP OAuth login entry OK (no grant issued)");
const authPage = await fetch(new URL("/auth", origin), { signal: AbortSignal.timeout(30000) });
assert.equal(authPage.status, 200);
assert.match(authPage.headers.get("content-security-policy") ?? "", /form-action 'self';/,
  "Normal website forms must remain same-origin only");
console.log("OAuth callback CSP exception OK; normal login forms remain same-origin only");
