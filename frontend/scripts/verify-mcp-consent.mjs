import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { renderMcpConsent } from "../src/app/lib/mcpOAuth.ts";

const packagePath = process.argv[2];
if (!packagePath) throw new Error("Pass the installed Playwright package path.");
const require = createRequire(import.meta.url);
const { chromium } = require(packagePath);
const out = new URL("../dist/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const width of [320, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 900 : 844 } });
    await page.setContent(renderMcpConsent(new URLSearchParams({ resource: "https://gpt-write.future-vote.de/mcp" }), "test-nonce", "Roland Testkonto"));
    const layout = await page.evaluate(() => {
      const controls = [...document.querySelectorAll("button")].map((element) => {
        const rect = element.getBoundingClientRect();
        return { text: element.textContent, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
          fits: element.scrollWidth <= element.clientWidth };
      });
      return { viewport: innerWidth, document: document.documentElement.scrollWidth, controls };
    });
    assert.ok(layout.document <= layout.viewport, `Horizontal overflow at ${width}`);
    for (const control of layout.controls) assert.ok(control.fits && control.left >= 0 && control.right <= width, `Control overflow at ${width}`);
    const [first, second] = layout.controls;
    assert.ok(first.right <= second.left || first.bottom <= second.top, "Consent buttons overlap");
    await page.screenshot({ path: new URL(`mcp-consent-${width}.png`, out).pathname.replace(/^\/(\w:)/, "$1"), fullPage: true });
    await page.setContent(renderMcpConsent(new URLSearchParams(), "test-nonce", "a".repeat(220)));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Long account labels overflow");
    await page.close();
    console.log(`Consent layout OK: ${width}px, no overlap, long labels wrap.`);
  }
} finally { await browser.close(); }
