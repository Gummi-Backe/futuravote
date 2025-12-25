import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getOAuthClientConfig, isAllowedRedirectUri, randomToken, sha256Hex } from "../_lib";

export const revalidate = 0;

type AuthorizeParams = {
  response_type: string | null;
  response_mode: string | null;
  client_id: string | null;
  redirect_uri: string | null;
  scope: string | null;
  state: string | null;
  code_challenge: string | null;
  code_challenge_method: string | null;
};

function getCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(/;\s*/g);
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq);
    if (key !== name) continue;
    const value = part.slice(eq + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

function readAuthorizeParams(url: URL): AuthorizeParams {
  const p = url.searchParams;
  return {
    response_type: p.get("response_type"),
    response_mode: p.get("response_mode"),
    client_id: p.get("client_id"),
    redirect_uri: p.get("redirect_uri"),
    scope: p.get("scope"),
    state: p.get("state"),
    code_challenge: p.get("code_challenge"),
    code_challenge_method: p.get("code_challenge_method"),
  };
}

function buildRedirectError(redirectUri: string, state: string | null, error: string, description?: string) {
  const u = new URL(redirectUri);
  u.searchParams.set("error", error);
  if (description) u.searchParams.set("error_description", description);
  if (state) u.searchParams.set("state", state);
  const res = NextResponse.redirect(u.toString(), { status: 302 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function validateAuthorizeParams(params: AuthorizeParams): { ok: true } | { ok: false; error: string } {
  const cfg = getOAuthClientConfig();

  if (params.response_type !== "code") return { ok: false, error: "response_type must be code" };
  if (!params.client_id || params.client_id !== cfg.clientId) return { ok: false, error: "invalid client_id" };
  if (!params.redirect_uri) return { ok: false, error: "missing redirect_uri" };
  if (!isAllowedRedirectUri(params.redirect_uri, cfg.allowedRedirectHosts)) return { ok: false, error: "invalid redirect_uri" };

  // ChatGPT sendet in manchen OAuth-Varianten kein PKCE. Wenn ein Client-Secret gesetzt ist,
  // erlauben wir den Flow ohne PKCE (Confidential Client). Ohne Secret bleibt PKCE Pflicht.
  const pkceRequired = !cfg.clientSecret;
  if (pkceRequired && !params.code_challenge) return { ok: false, error: "missing code_challenge" };
  if (params.code_challenge) {
    if (params.code_challenge_method && params.code_challenge_method !== "S256") {
      return { ok: false, error: "unsupported code_challenge_method" };
    }
  }
  return { ok: true };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = readAuthorizeParams(url);
  const validation = validateAuthorizeParams(params);

  if (!validation.ok) {
    if (params.redirect_uri && params.state) {
      return buildRedirectError(params.redirect_uri, params.state, "invalid_request", validation.error);
    }
    return new NextResponse(validation.error, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const redirectUri = params.redirect_uri!;
  const state = params.state;
  const scope = (params.scope ?? "").trim();
  const codeChallenge = params.code_challenge;
  const codeChallengeMethod = codeChallenge ? (params.code_challenge_method ?? "S256") : null;

  const sessionId = getCookieValue(request, "fv_user");
  const user = sessionId ? await getUserBySessionSupabase(sessionId) : null;

  if (!user) {
    const returnPath = `${url.pathname}${url.search}`;
    const authUrl = new URL("/auth", url.origin);
    authUrl.searchParams.set("next", returnPath);
    const res = NextResponse.redirect(authUrl.toString(), { status: 302 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  try {
    const supabase = getSupabaseAdminClient();

    const code = randomToken(32);
    const codeHash = sha256Hex(code);
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

    const { error } = await supabase.from("oauth_authorization_codes").insert({
      code_hash: codeHash,
      client_id: params.client_id!,
      user_id: user.id,
      redirect_uri: redirectUri,
      scope,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      expires_at: expiresAt,
    });

    if (error) {
      return buildRedirectError(redirectUri, state, "server_error", `DB Fehler: ${error.message}`);
    }

    const u = new URL(redirectUri);
    u.searchParams.set("code", code);
    if (state) u.searchParams.set("state", state);
    const res = NextResponse.redirect(u.toString(), { status: 302 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : "unknown";
    return buildRedirectError(redirectUri, state, "server_error", msg);
  }
}

export async function POST() {
  return new NextResponse("method_not_allowed", { status: 405, headers: { "Cache-Control": "no-store" } });
}
