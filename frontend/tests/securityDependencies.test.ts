import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import nodemailer from "nodemailer";
import sharp from "sharp";
import { escapeHtml } from "../src/app/lib/htmlEscaping.ts";

const require = createRequire(import.meta.url);
const braces = require("braces");

test("email HTML escapes user names and quoted URL attributes", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  assert.equal(escapeHtml('https://example.com/?a=1&b="bad"'), "https://example.com/?a=1&amp;b=&quot;bad&quot;");
});

test("braces rejects malicious deep patterns before recursive traversal", () => {
  const pattern = "{".repeat(10000) + "a,b" + "}".repeat(10000);
  for (const method of [braces, braces.compile, braces.expand, braces.stringify, braces.parse]) {
    assert.throws(() => method(pattern), { name: "SyntaxError" });
  }
});

test("direct AST input and cycles cannot bypass the braces guard", () => {
  let ast: { type: string; nodes: unknown[] } = { type: "text", nodes: [] };
  for (let index = 0; index < 10000; index++) ast = { type: "brace", nodes: [ast] };
  const cycle: { nodes: unknown[] } = { nodes: [] }; cycle.nodes.push(cycle);
  for (const method of [braces.compile, braces.expand, braces.stringify]) {
    assert.throws(() => method(ast), { name: "SyntaxError" });
    assert.throws(() => method(cycle), { name: "SyntaxError" });
  }
});

test("normal Next.js lint glob behavior survives the mitigation", () => {
  assert.deepEqual(braces.expand("src/{app,lib}/**/*.{ts,tsx}"), ["src/app/**/*.ts", "src/app/**/*.tsx", "src/lib/**/*.ts", "src/lib/**/*.tsx"]);
  assert.equal(braces.compile("{a,b}"), "(a|b)");
  assert.equal(braces.stringify("{a,b}"), "{a,b}");
});

test("updated Nodemailer builds mail without contacting a real SMTP server", async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  const info = await transport.sendMail({ from: "FutureVote <no-reply@future-vote.de>", to: "test@example.com", subject: "FutureVote Test", text: "Bestaetigung", html: "<p>Bestaetigung</p>" });
  assert.ok(Buffer.isBuffer(info.message));
  assert.match(info.message.toString(), /test@example.com/);
  transport.close();
});

test("updated Sharp still produces the required 512x512 poll thumbnail", async () => {
  const input = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#38d7a0" } }).png().toBuffer();
  const result = await sharp(input).resize(512, 512, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer();
  const meta = await sharp(result).metadata();
  assert.equal(meta.width, 512);
  assert.equal(meta.height, 512);
  assert.equal(meta.format, "jpeg");
});
