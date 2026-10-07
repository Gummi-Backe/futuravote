import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getMcpConfig } from "../src/app/lib/mcpConfig.ts";
import { handleMcpRequest } from "../src/app/lib/mcpTools.ts";

test("official MCP client can initialize, read, generate an image and submit every poll type across independent HTTP requests", async () => {
  const calls: string[] = [];
  let origin = "";
  const server = createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const config = getMcpConfig({ NODE_ENV: "development", FV_MCP_PUBLIC_ORIGIN: origin });
      const response = await handleMcpRequest(new Request(`${origin}${req.url}`, {
        method: req.method, headers: req.headers as Record<string, string>,
        ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
      }), {
        config,
        authenticate: async (token) => token === "test-token" ? { clientId: config.storageClientId, scope: "drafts:write" } : null,
        dispatch: async (path, request) => {
          calls.push(path);
          if (path === "/api/gpt/categories") return Response.json({ categories: [{ category: "Politik" }] });
          if (path === "/api/gpt/generate-image") return Response.json({ imageUrl: "https://project.supabase.co/storage/v1/object/public/question-images/fresh.webp", imageCredit: "KI-Bild (OpenAI)" }, { status: 201 });
          const body = await request.json();
          assert.equal(body.confirmSubmit, true);
          assert.equal(body.imageCredit, "KI-Bild (OpenAI)");
          return Response.json(body.visibility === "link_only" ? { kind: "question", shareUrl: "https://www.future-vote.de/q/private-test" } : { kind: "draft", reviewUrl: "https://www.future-vote.de/drafts/test" }, { status: 201 });
        },
      });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch { res.writeHead(500); res.end("Test fixture failed"); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  origin = `http://127.0.0.1:${address.port}`;
  const client = new Client({ name: "futurevote-test", version: "1.0.0" });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), { requestInit: { headers: { authorization: "Bearer test-token" } } }));
    assert.equal((await client.listTools()).tools.length, 7);
    const categories = await client.callTool({ name: "getCategories", arguments: {} });
    assert.equal(categories.isError, false);
    const image = await client.callTool({ name: "generateDraftImage", arguments: { prompt: "Neutraler Blick auf eine Stadt" } });
    const imageData = image.structuredContent as Record<string, string>;
    for (const type of ["opinion", "prediction", "private"]) {
      for (const mode of ["binary", "options"]) {
        const args = { title: "Soll unsere Stadt autofrei werden?", description: "Neutraler Kontext ".repeat(65), category: "Politik",
          imageUrl: imageData.imageUrl, imageCredit: imageData.imageCredit, confirmSubmit: true,
          visibility: type === "private" ? "link_only" : "public", isResolvable: type === "prediction", answerMode: mode,
          ...(mode === "options" ? { options: ["Ja", "Nein", "Teilweise"] } : {}),
          ...(type === "private" ? { closesAt: "2030-12-31T23:59:00Z" } : {}),
          ...(type === "prediction" ? { longDescription: "Hintergrund ".repeat(700), resolutionCriteria: "Amtlichen Beschluss pruefen", resolutionSource: "https://example.com/official", resolutionSources: ["https://example.com/official"], resolutionDeadline: "2030-12-31T23:59:00Z" } : {}),
        };
        const result = await client.callTool({ name: "createDraft", arguments: args });
        assert.equal(result.isError, false, `${type}/${mode}`);
        assert.equal((result.structuredContent as Record<string, string>).kind, type === "private" ? "question" : "draft");
      }
    }
    assert.equal(calls.filter((path) => path === "/api/drafts").length, 6);
  } finally {
    await client.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
