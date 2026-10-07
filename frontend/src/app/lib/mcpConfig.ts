import { createHash, timingSafeEqual } from "node:crypto";

export type McpConfig = {
  origin: string;
  resource: string;
  clientId: string;
  clientSecret: string;
  storageClientId: string;
  redirectUris: string[];
};

export function getMcpConfig(env: Record<string, string | undefined> = process.env): McpConfig {
  const url = new URL(env.FV_MCP_PUBLIC_ORIGIN?.trim() || "https://gpt-write.future-vote.de");
  const local = env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((!local && url.protocol !== "https:") || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("FV_MCP_PUBLIC_ORIGIN must be an HTTPS origin.");
  }
  const origin = url.origin;
  const resource = `${origin}/mcp`;
  const clientId = env.FV_MCP_OAUTH_CLIENT_ID?.trim() || "futurevote_mcp";
  const clientSecret = (env.FV_MCP_OAUTH_CLIENT_SECRET ?? env.FV_GPT_OAUTH_CLIENT_SECRET ?? "").trim();
  const redirectUris = (env.FV_MCP_OAUTH_REDIRECT_URIS ?? "https://chatgpt.com/connector_platform_oauth_redirect")
    .split(",").map((value) => value.trim()).filter(Boolean);
  for (const redirect of redirectUris) {
    const parsed = new URL(redirect);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) {
      throw new Error("MCP redirect URIs must be exact HTTPS URLs without fragments.");
    }
  }
  // Opaque tokens carry their audience through this resource-specific DB namespace.
  // Legacy GPT tokens and tokens for another MCP origin can never match it.
  const storageClientId = `mcp:${hashValue(JSON.stringify([resource, clientId]))}`;
  return { origin, resource, clientId, clientSecret, storageClientId, redirectUris };
}

export function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function secureEqual(left: string, right: string): boolean {
  return timingSafeEqual(Buffer.from(hashValue(left), "hex"), Buffer.from(hashValue(right), "hex"));
}

export function mcpChallenge(config: McpConfig, error = "invalid_token"): string {
  return `Bearer resource_metadata="${config.origin}/.well-known/oauth-protected-resource", scope="drafts:write", error="${error}", error_description="Connect your FutureVote account to continue"`;
}

export function protectedResourceMetadata(config: McpConfig) {
  return {
    resource: config.resource,
    authorization_servers: [config.origin],
    scopes_supported: ["drafts:write"],
    bearer_methods_supported: ["header"],
    resource_name: "FutureVote",
    resource_policy_uri: "https://www.future-vote.de/datenschutz",
  };
}

export function authorizationServerMetadata(config: McpConfig) {
  return {
    issuer: config.origin,
    authorization_endpoint: `${config.origin}/api/mcp/oauth/authorize`,
    token_endpoint: `${config.origin}/api/mcp/oauth/token`,
    revocation_endpoint: `${config.origin}/api/mcp/oauth/revoke`,
    authorization_response_iss_parameter_supported: true,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["drafts:write"],
  };
}
