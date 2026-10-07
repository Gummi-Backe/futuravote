import { createServer } from "node:http";
import { hashValue } from "../src/app/lib/mcpConfig.ts";
import { handleMcpAuthorize, pkceChallenge } from "../src/app/lib/mcpOAuth.ts";

// Loopback-only fixture: no real accounts, credentials, database or paid API calls.
let config;
const codes = [];
const store = {
  getSession: async (session) => session === "browser-fixture"
    ? { id: "fixture", label: "Lokales Testkonto", emailVerified: true } : null,
  saveCode: async (code) => { codes.push(code); },
};
const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, `http://${incoming.headers.host}`);
    if (url.pathname === "/begin") {
      const target = new URL("/api/mcp/oauth/authorize", config.origin);
      target.search = new URLSearchParams({ response_type: "code", client_id: config.clientId,
        redirect_uri: config.redirectUris[0], scope: "drafts:write", state: "browser-fixture",
        resource: config.resource, code_challenge: pkceChallenge("v".repeat(64)),
        code_challenge_method: "S256" }).toString();
      outgoing.writeHead(303, { Location: target.toString(), "Cache-Control": "no-store",
        "Set-Cookie": "fv_user=browser-fixture; HttpOnly; SameSite=Lax; Path=/" });
      outgoing.end();
      return;
    }
    if (url.pathname === "/callback") {
      const valid = url.origin === new URL(config.redirectUris[0]).origin &&
        url.searchParams.get("state") === "browser-fixture" &&
        url.searchParams.get("iss") === config.origin &&
        codes.some((code) => code.code_hash === hashValue(url.searchParams.get("code") ?? ""));
      console.log(`Browser callback: ${valid ? "PASS" : "FAIL"}`);
      outgoing.writeHead(valid ? 200 : 400, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      outgoing.end(`<h1>${valid ? "OAuth-Browsertest bestanden" : "OAuth-Browsertest fehlgeschlagen"}</h1><p>Nur lokale Testdaten. Kein echtes Konto verbunden.</p>`);
      return;
    }
    if (url.pathname !== "/api/mcp/oauth/authorize") {
      outgoing.writeHead(404); outgoing.end(); return;
    }
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const request = new Request(url, { method: incoming.method, headers: incoming.headers,
      ...(incoming.method === "POST" ? { body: Buffer.concat(chunks) } : {}) });
    const response = await handleMcpAuthorize(request, { config, store });
    outgoing.statusCode = response.status;
    for (const [name, value] of response.headers) if (name !== "set-cookie") outgoing.setHeader(name, value);
    const cookies = response.headers.getSetCookie();
    if (cookies.length) outgoing.setHeader("Set-Cookie", cookies);
    console.log(`Browser consent ${incoming.method}: ${response.status}`);
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500); outgoing.end("Fixture failed");
  }
});
server.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  const origin = `http://localhost:${port}`;
  config = { origin, resource: `${origin}/mcp`, clientId: "fixture", clientSecret: "local-fixture-only",
    storageClientId: "fixture", redirectUris: [`http://127.0.0.1:${port}/callback`] };
  console.log(`Local browser fixture: ${origin}/begin`);
});
