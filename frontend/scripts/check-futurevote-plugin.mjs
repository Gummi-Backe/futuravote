import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";
import { mcpTools } from "../src/app/lib/mcpTools.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const plugin = path.join(root, "plugins", "futurevote");
const json = async (name) => JSON.parse(await readFile(path.join(plugin, name), "utf8"));
const manifest = await json("plugin.json");
const mcp = await json("mcp.json");
assert.equal(manifest.name, "futurevote");
assert.equal(mcp.mcpServers.futurevote.type, "streamable-http");
assert.equal(mcp.mcpServers.futurevote.url, "https://gpt-write.future-vote.de/mcp");
assert.ok(!mcp.mcpServers.futurevote.headers, "Never package bearer tokens or secrets");
const instructions = await readFile(path.join(root, "FUTUREVOTE_GPT_INSTRUCTIONS.md"), "utf8");
const packaged = await readFile(path.join(plugin, "skills/futurevote/references/instructions.md"), "utf8");
assert.equal(packaged, instructions, "Run npm run build:plugin after updating GPT instructions");
const sources = await Promise.all([
  readFile(path.join(root, "frontend/public/futuravote-gpt-openapi.yaml"), "utf8"),
  readFile(path.join(root, "frontend/src/app/api/gpt/openapi/write/route.ts"), "utf8"),
]);
const legacyTools = sources.join("\n").matchAll(/operationId:\s*(\w+)/g);
assert.deepEqual(mcpTools.map((tool) => tool.name).sort(), [...legacyTools].map((match) => match[1]).sort());
const meta = await sharp(path.join(plugin, "assets/icon.png")).metadata();
assert.equal(meta.width, 512);
assert.equal(meta.height, 512);
assert.equal(manifest.extensions["com.openai"].interface.composerIcon, "./assets/icon.png");
console.log("FutureVote plugin contract OK: all 7 Actions, identical instructions, HTTPS MCP, 512px icon, no packaged credentials.");
