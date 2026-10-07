import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const plugin = path.join(root, "plugins", "futurevote");
const instructions = await readFile(path.join(root, "FUTUREVOTE_GPT_INSTRUCTIONS.md"), "utf8");
await mkdir(path.join(plugin, "skills", "futurevote", "references"), { recursive: true });
await mkdir(path.join(plugin, "assets"), { recursive: true });
await writeFile(path.join(plugin, "skills", "futurevote", "references", "instructions.md"), instructions);
await copyFile(path.join(root, "frontend", "public", "icons", "icon-512.png"), path.join(plugin, "assets", "icon.png"));
console.log("FutureVote plugin: instructions synchronized; existing 512px brand icon packaged.");
