import assert from "node:assert/strict";
import test from "node:test";
import { getMcpConfig, authorizationServerMetadata, protectedResourceMetadata } from "../src/app/lib/mcpConfig.ts";
import { handleMcpRequest, mcpTools, type McpDependencies } from "../src/app/lib/mcpTools.ts";

const config = getMcpConfig({ FV_MCP_OAUTH_CLIENT_SECRET: "test-secret" });
const validDraft = { title: "Soll unsere Stadt autofrei werden?", description: "wort ".repeat(120).trim(), confirmSubmit: true, category: "Politik", imageUrl: "https://example.supabase.co/storage/v1/object/public/question-images/new.webp", imageCredit: "KI-Bild (OpenAI)", visibility: "public", answerMode: "binary", isResolvable: false };

async function rpc(method: string, params?: Record<string, unknown>, options?: { token?: string; cookie?: string; origin?: string; dispatch?: McpDependencies["dispatch"]; scope?: string; clientId?: string }) {
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json, text/event-stream" };
  if (options?.token) headers.authorization = `Bearer ${options.token}`;
  if (options?.cookie) headers.cookie = options.cookie;
  if (options?.origin) headers.origin = options.origin;
  const response = await handleMcpRequest(new Request(config.resource, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }), {
    config,
    authenticate: async (token) => token === "valid" ? { clientId: options?.clientId ?? config.storageClientId, scope: options?.scope ?? "drafts:write" } : null,
    dispatch: options?.dispatch ?? (async () => Response.json({ url: "https://www.future-vote.de/questions/real-id" }, { status: 201 })),
  });
  const body = await response.text();
  return { response, json: body.startsWith("{") ? JSON.parse(body) : null };
}

test("MCP initializes over the official stateless HTTP transport", async () => {
  const { response, json } = await rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  assert.equal(response.status, 200);
  assert.equal(json.result.serverInfo.name, "futurevote");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("all seven legacy Actions are available with accurate tool auth metadata", async () => {
  const { json } = await rpc("tools/list");
  assert.deepEqual(json.result.tools.map((tool: { name: string }) => tool.name), mcpTools.map((tool) => tool.name));
  for (const tool of json.result.tools) {
    const write = ["createDraft", "generateDraftImage"].includes(tool.name);
    assert.equal(tool.annotations.readOnlyHint, !write);
    assert.equal(tool.securitySchemes[0].type, write ? "oauth2" : "noauth");
    assert.deepEqual(tool.securitySchemes, tool._meta.securitySchemes);
    assert.equal(tool.inputSchema.additionalProperties, false);
  }
});

test("public reads preserve filtering and API URLs without requiring account linking", async () => {
  let called = false;
  const { json } = await rpc("tools/call", { name: "listQuestions", arguments: { limit: 5, category: "Politik", status: "active" } }, { dispatch: async (path, request) => {
    called = true;
    assert.equal(path, "/api/gpt/questions");
    assert.equal(new URL(request.url).searchParams.get("category"), "Politik");
    assert.equal(request.headers.get("authorization"), null);
    return Response.json({ items: [{ url: "https://www.future-vote.de/questions/actual" }] });
  } });
  assert.equal(called, true);
  assert.equal(json.result.structuredContent.items[0].url, "https://www.future-vote.de/questions/actual");
});

test("unauthenticated writes trigger account linking without calling the image API", async () => {
  const { json } = await rpc("tools/call", { name: "generateDraftImage", arguments: { prompt: "Neutrales Stadtmotiv ohne Text" } }, { dispatch: async () => { assert.fail("unauthenticated dispatch"); } });
  assert.equal(json.result.isError, true);
  assert.match(json.result._meta["mcp/www_authenticate"][0], /resource_metadata=.*error="invalid_token"/);
});

test("tokens for legacy GPT or another resource are rejected", async () => {
  for (const clientId of ["futurevote_gpt", "mcp:another-resource"]) {
    const { response } = await rpc("tools/list", undefined, { token: "valid", clientId });
    assert.equal(response.status, 401);
    assert.match(response.headers.get("www-authenticate")!, /oauth-protected-resource/);
  }
});

test("write scope is enforced even when the token has the correct audience", async () => {
  const { json } = await rpc("tools/call", { name: "createDraft", arguments: validDraft }, { token: "valid", scope: "read", dispatch: async () => { assert.fail("scope bypass"); } });
  assert.equal(json.result.isError, true);
  assert.match(json.result._meta["mcp/www_authenticate"][0], /insufficient_scope/);
});

test("submission forwards exact approved content and generated image to existing validation", async () => {
  const args = { ...validDraft, imageUrl: "https://example.supabase.co/storage/v1/object/public/question-images/new.webp" };
  const { json } = await rpc("tools/call", { name: "createDraft", arguments: args }, { token: "valid", dispatch: async (path, request) => {
    assert.equal(path, "/api/drafts");
    assert.equal(request.headers.get("authorization"), "Bearer valid");
    assert.equal(request.headers.get("cookie"), null);
    assert.deepEqual(await request.json(), args);
    return Response.json({ errorCode: "invalid_image_host_for_gpt", details: { receivedHost: "example.supabase.co" } }, { status: 400 });
  } });
  assert.equal(json.result.isError, true);
  assert.equal(json.result.structuredContent.errorCode, "invalid_image_host_for_gpt");
});

test("schema rejects missing approval and unknown fields before submission", async () => {
  for (const args of [{ ...validDraft, confirmSubmit: false }, { ...validDraft, timeLeftHours: 24 }]) {
    const { json } = await rpc("tools/call", { name: "createDraft", arguments: args }, { token: "valid", dispatch: async () => { assert.fail("invalid schema reached dispatch"); } });
    assert.equal(json.result.isError, true);
  }
});

test("browser cookies and hostile browser origins cannot bypass OAuth", async () => {
  assert.equal((await rpc("tools/list", undefined, { cookie: "fv_user=admin-session", token: "valid" })).response.status, 400);
  assert.equal((await rpc("tools/list", undefined, { origin: "https://attacker.example" })).response.status, 403);
});

test("oversized payloads are bounded before parsing or authorization", async () => {
  const response = await handleMcpRequest(new Request(config.resource, { method: "POST", body: " ".repeat(65537) }), { config, authenticate: async () => { assert.fail("oversized auth"); }, dispatch: async () => { assert.fail("oversized dispatch"); } });
  assert.equal(response.status, 413);
});

test("discovery uses the exact same resource and issuer and advertises mandatory S256", () => {
  assert.equal(protectedResourceMetadata(config).resource, config.resource);
  const meta = authorizationServerMetadata(config);
  assert.deepEqual(meta.code_challenge_methods_supported, ["S256"]);
  assert.equal(meta.issuer, protectedResourceMetadata(config).authorization_servers[0]);
  assert.equal(meta.authorization_response_iss_parameter_supported, true);
  assert.notEqual(config.storageClientId, getMcpConfig({ FV_MCP_PUBLIC_ORIGIN: "https://other.future-vote.de" }).storageClientId);
});
