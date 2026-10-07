import "server-only";
import { getSupabaseAdminClient } from "./supabaseAdminClient";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getOauthAccessContextByTokenSupabase } from "@/app/data/dbSupabaseOauth";
import { GET as categories } from "@/app/api/gpt/categories/route";
import { GET as questions } from "@/app/api/gpt/questions/route";
import { GET as votes } from "@/app/api/gpt/votes/recent/route";
import { GET as reviews } from "@/app/api/gpt/reviews/recent/route";
import { GET as similar } from "@/app/api/gpt/questions/similar/route";
import { POST as image } from "@/app/api/gpt/generate-image/route";
import { POST as draft } from "@/app/api/drafts/route";
import { consumeRateLimit, rateLimitResponse } from "./requestSecurity";
import { getMcpConfig } from "./mcpConfig";
import { handleMcpRequest } from "./mcpTools";
import { handleMcpAuthorize, handleMcpToken, handleMcpRevoke, type McpOAuthDependencies, type McpOAuthStore } from "./mcpOAuth";

const handlers: Record<string, (request: Request) => Promise<Response>> = {
  "/api/gpt/categories": categories,
  "/api/gpt/questions": questions,
  "/api/gpt/votes/recent": votes,
  "/api/gpt/reviews/recent": reviews,
  "/api/gpt/questions/similar": similar,
  "/api/gpt/generate-image": image,
  "/api/drafts": draft,
};

function oauthStore(): McpOAuthStore {
  const db = getSupabaseAdminClient();
  return {
    async getSession(session) {
      const user = await getUserBySessionSupabase(session);
      return user ? { id: user.id, label: user.displayName || user.email, emailVerified: user.emailVerified } : null;
    },
    async saveCode(code) {
      const { error } = await db.from("oauth_authorization_codes").insert(code);
      if (error) throw new Error("MCP OAuth code could not be stored");
    },
    async consumeCode(hash, client, redirect, challenge, now) {
      // Consume and validate in one DB operation so concurrent exchanges cannot reuse a code.
      const { data, error } = await db.from("oauth_authorization_codes").update({ used_at: now })
        .eq("code_hash", hash).eq("client_id", client).eq("redirect_uri", redirect)
        .eq("code_challenge", challenge).eq("code_challenge_method", "S256")
        .is("used_at", null).gt("expires_at", now).select("user_id,scope").maybeSingle();
      if (error) throw new Error("MCP OAuth code lookup failed");
      return data;
    },
    async saveTokens(tokens) {
      const { error } = await db.from("oauth_tokens").insert(tokens);
      if (error) throw new Error("MCP OAuth tokens could not be stored");
    },
    async findRefresh(hash, client, now) {
      const { data, error } = await db.from("oauth_tokens").select("user_id,scope")
        .eq("refresh_token_hash", hash).eq("client_id", client).is("revoked_at", null).gt("refresh_expires_at", now).maybeSingle();
      if (error) throw new Error("MCP OAuth refresh lookup failed");
      return data;
    },
    async rotateTokens(oldHash, tokens, now) {
      const { data, error } = await db.from("oauth_tokens").update(tokens)
        .eq("refresh_token_hash", oldHash).eq("client_id", tokens.client_id)
        .is("revoked_at", null).gt("refresh_expires_at", now).select("id").maybeSingle();
      if (error) throw new Error("MCP OAuth token rotation failed");
      return Boolean(data);
    },
    async revokeToken(hash, client) {
      const { error } = await db.from("oauth_tokens").update({ revoked_at: new Date().toISOString() })
        .eq("client_id", client).or(`access_token_hash.eq.${hash},refresh_token_hash.eq.${hash}`);
      if (error) throw new Error("MCP OAuth revocation failed");
    },
  };
}

export async function serveMcp(request: Request): Promise<Response> {
  try {
    const rate = await consumeRateLimit({ request, scope: "mcp", limit: 120, windowSeconds: 60 });
    if (!rate.allowed) return rateLimitResponse(rate);
    return await handleMcpRequest(request, {
      config: getMcpConfig(),
      authenticate: getOauthAccessContextByTokenSupabase,
      dispatch: (path, apiRequest) => {
        const handler = handlers[path];
        if (!handler) throw new Error("Unknown MCP route");
        return handler(apiRequest);
      },
    });
  } catch {
    return Response.json({ error: "FutureVote MCP unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function serveMcpOAuth(request: Request, endpoint: "authorize" | "token" | "revoke"): Promise<Response> {
  try {
    const rate = await consumeRateLimit({ request, scope: `mcp-oauth-${endpoint}`, limit: 30, windowSeconds: 60 });
    if (!rate.allowed) return rateLimitResponse(rate);
    const deps: McpOAuthDependencies = { config: getMcpConfig(), store: oauthStore() };
    const handlers = { authorize: handleMcpAuthorize, token: handleMcpToken, revoke: handleMcpRevoke };
    return await handlers[endpoint](request, deps);
  } catch {
    return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
