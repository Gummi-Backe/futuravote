import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
let entry;
try { entry = require.resolve("braces/package.json"); }
catch { console.log("braces is absent (production-only install); no lint mitigation needed."); process.exit(0); }
const root = path.dirname(entry);
const metadata = JSON.parse(await readFile(entry, "utf8"));
if (metadata.version !== "3.0.3") throw new Error("Review the braces mitigation for this new version before installing.");
const marker = "/* FutureVote CVE-2026-93687 depth guard */";
const definitions = [
  ["parse.js", "e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310", "  while (index < length) {", "\n    if (stack.length > 128) throw new SyntaxError('FutureVote: brace nesting exceeds safe depth limit');"],
  ["compile.js", "dc98f22eee3d511785d92a00758d5f0d48efed5f5813bdecc2de430c529b5c9f", "const compile = (ast, options = {}) => {", "\n  require('./fv-depth-guard.cjs')(ast);"],
  ["expand.js", "41ccc196ebfa7b7781a634e721eb744e4e7bcb54cba427a7e3d6806a1b9e58f7", "const expand = (ast, options = {}) => {", "\n  require('./fv-depth-guard.cjs')(ast);"],
  ["stringify.js", "379f22d77bfa1478341ccd49c5e4267464aabcbba03558bab332aac23fc6f23a", "module.exports = (ast, options = {}) => {", "\n  require('./fv-depth-guard.cjs')(ast);"],
];
await copyFile(new URL("./braces-depth-guard.cjs", import.meta.url), path.join(root, "lib", "fv-depth-guard.cjs"));
for (const [name, expectedHash, anchor, addition] of definitions) {
  const filename = path.join(root, "lib", name);
  const source = await readFile(filename, "utf8");
  const patched = source.replace(anchor, `${anchor}${addition}`).replace("'use strict';", `'use strict';\n${marker}`);
  if (source.includes(marker)) {
    const original = source.replace(`${anchor}${addition}`, anchor).replace(`'use strict';\n${marker}`, "'use strict';");
    if (!source.includes(`${anchor}${addition}`) || createHash("sha256").update(original).digest("hex") !== expectedHash) {
      throw new Error(`Unexpected braces mitigation in ${name}`);
    }
    continue;
  }
  if (createHash("sha256").update(source).digest("hex") !== expectedHash || patched === source) {
    throw new Error(`Unexpected braces source: ${name}; refusing to apply an unverified patch.`);
  }
  await writeFile(filename, patched);
}
console.log("braces 3.0.3: bounded parser and AST walkers applied. Upstream audit warning remains visible.");
