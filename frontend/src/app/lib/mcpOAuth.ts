import { createHash, createHmac, randomBytes } from "node:crypto";
import { hashValue, secureEqual, type McpConfig } from "./mcpConfig.ts";

export type McpCode = {
  code_hash: string; client_id: string; user_id: string; redirect_uri: string;
  scope: string; code_challenge: string; code_challenge_method: "S256"; expires_at: string;
};
export type McpTokens = {
  client_id: string; user_id: string; scope: string; access_token_hash: string;
  refresh_token_hash: string; access_expires_at: string; refresh_expires_at: string;
};
export type McpOAuthStore = {
  getSession: (session: string) => Promise<{ id: string; label: string; emailVerified: boolean } | null>;
  saveCode: (code: McpCode) => Promise<void>;
  consumeCode: (hash: string, client: string, redirect: string, challenge: string, now: string) => Promise<{ user_id: string; scope: string } | null>;
  saveTokens: (tokens: McpTokens) => Promise<void>;
  findRefresh: (hash: string, client: string, now: string) => Promise<{ user_id: string; scope: string } | null>;
  rotateTokens: (oldHash: string, tokens: McpTokens, now: string) => Promise<boolean>;
  revokeToken: (hash: string, client: string) => Promise<void>;
};
export type McpOAuthDependencies = { config: McpConfig; store: McpOAuthStore; now?: () => number };

const CONSENT_COOKIE = "fv_mcp_consent";
const AUTHORIZE_PATH = "/api/mcp/oauth/authorize";
const OAUTH_FIELDS = ["response_type", "response_mode", "client_id", "redirect_uri", "scope", "state", "resource", "code_challenge", "code_challenge_method"];
const noStore = { "Cache-Control": "no-store", Pragma: "no-cache" };
const randomToken = () => randomBytes(32).toString("base64url");
export const pkceChallenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

function errorResponse(error: string, status = 400): Response {
  return Response.json({ error }, { status, headers: noStore });
}

function cookieValue(request: Request, name: string): string {
  const value = (request.headers.get("cookie") ?? "").split(";")
    .map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  try { return value ? decodeURIComponent(value) : ""; } catch { return ""; }
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function renderMcpConsent(params: URLSearchParams, nonce: string, accountLabel: string): string {
  const fields = [...params].map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}">`).join("");
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FutureVote verbinden</title><style>
  *{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;background:#090d12;color:#f4f6f7;font:16px/1.55 system-ui,sans-serif;padding:24px 16px;letter-spacing:0}main{width:100%;max-width:520px}header{display:flex;align-items:center;gap:12px;margin-bottom:28px}.mark{display:grid;place-items:center;width:44px;height:44px;background:#ffda44;color:#090d12;border-radius:6px;font-weight:800}.brand{font-size:20px;font-weight:700}h1{font-size:26px;line-height:1.25;margin:0 0 16px}.account{overflow-wrap:anywhere;color:#9ce8ce}p{margin:0 0 16px}ul{padding-left:22px;margin:20px 0 24px}li{margin:12px 0}.note{color:#b8c1cc;font-size:14px;border-top:1px solid #323940;padding-top:18px}.buttons{display:flex;gap:12px;flex-wrap:wrap;margin-top:26px}button{font:inherit;font-weight:650;min-height:48px;border:1px solid #49515a;border-radius:6px;padding:10px 20px;background:transparent;color:#f4f6f7;cursor:pointer;flex:1}.primary{background:#38d7a0;color:#071911;border-color:#38d7a0}button:focus-visible,a:focus-visible{outline:3px solid #ffda44;outline-offset:4px}footer{margin-top:28px;font-size:13px}a{color:#9ce8ce}footer a{margin-right:16px}@media(max-width:360px){h1{font-size:23px}.buttons{flex-direction:column}}
  </style></head><body><main><header><span class="mark" aria-hidden="true">FV</span><span class="brand">FutureVote</span></header><h1>FutureVote mit dem Plugin verbinden</h1><p>Verbundenes Konto: <strong class="account">${escapeHtml(accountLabel)}</strong></p><p>Das Plugin erhaelt folgende Berechtigungen:</p><ul><li>Umfragebilder erzeugen und speichern. Dabei koennen OpenAI-API-Kosten entstehen.</li><li>Nach deiner Freigabe oeffentliche Vorschlaege zur Community-Bewertung einreichen.</li><li>Nach deiner Freigabe private Link-Umfragen erstellen.</li></ul><p class="note">Keine Berechtigung zum Abstimmen, Bewerten oder Verwalten anderer Konten. Oeffentliche Vorschlaege durchlaufen weiterhin die Community-Freigabe.</p><form method="post" action="${AUTHORIZE_PATH}">${fields}<input type="hidden" name="consent_nonce" value="${escapeHtml(nonce)}"><div class="buttons"><button type="submit" name="decision" value="deny">Abbrechen</button><button class="primary" type="submit" name="decision" value="allow">Konto verbinden</button></div></form><footer><a href="https://www.future-vote.de/datenschutz">Datenschutz</a><a href="https://www.future-vote.de">FutureVote</a></footer></main></body></html>`;
}

function consentSignature(config: McpConfig, session: string, params: URLSearchParams, value: string): string {
  return createHmac("sha256", config.clientSecret).update(JSON.stringify(["futurevote-mcp-consent-v1", hashValue(session), params.toString(), value])).digest("base64url");
}

function consentCookie(config: McpConfig, value: string, maxAge: number): string {
  return `${CONSENT_COOKIE}=${value}; Path=${AUTHORIZE_PATH}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${config.origin.startsWith("https:") ? "; Secure" : ""}`;
}

function validAuthorize(params: URLSearchParams, config: McpConfig): boolean {
  if (OAUTH_FIELDS.some((key) => params.getAll(key).length > 1)) return false;
  if (params.get("response_type") !== "code" || ![null, "query"].includes(params.get("response_mode"))) return false;
  if (params.get("client_id") !== config.clientId || !config.redirectUris.includes(params.get("redirect_uri") ?? "")) return false;
  if (params.get("resource") !== config.resource) return false;
  if (![null, "drafts:write"].includes(params.get("scope"))) return false;
  if (params.get("code_challenge_method") !== "S256" || !/^[\w-]{43}$/.test(params.get("code_challenge") ?? "")) return false;
  const state = params.get("state");
  return Boolean(state && state.length <= 512);
}

async function readForm(request: Request): Promise<URLSearchParams | null> {
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 8192) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const params = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
  for (const key of params.keys()) if (params.getAll(key).length > 1) return null;
  return params;
}

function authorizeRedirect(params: URLSearchParams, config: McpConfig, result: Record<string, string>): Response {
  const redirect = new URL(params.get("redirect_uri")!);
  for (const [key, value] of Object.entries({ ...result, state: params.get("state")!, iss: config.origin, resource: config.resource })) redirect.searchParams.set(key, value);
  return new Response(null, { status: 303, headers: { ...noStore, Location: redirect.toString(), "Set-Cookie": consentCookie(config, "", 0) } });
}

export async function handleMcpAuthorize(request: Request, deps: McpOAuthDependencies): Promise<Response> {
  const { config, store } = deps;
  if (!config.clientSecret) return errorResponse("oauth_not_configured", 503);
  const now = deps.now?.() ?? Date.now();
  const url = new URL(request.url);
  if (url.origin !== config.origin) return errorResponse("invalid_request", 400);
  const submitted = request.method === "POST" ? await readForm(request) : null;
  if (request.method !== "GET" && !submitted) return errorResponse("invalid_request");
  const source = submitted ?? url.searchParams;
  const params = new URLSearchParams();
  for (const field of OAUTH_FIELDS) for (const value of source.getAll(field)) params.append(field, value);
  if (!validAuthorize(params, config)) return errorResponse("invalid_request");
  const session = cookieValue(request, "fv_user");
  const user = session ? await store.getSession(session) : null;
  if (!user) {
    const auth = new URL("/auth", config.origin);
    auth.searchParams.set("next", `${AUTHORIZE_PATH}?${params.toString()}`);
    return new Response(null, { status: 303, headers: { ...noStore, Location: auth.toString() } });
  }
  if (!user.emailVerified) return new Response("Bitte zuerst deine E-Mail-Adresse bei FutureVote bestaetigen.", { status: 403, headers: noStore });
  if (request.method === "GET") {
    const nonce = randomToken();
    const value = `${nonce}.${now + 600000}`;
    const signed = `${value}.${consentSignature(config, session, params, value)}`;
    return new Response(renderMcpConsent(params, nonce, user.label), { headers: {
      ...noStore, "Content-Type": "text/html; charset=utf-8", "Set-Cookie": consentCookie(config, signed, 600),
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "X-Frame-Options": "DENY", "X-Content-Type-Options": "nosniff",
    } });
  }
  const [nonce, expires, signature, extra] = cookieValue(request, CONSENT_COOKIE).split(".");
  if (request.headers.get("origin") !== config.origin || extra || !nonce || !signature || !/^\d+$/.test(expires ?? "") || Number(expires) <= now ||
      Number(expires) > now + 600000 || !secureEqual(nonce, submitted!.get("consent_nonce") ?? "") ||
      !secureEqual(signature, consentSignature(config, session, params, `${nonce}.${expires}`))) return errorResponse("invalid_consent", 403);
  if (submitted!.get("decision") === "deny") return authorizeRedirect(params, config, { error: "access_denied" });
  if (submitted!.get("decision") !== "allow") return errorResponse("invalid_consent", 403);
  const code = randomToken();
  await store.saveCode({ code_hash: hashValue(code), client_id: config.storageClientId, user_id: user.id,
    redirect_uri: params.get("redirect_uri")!, scope: "drafts:write", code_challenge: params.get("code_challenge")!,
    code_challenge_method: "S256", expires_at: new Date(now + 300000).toISOString() });
  return authorizeRedirect(params, config, { code });
}

function authenticateClient(request: Request, params: URLSearchParams, config: McpConfig): boolean {
  let id = params.get("client_id") ?? "";
  let secret = params.get("client_secret") ?? "";
  const authorization = request.headers.get("authorization");
  if (authorization) {
    if (!authorization.startsWith("Basic ") || params.has("client_secret")) return false;
    try {
      const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
      const split = decoded.indexOf(":");
      if (split < 0) return false;
      const basicId = decodeURIComponent(decoded.slice(0, split));
      secret = decodeURIComponent(decoded.slice(split + 1));
      if (id && id !== basicId) return false;
      id = basicId;
    } catch { return false; }
  }
  return id === config.clientId && Boolean(config.clientSecret) && secureEqual(secret, config.clientSecret);
}

export async function handleMcpToken(request: Request, deps: McpOAuthDependencies): Promise<Response> {
  const { config, store } = deps;
  if (!config.clientSecret) return errorResponse("oauth_not_configured", 503);
  const params = await readForm(request);
  if (!params) return errorResponse("invalid_request");
  if (!authenticateClient(request, params, config)) return errorResponse("invalid_client", 401);
  if (params.get("resource") !== config.resource) return errorResponse("invalid_target");
  const now = deps.now?.() ?? Date.now();
  const nowIso = new Date(now).toISOString();
  const grant = params.get("grant_type");
  let account: { user_id: string; scope: string } | null;
  if (grant === "authorization_code") {
    const verifier = params.get("code_verifier") ?? "";
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || !config.redirectUris.includes(params.get("redirect_uri") ?? "")) return errorResponse("invalid_grant");
    account = await store.consumeCode(hashValue(params.get("code") ?? ""), config.storageClientId, params.get("redirect_uri")!, pkceChallenge(verifier), nowIso);
  } else if (grant === "refresh_token") {
    if (params.has("scope") && params.get("scope") !== "drafts:write") return errorResponse("invalid_scope");
    account = await store.findRefresh(hashValue(params.get("refresh_token") ?? ""), config.storageClientId, nowIso);
  } else return errorResponse("unsupported_grant_type");
  if (!account || account.scope !== "drafts:write") return errorResponse("invalid_grant");
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const tokens: McpTokens = { client_id: config.storageClientId, user_id: account.user_id, scope: account.scope,
    access_token_hash: hashValue(accessToken), refresh_token_hash: hashValue(refreshToken),
    access_expires_at: new Date(now + 3600000).toISOString(), refresh_expires_at: new Date(now + 30 * 86400000).toISOString() };
  if (grant === "refresh_token") {
    if (!await store.rotateTokens(hashValue(params.get("refresh_token") ?? ""), tokens, nowIso)) return errorResponse("invalid_grant");
  } else await store.saveTokens(tokens);
  return Response.json({ access_token: accessToken, token_type: "Bearer", expires_in: 3600,
    refresh_token: refreshToken, scope: account.scope, resource: config.resource }, { headers: noStore });
}

export async function handleMcpRevoke(request: Request, deps: McpOAuthDependencies): Promise<Response> {
  const params = await readForm(request);
  if (!params) return errorResponse("invalid_request");
  if (!authenticateClient(request, params, deps.config)) return errorResponse("invalid_client", 401);
  const token = params.get("token");
  if (!token) return errorResponse("invalid_request");
  await deps.store.revokeToken(hashValue(token), deps.config.storageClientId);
  return new Response(null, { status: 200, headers: noStore });
}
