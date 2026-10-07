import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { ListToolsRequestSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { mcpChallenge, type McpConfig } from "./mcpConfig.ts";

const pagination = {
  limit: z.number().int().min(1).max(20).optional(),
  cursor: z.string().max(100).optional(),
  category: z.string().max(60).optional(),
};

export const mcpTools = [
  { name: "getCategories", path: "/api/gpt/categories", method: "GET", description: "Aktuelle oeffentliche FutureVote-Kategorien abrufen.", schema: z.strictObject({}) },
  { name: "listQuestions", path: "/api/gpt/questions", method: "GET", description: "Aktuelle oeffentliche Umfragen und Prognosen mit den echten URLs abrufen. Private Umfragen werden nicht geliefert.", schema: z.strictObject({ ...pagination, region: z.string().max(80).optional(), status: z.enum(["active", "ended", "all"]).optional() }) },
  { name: "listRecentVotes", path: "/api/gpt/votes/recent", method: "GET", description: "Neueste oeffentliche Abstimmungen anonymisiert abrufen.", schema: z.strictObject(pagination) },
  { name: "listRecentReviews", path: "/api/gpt/reviews/recent", method: "GET", description: "Neueste oeffentliche Community-Bewertungen anonymisiert abrufen.", schema: z.strictObject(pagination) },
  { name: "listSimilarQuestions", path: "/api/gpt/questions/similar", method: "GET", description: "Vor jeder Einreichung Titel und Beschreibung auf aehnliche oeffentliche Fragen pruefen.", schema: z.strictObject({ q: z.string().min(8).max(220), d: z.string().max(10000).optional(), limit: z.number().int().min(1).max(50).optional() }) },
  { name: "generateDraftImage", path: "/api/gpt/generate-image", method: "POST", description: "Ein Umfragebild erzeugen und dauerhaft bei FutureVote speichern. Kann API-Kosten verursachen. imageUrl und imageCredit exakt fuer createDraft uebernehmen. Niemals eingebaute ChatGPT-Bilder oder fremde Bild-URLs verwenden.", schema: z.strictObject({ prompt: z.string().min(10).max(1500), size: z.literal("1024x1024").optional() }) },
  { name: "createDraft", path: "/api/drafts", method: "POST", description: "Nach ausdruecklicher Freigabe der vollstaendigen unveraenderten Vorschau einen Community-Review-Vorschlag oder eine private Link-Umfrage einreichen. Oeffentliche Vorschlaege werden NICHT sofort veroeffentlicht. Nur gelieferte url/reviewUrl/shareUrl verlinken.", schema: z.strictObject({
    title: z.string().min(12).max(220),
    description: z.string().min(1).max(10000).describe("Oeffentlich: 100-200 Woerter. Privat: kurz und neutral."),
    longDescription: z.string().max(30000).optional().describe("Oeffentliche Prognose: 600-1000 Woerter; bei Meinungsumfragen nur auf Wunsch; privat weglassen."),
    allowWithoutLongDescription: z.boolean().optional(),
    confirmSubmit: z.literal(true).describe("Nur nach ausdruecklicher Zustimmung zur letzten unveraenderten Vorschau."),
    category: z.string().min(1).max(60),
    region: z.string().max(80).optional(),
    imageUrl: z.string().url().describe("Exakt aus der neuesten generateDraftImage-Antwort."),
    imageCredit: z.string().min(1).max(140),
    closesAt: z.string().optional().describe("ISO-8601 in der Zukunft. Privat Pflicht."),
    visibility: z.enum(["public", "link_only"]),
    answerMode: z.enum(["binary", "options"]),
    isResolvable: z.boolean(),
    options: z.array(z.string().min(1).max(80)).min(2).max(6).optional(),
    resolutionCriteria: z.string().max(10000).optional(),
    resolutionSource: z.string().max(2000).optional(),
    resolutionSources: z.array(z.string().max(2000)).min(1).max(8).optional(),
    resolutionDeadline: z.string().optional(),
  }) },
] as const;

export type McpDependencies = {
  config: McpConfig;
  authenticate: (token: string) => Promise<{ clientId: string; scope: string } | null>;
  dispatch: (path: string, request: Request) => Promise<Response>;
};

function authError(config: McpConfig, scopeMissing = false): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: "Bitte das FutureVote-Konto verbinden. Die Aktion wurde nicht ausgefuehrt." }],
    _meta: { "mcp/www_authenticate": [mcpChallenge(config, scopeMissing ? "insufficient_scope" : "invalid_token")] },
  };
}

export async function handleMcpRequest(request: Request, deps: McpDependencies): Promise<Response> {
  const url = new URL(request.url);
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.origin !== deps.config.origin && !local) return new Response("Invalid host", { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return new Response("Invalid origin", { status: 403 });
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  // The existing routes use Next's request-scoped cookies. Never let a browser session
  // override the bearer identity or bypass GPT validation in a delegated tool call.
  if (/(?:^|;\s*)fv_user=/.test(request.headers.get("cookie") ?? "")) {
    return new Response("MCP requires OAuth, not browser session cookies.", { status: 400 });
  }
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  if (reader) {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 65536) {
        await reader.cancel();
        return new Response("Request too large", { status: 413 });
      }
      chunks.push(value);
    }
  }
  let parsedBody: unknown;
  try { parsedBody = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1];
  const context = token ? await deps.authenticate(token) : null;
  if (header && (!context || context.clientId !== deps.config.storageClientId)) {
    return new Response(null, { status: 401, headers: { "WWW-Authenticate": mcpChallenge(deps.config), "Cache-Control": "no-store" } });
  }
  const server = new McpServer({ name: "futurevote", version: "1.0.0" }, {
    maxToolInputElements: 100,
    instructions: "FutureVote: neutral auf Deutsch antworten. Vor dem Einreichen Dubletten pruefen, generateDraftImage verwenden, die vollstaendige Vorschau zeigen und ausdrueckliche Zustimmung einholen. Bei public gilt Community-Review. Links exakt aus API-Antworten verwenden. Die FutureVote-Plugin-Skill enthaelt die vollstaendigen Regeln.",
  });
  for (const tool of mcpTools) {
    const write = tool.method === "POST";
    const securitySchemes = write ? [{ type: "oauth2", scopes: ["drafts:write"] }] : [{ type: "noauth" }];
    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: tool.schema,
      annotations: { readOnlyHint: !write, destructiveHint: false, openWorldHint: write },
      _meta: { securitySchemes },
    }, async (args: Record<string, unknown>) => {
      if (write && (!context || !token)) return authError(deps.config);
      if (write && !context!.scope.split(/[,\s]+/).includes("drafts:write")) return authError(deps.config, true);
      const apiUrl = new URL(tool.path, deps.config.origin);
      const headers = new Headers();
      for (const name of ["x-forwarded-for", "x-real-ip"]) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
      }
      if (write) headers.set("authorization", `Bearer ${token}`);
      if (!write) for (const [key, value] of Object.entries(args)) apiUrl.searchParams.set(key, String(value));
      if (write) headers.set("content-type", "application/json");
      try {
        const response = await deps.dispatch(tool.path, new Request(apiUrl, {
          method: tool.method, headers, ...(write ? { body: JSON.stringify(args) } : {}),
        }));
        const payload: unknown = await response.json();
        const data = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : { data: payload };
        return { isError: !response.ok, content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: data };
      } catch {
        return { isError: true, content: [{ type: "text" as const, text: "FutureVote ist voruebergehend nicht erreichbar. Keine erfolgreiche Einreichung behaupten und createDraft nicht blind wiederholen; ein vorheriger Schreibvorgang koennte bereits gespeichert worden sein." }] };
      }
    });
  }
  // Publish both standard auth metadata and the compatibility mirror. The SDK
  // currently serializes only its known tool fields, so add securitySchemes here.
  server.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: mcpTools.map((tool) => {
    const write = tool.method === "POST";
    const securitySchemes = write ? [{ type: "oauth2", scopes: ["drafts:write"] }] : [{ type: "noauth" }];
    return { name: tool.name, description: tool.description, inputSchema: z.toJSONSchema(tool.schema),
      annotations: { readOnlyHint: !write, destructiveHint: false, openWorldHint: write }, securitySchemes, _meta: { securitySchemes } };
  }) }));
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request, { parsedBody });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } finally { await server.close(); }
}
