import fs from "fs/promises";
import path from "path";
import type { VoteChoice } from "./store";

const DATA_DIR = path.join(process.cwd(), "data");
const VOTES_FILE = path.join(DATA_DIR, "votes.json");

export type SessionVotes = Record<string, Record<string, VoteChoice>>;

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

export async function loadSessionVotes(): Promise<SessionVotes> {
  try {
    await ensureDataDir();
    const raw = await fs.readFile(VOTES_FILE, "utf-8");
    return JSON.parse(raw) as SessionVotes;
  } catch {
    return {};
  }
}

export async function saveSessionVotes(data: SessionVotes) {
  await ensureDataDir();
  await fs.writeFile(VOTES_FILE, JSON.stringify(data, null, 2), "utf-8");
}
