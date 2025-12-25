import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import {
  getOAuthClientConfig,
  htmlPage,
  isAllowedRedirectUri,
  randomToken,
  sha256Hex,
} from "../_lib";

export const revalidate = 0;

type AuthorizeParams = {
  response_type: string | null;
  client_id: string | null;
  redirect_uri: string | null;
  scope: string | null;
  state: string | null;
  code_challenge: string | null;
  code_challenge_method: string | null;
};

function readAuthorizeParams(url: URL): AuthorizeParams {
  const p = url.searchParams;
  return {
    response_type: p.get("response_type"),
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
  return NextResponse.redirect(u.toString(), { status: 302 });
}

function validateAuthorizeParams(params: AuthorizeParams): { ok: true } | { ok: false; error: string } {
  const cfg = getOAuthClientConfig();

  if (params.response_type !== "code") return { ok: false, error: "response_type must be code" };
  if (!params.client_id || params.client_id !== cfg.clientId) return { ok: false, error: "invalid client_id" };
  if (!params.redirect_uri) return { ok: false, error: "missing redirect_uri" };
  if (!isAllowedRedirectUri(params.redirect_uri, cfg.allowedRedirectHosts)) return { ok: false, error: "invalid redirect_uri" };

  if (!params.code_challenge) return { ok: false, error: "missing code_challenge" };
  if (params.code_challenge_method && params.code_challenge_method !== "S256") {
    return { ok: false, error: "unsupported code_challenge_method" };
  }
  return { ok: true };
}

export async function GET(request: Request) {
  try {
  const url = new URL(request.url);
  const params = readAuthorizeParams(url);
  const validation = validateAuthorizeParams(params);

  if (!validation.ok) {
    if (params.redirect_uri && params.state) {
      return buildRedirectError(params.redirect_uri, params.state, "invalid_request", validation.error);
    }
    return new NextResponse(
      htmlPage(
        "OAuth Fehler",
        `<div class="card"><div class="title">OAuth Fehler</div><div class="muted">${validation.error}</div></div>`
      ),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId) : null;

  if (!user) {
    const returnPath = `${url.pathname}${url.search}`;
    const authUrl = new URL("/auth", request.url);
    authUrl.searchParams.set("next", returnPath);
    return NextResponse.redirect(authUrl.toString(), { status: 302 });
  }

  const scope = (params.scope ?? "").trim();
  const redirectUri = params.redirect_uri!;
  const state = params.state;
  const codeChallenge = params.code_challenge!;
  const codeChallengeMethod = params.code_challenge_method ?? "S256";

  const body = `
    <div class="card">
      <div class="title">Zugriff erlauben?</div>
      <div class="muted">Du bist eingeloggt als <span class="pill"><strong>${user.displayName}</strong> · <code>${user.email}</code></span></div>
      <div class="muted" style="margin-top:10px">
        <strong>FutureVote GPT</strong> möchte Aktionen in deinem Namen ausführen (z.B. Drafts erstellen) – nur nach deiner Bestätigung.
      </div>
      <div class="muted" style="margin-top:10px">
        <div class="pill">Scope: <code>${scope || "(leer)"}</code></div>
      </div>
      <form method="post" action="/api/oauth/authorize">
        <input type="hidden" name="client_id" value="${params.client_id!}" />
        <input type="hidden" name="redirect_uri" value="${redirectUri}" />
        <input type="hidden" name="state" value="${state ?? ""}" />
        <input type="hidden" name="scope" value="${scope}" />
        <input type="hidden" name="code_challenge" value="${codeChallenge}" />
        <input type="hidden" name="code_challenge_method" value="${codeChallengeMethod}" />
        <div class="row">
          <button class="btn primary" type="submit" name="decision" value="allow">Erlauben</button>
          <button class="btn danger" type="submit" name="decision" value="deny">Ablehnen</button>
        </div>
      </form>
      <div class="muted" style="margin-top:12px">
        Hinweis: Du kannst diese Verknüpfung später widerrufen (Disconnect), sobald wir die Profil-UI dafür ergänzen.
      </div>
    </div>
  `;

  return new NextResponse(htmlPage("OAuth Zugriff", body), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : "unknown";
    return new NextResponse(
      htmlPage(
        "OAuth Fehler",
        `<div class="card"><div class="title">OAuth Fehler</div><div class="muted">${msg}</div></div>`
      ),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: Request) {
  try {
  const form = await request.formData();
  const decision = String(form.get("decision") ?? "");
  const clientId = String(form.get("client_id") ?? "");
  const redirectUri = String(form.get("redirect_uri") ?? "");
  const state = String(form.get("state") ?? "") || null;
  const scope = String(form.get("scope") ?? "") || "";
  const codeChallenge = String(form.get("code_challenge") ?? "");
  const codeChallengeMethod = String(form.get("code_challenge_method") ?? "S256");

  const cfg = getOAuthClientConfig();
  if (clientId !== cfg.clientId) {
    return buildRedirectError(redirectUri, state, "invalid_request", "invalid client_id");
  }
  if (!isAllowedRedirectUri(redirectUri, cfg.allowedRedirectHosts)) {
    return new NextResponse("invalid redirect_uri", { status: 400 });
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId) : null;
  if (!user) {
    const nextUrl = new URL("/api/oauth/authorize", request.url);
    nextUrl.searchParams.set("response_type", "code");
    nextUrl.searchParams.set("client_id", clientId);
    nextUrl.searchParams.set("redirect_uri", redirectUri);
    if (state) nextUrl.searchParams.set("state", state);
    if (scope) nextUrl.searchParams.set("scope", scope);
    nextUrl.searchParams.set("code_challenge", codeChallenge);
    nextUrl.searchParams.set("code_challenge_method", codeChallengeMethod);
    const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
    const authUrl = new URL("/auth", request.url);
    authUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(authUrl.toString(), { status: 302 });
  }

  if (decision !== "allow") {
    return buildRedirectError(redirectUri, state, "access_denied");
  }

  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return buildRedirectError(redirectUri, state, "invalid_request", "missing/invalid code_challenge");
  }

  try {
    const supabase = getSupabaseAdminClient();

    const code = randomToken(32);
    const codeHash = sha256Hex(code);
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

    const { error } = await supabase.from("oauth_authorization_codes").insert({
      code_hash: codeHash,
      client_id: clientId,
      user_id: user.id,
      redirect_uri: redirectUri,
      scope,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      expires_at: expiresAt,
    });

    if (error) {
      return new NextResponse(
        htmlPage(
          "OAuth Fehler",
          `<div class="card"><div class="title">OAuth Fehler</div><div class="muted">DB Fehler: ${error.message}</div></div>`
        ),
        { status: 500, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
      );
    }

    const u = new URL(redirectUri);
    u.searchParams.set("code", code);
    if (state) u.searchParams.set("state", state);
    return NextResponse.redirect(u.toString(), { status: 302 });
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : "unknown";
    return new NextResponse(
      htmlPage(
        "OAuth Fehler",
        `<div class="card"><div class="title">OAuth Fehler</div><div class="muted">${msg}</div></div>`
      ),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
    );
  }
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : "unknown";
    return new NextResponse(
      htmlPage(
        "OAuth Fehler",
        `<div class="card"><div class="title">OAuth Fehler</div><div class="muted">${msg}</div></div>`
      ),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
    );
  }
}
