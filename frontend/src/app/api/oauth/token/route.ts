import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import {
  base64UrlSha256,
  getOAuthClientConfig,
  isAllowedRedirectUri,
  randomToken,
  sha256Hex,
} from "../_lib";

export const revalidate = 0;

type TokenRequest =
  | {
      grant_type: "authorization_code";
      code: string;
      redirect_uri: string;
      client_id: string;
      client_secret?: string;
      code_verifier?: string;
    }
  | {
      grant_type: "refresh_token";
      refresh_token: string;
      client_id: string;
      client_secret?: string;
    };

async function readTokenRequest(request: Request): Promise<TokenRequest | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return (await request.json()) as TokenRequest;
    } catch {
      return null;
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    const grantType = String(form.get("grant_type") ?? "");
    if (grantType === "authorization_code") {
      return {
        grant_type: "authorization_code",
        code: String(form.get("code") ?? ""),
        redirect_uri: String(form.get("redirect_uri") ?? ""),
        client_id: String(form.get("client_id") ?? ""),
        client_secret: form.get("client_secret") ? String(form.get("client_secret")) : undefined,
        code_verifier: form.get("code_verifier") ? String(form.get("code_verifier")) : undefined,
      };
    }
    if (grantType === "refresh_token") {
      return {
        grant_type: "refresh_token",
        refresh_token: String(form.get("refresh_token") ?? ""),
        client_id: String(form.get("client_id") ?? ""),
        client_secret: form.get("client_secret") ? String(form.get("client_secret")) : undefined,
      };
    }
    return null;
  }

  // Fallback: versuchen als FormData zu lesen
  try {
    const form = await request.formData();
    const grantType = String(form.get("grant_type") ?? "");
    if (grantType === "authorization_code") {
      return {
        grant_type: "authorization_code",
        code: String(form.get("code") ?? ""),
        redirect_uri: String(form.get("redirect_uri") ?? ""),
        client_id: String(form.get("client_id") ?? ""),
        client_secret: form.get("client_secret") ? String(form.get("client_secret")) : undefined,
        code_verifier: form.get("code_verifier") ? String(form.get("code_verifier")) : undefined,
      };
    }
    if (grantType === "refresh_token") {
      return {
        grant_type: "refresh_token",
        refresh_token: String(form.get("refresh_token") ?? ""),
        client_id: String(form.get("client_id") ?? ""),
        client_secret: form.get("client_secret") ? String(form.get("client_secret")) : undefined,
      };
    }
  } catch {
    // ignore
  }

  return null;
}

function badRequest(message: string) {
  return NextResponse.json({ error: "invalid_request", error_description: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
}

function unauthorized(message: string) {
  return NextResponse.json({ error: "invalid_client", error_description: message }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const cfg = getOAuthClientConfig();
  const body = await readTokenRequest(request);
  if (!body) return badRequest("Ungültiger Body");

  if (body.client_id !== cfg.clientId) return unauthorized("ungueltige client_id");
  if (cfg.clientSecret && body.client_secret !== cfg.clientSecret) return unauthorized("ungueltiges client_secret");

  const supabase = getSupabaseAdminClient();

  if (body.grant_type === "authorization_code") {
    if (!body.code || !body.redirect_uri) return badRequest("missing code/redirect_uri");
    if (!isAllowedRedirectUri(body.redirect_uri, cfg.allowedRedirectHosts)) return badRequest("invalid redirect_uri");

    const codeHash = sha256Hex(body.code);
    const { data, error } = await supabase
      .from("oauth_authorization_codes")
      .select("id,user_id,client_id,redirect_uri,scope,code_challenge,code_challenge_method,expires_at,used_at")
      .eq("code_hash", codeHash)
      .maybeSingle();

    if (error) return badRequest(`code lookup failed: ${error.message}`);
    if (!data) return badRequest("invalid code");

    const row = data as any;
    if (row.used_at) return badRequest("code already used");

    const expiresMs = Date.parse(String(row.expires_at));
    if (Number.isNaN(expiresMs) || expiresMs < Date.now()) {
      await supabase.from("oauth_authorization_codes").delete().eq("id", row.id as string);
      return badRequest("code expired");
    }

    if (String(row.client_id) !== cfg.clientId) return badRequest("invalid client");
    if (String(row.redirect_uri) !== body.redirect_uri) return badRequest("redirect_uri mismatch");

    const expectedChallenge = row.code_challenge === null || row.code_challenge === undefined ? null : String(row.code_challenge);
    if (expectedChallenge) {
      if (!body.code_verifier) return badRequest("missing code_verifier");
      const method = String(row.code_challenge_method ?? "S256");
      if (method !== "S256") return badRequest("unsupported code_challenge_method");
      const computedChallenge = base64UrlSha256(body.code_verifier);
      if (computedChallenge !== expectedChallenge) return badRequest("invalid code_verifier");
    }

    // mark used
    await supabase
      .from("oauth_authorization_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id as string);

    const accessToken = randomToken(32);
    const refreshToken = randomToken(32);
    const accessExpiresAt = new Date(Date.now() + 60 * 60_000).toISOString(); // 60 min
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(); // 30 days

    const { error: insErr } = await supabase.from("oauth_tokens").insert({
      client_id: cfg.clientId,
      user_id: String(row.user_id),
      scope: String(row.scope ?? ""),
      access_token_hash: sha256Hex(accessToken),
      refresh_token_hash: sha256Hex(refreshToken),
      access_expires_at: accessExpiresAt,
      refresh_expires_at: refreshExpiresAt,
    });

    if (insErr) return badRequest(`token insert failed: ${insErr.message}`);

    return NextResponse.json(
      {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: refreshToken,
        scope: String(row.scope ?? ""),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (body.grant_type === "refresh_token") {
    if (!body.refresh_token) return badRequest("missing refresh_token");
    const refreshHash = sha256Hex(body.refresh_token);

    const { data, error } = await supabase
      .from("oauth_tokens")
      .select("id,user_id,client_id,scope,refresh_expires_at,revoked_at")
      .eq("refresh_token_hash", refreshHash)
      .maybeSingle();

    if (error) return badRequest(`refresh lookup failed: ${error.message}`);
    if (!data) return badRequest("invalid refresh_token");

    const row = data as any;
    if (row.revoked_at) return badRequest("refresh token revoked");
    if (String(row.client_id) !== cfg.clientId) return badRequest("invalid client");

    const refreshExpiresMs = Date.parse(String(row.refresh_expires_at));
    if (Number.isNaN(refreshExpiresMs) || refreshExpiresMs < Date.now()) return badRequest("refresh token expired");

    const accessToken = randomToken(32);
    const accessExpiresAt = new Date(Date.now() + 60 * 60_000).toISOString();

    const { error: upErr } = await supabase
      .from("oauth_tokens")
      .update({
        access_token_hash: sha256Hex(accessToken),
        access_expires_at: accessExpiresAt,
      })
      .eq("id", row.id as string);

    if (upErr) return badRequest(`token update failed: ${upErr.message}`);

    return NextResponse.json(
      {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 3600,
        scope: String(row.scope ?? ""),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  return badRequest("unsupported grant_type");
}
