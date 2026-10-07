import assert from "node:assert/strict";
import test from "node:test";
import { getMcpConfig, hashValue } from "../src/app/lib/mcpConfig.ts";
import { handleMcpAuthorize, handleMcpToken, handleMcpRevoke, pkceChallenge, renderMcpConsent, type McpCode, type McpTokens, type McpOAuthDependencies } from "../src/app/lib/mcpOAuth.ts";

const config = getMcpConfig({ FV_MCP_OAUTH_CLIENT_SECRET: "test-secret" });
const verifier = "v".repeat(64);
const redirect = config.redirectUris[0];
const baseParams = () => new URLSearchParams({ response_type: "code", client_id: config.clientId, redirect_uri: redirect,
  scope: "drafts:write", state: "test-state", resource: config.resource, code_challenge: pkceChallenge(verifier), code_challenge_method: "S256" });

function harness() {
  const codes: (McpCode & { used?: boolean })[] = [];
  const tokens: (McpTokens & { revoked?: boolean })[] = [];
  let now = Date.parse("2026-10-07T12:00:00Z");
  const deps: McpOAuthDependencies = { config, now: () => now, store: {
    getSession: async (session) => session === "session" ? { id: "user1", label: "Test Account", emailVerified: true } : null,
    saveCode: async (code) => { codes.push(code); },
    consumeCode: async (hash, client, uri, challenge, at) => {
      const code = codes.find((row) => row.code_hash === hash && row.client_id === client && row.redirect_uri === uri && row.code_challenge === challenge && !row.used && row.expires_at > at);
      if (!code) return null;
      code.used = true;
      return code;
    },
    saveTokens: async (row) => { tokens.push(row); },
    findRefresh: async (hash, client, at) => tokens.find((row) => row.refresh_token_hash === hash && row.client_id === client && !row.revoked && row.refresh_expires_at > at) ?? null,
    rotateTokens: async (hash, replacement, at) => {
      const row = tokens.find((row) => row.refresh_token_hash === hash && row.client_id === replacement.client_id && !row.revoked && row.refresh_expires_at > at);
      if (!row) return false;
      Object.assign(row, replacement);
      return true;
    },
    revokeToken: async (hash, client) => { for (const row of tokens) if (row.client_id === client && [row.access_token_hash, row.refresh_token_hash].includes(hash)) row.revoked = true; },
  } };
  return { deps, codes, tokens, advance: (ms: number) => { now += ms; } };
}

function authorizeRequest(params: URLSearchParams, cookie = "fv_user=session") {
  return new Request(`${config.origin}/api/mcp/oauth/authorize?${params}`, { headers: { cookie } });
}

async function consent(h: ReturnType<typeof harness>, params = baseParams()) {
  const response = await handleMcpAuthorize(authorizeRequest(params), h.deps);
  const html = await response.text();
  const nonce = /name="consent_nonce" value="([^"]+)"/.exec(html)![1];
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  return { nonce, cookie, params };
}

function consentPost(c: Awaited<ReturnType<typeof consent>>, modifications?: Record<string, string>, cookie = c.cookie, origin = config.origin) {
  const params = new URLSearchParams(c.params);
  params.set("consent_nonce", c.nonce);
  params.set("decision", "allow");
  for (const [key, value] of Object.entries(modifications ?? {})) params.set(key, value);
  return new Request(`${config.origin}/api/mcp/oauth/authorize`, { method: "POST", headers: {
    "content-type": "application/x-www-form-urlencoded", cookie: `fv_user=session; ${cookie}`, origin,
  }, body: params });
}

function tokenRequest(fields: Record<string, string>, basic = false) {
  const params = new URLSearchParams({ client_id: config.clientId, resource: config.resource, ...fields });
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (basic) headers.authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
  else params.set("client_secret", config.clientSecret);
  return new Request(`${config.origin}/api/mcp/oauth/token`, { method: "POST", headers, body: params });
}

async function issueCode(h: ReturnType<typeof harness>) {
  const c = await consent(h);
  const response = await handleMcpAuthorize(consentPost(c), h.deps);
  assert.equal(response.status, 303);
  const url = new URL(response.headers.get("location")!);
  assert.equal(url.searchParams.get("iss"), config.origin);
  assert.equal(url.searchParams.get("state"), "test-state");
  return url.searchParams.get("code")!;
}

test("exact redirects, audience, client, PKCE and requested scope are validated before login", async () => {
  const h = harness();
  for (const [field, value] of [ ["redirect_uri", "https://chatgpt.com/evil"], ["redirect_uri", "https://attacker.example/callback"],
    ["resource", "https://other.example/mcp"], ["client_id", "futurevote_gpt"], ["code_challenge_method", "plain"],
    ["code_challenge", "short"], ["scope", "admin:write"], ["response_type", "token"] ]) {
    const params = baseParams(); params.set(field, value);
    const response = await handleMcpAuthorize(authorizeRequest(params), h.deps);
    assert.equal(response.status, 400, field);
    assert.equal(response.headers.get("location"), null, "Never redirect invalid input");
  }
  const duplicate = baseParams(); duplicate.append("resource", config.resource);
  assert.equal((await handleMcpAuthorize(authorizeRequest(duplicate), h.deps)).status, 400);
});

test("linking uses the existing FutureVote login and requires explicit consent", async () => {
  const h = harness();
  const loggedOut = await handleMcpAuthorize(authorizeRequest(baseParams(), ""), h.deps);
  assert.equal(new URL(loggedOut.headers.get("location")!).pathname, "/auth");
  const response = await handleMcpAuthorize(authorizeRequest(baseParams()), h.deps);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Konto verbinden/);
  assert.equal(h.codes.length, 0);
  assert.match(response.headers.get("content-security-policy")!, /frame-ancestors 'none'/);
  assert.match(response.headers.get("set-cookie")!, /HttpOnly.*SameSite=Lax.*Secure/);
});

test("consent cannot be forged, replayed for another scope, or posted cross-origin", async () => {
  const h = harness();
  const c = await consent(h);
  for (const request of [consentPost(c, { consent_nonce: "forged" }), consentPost(c, { state: "changed" }), consentPost(c, undefined, "fv_mcp_consent=forged"), consentPost(c, undefined, c.cookie, "https://attacker.example")]) {
    assert.equal((await handleMcpAuthorize(request, h.deps)).status, 403);
  }
  h.advance(600001);
  assert.equal((await handleMcpAuthorize(consentPost(c), h.deps)).status, 403);
  assert.equal(h.codes.length, 0);
});

test("denying consent returns access_denied with issuer and stores no code", async () => {
  const h = harness();
  const response = await handleMcpAuthorize(consentPost(await consent(h), { decision: "deny" }), h.deps);
  const url = new URL(response.headers.get("location")!);
  assert.equal(url.searchParams.get("error"), "access_denied");
  assert.equal(url.searchParams.get("iss"), config.origin);
  assert.equal(h.codes.length, 0);
});

test("unverified accounts cannot grant write access", async () => {
  const h = harness();
  h.deps.store.getSession = async () => ({ id: "user1", label: "Test", emailVerified: false });
  assert.equal((await handleMcpAuthorize(authorizeRequest(baseParams()), h.deps)).status, 403);
});

test("full OAuth code + S256 exchange stores only hashes and consumes the code once", async () => {
  const h = harness();
  const code = await issueCode(h);
  const fields = { grant_type: "authorization_code", code, redirect_uri: redirect, code_verifier: verifier };
  assert.notEqual(h.codes[0].code_hash, code);
  const bad = await handleMcpToken(tokenRequest({ ...fields, code_verifier: "wrong".repeat(10) }), h.deps);
  assert.equal((await bad.json()).error, "invalid_grant");
  const response = await handleMcpToken(tokenRequest(fields, true), h.deps);
  const tokens = await response.json();
  assert.equal(response.status, 200);
  assert.equal(tokens.resource, config.resource);
  assert.equal(h.tokens[0].access_token_hash, hashValue(tokens.access_token));
  assert.equal(h.tokens[0].client_id, config.storageClientId);
  assert.equal((await handleMcpToken(tokenRequest(fields), h.deps)).status, 400);
});

test("expired codes, wrong resource and wrong secret are rejected", async () => {
  const h = harness();
  const code = await issueCode(h);
  const fields = { grant_type: "authorization_code", code, redirect_uri: redirect, code_verifier: verifier };
  const target = await handleMcpToken(tokenRequest({ ...fields, resource: "https://other.example/mcp" }), h.deps);
  assert.equal((await target.json()).error, "invalid_target");
  const wrong = tokenRequest(fields); const body = new URLSearchParams(await wrong.text()); body.set("client_secret", "wrong");
  assert.equal((await handleMcpToken(new Request(wrong.url, { method: "POST", headers: wrong.headers, body }), h.deps)).status, 401);
  h.advance(300001);
  assert.equal((await handleMcpToken(tokenRequest(fields), h.deps)).status, 400);
});

test("refresh rotates both tokens, rejects old refresh tokens and supports revocation", async () => {
  const h = harness();
  const code = await issueCode(h);
  const initial = await (await handleMcpToken(tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirect, code_verifier: verifier }), h.deps)).json();
  const refreshed = await (await handleMcpToken(tokenRequest({ grant_type: "refresh_token", refresh_token: initial.refresh_token }), h.deps)).json();
  assert.notEqual(initial.access_token, refreshed.access_token);
  assert.notEqual(initial.refresh_token, refreshed.refresh_token);
  assert.equal(h.tokens.length, 1);
  assert.equal((await handleMcpToken(tokenRequest({ grant_type: "refresh_token", refresh_token: initial.refresh_token }), h.deps)).status, 400);
  const revoke = tokenRequest({ token: refreshed.refresh_token });
  assert.equal((await handleMcpRevoke(revoke, h.deps)).status, 200);
  assert.equal((await handleMcpToken(tokenRequest({ grant_type: "refresh_token", refresh_token: refreshed.refresh_token }), h.deps)).status, 400);
});

test("consent safely escapes displayed account names and hidden request values", () => {
  const html = renderMcpConsent(baseParams(), "safe", '<script>alert("x")</script>');
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;/);
});

test("OAuth fails closed when the server-side client secret is missing", async () => {
  const h = harness(); h.deps.config = getMcpConfig({});
  assert.equal((await handleMcpAuthorize(authorizeRequest(baseParams()), h.deps)).status, 503);
});
