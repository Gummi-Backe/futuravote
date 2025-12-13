'use strict';

// Synchronisiert die Inhalte der lokalen SQLite-DB (dev.db)
// nach Supabase. Kann beliebig oft ausgeführt werden; Datensätze
// werden per Upsert anhand der Primärschlüssel aktualisiert.

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Env aus .env.local laden
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Fehlende Supabase-Umgebungsvariablen. Bitte NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY (empfohlen) in .env.local setzen.'
  );
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    'Warnung: SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt. Die Synchronisation laeuft mit dem anon-Key und kann bei aktivierter RLS fehlschlagen.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Pfad zur lokalen SQLite-DB ermitteln (wie in src/app/data/db.ts)
const DATA_ROOT =
  process.env.DATA_DIR ?? (process.env.VERCEL ? '/tmp/futuravote' : path.join(process.cwd(), 'data'));
const DB_PATH = path.join(DATA_ROOT, 'dev.db');

if (!fs.existsSync(DB_PATH)) {
  console.error('Lokale SQLite-DB wurde nicht gefunden:', DB_PATH);
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });

async function upsertInBatches(table, rows) {
  if (!rows.length) return;

  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch);
    if (error) {
      throw new Error(`Upsert in Tabelle "${table}" fehlgeschlagen: ${error.message}`);
    }
  }
}

async function syncQuestions() {
  const rows = db.prepare('SELECT * FROM questions').all();
  console.log(`Fragen: ${rows.length} Datensätze werden synchronisiert...`);

  const mapped = rows.map((q) => ({
    id: q.id,
    title: q.title,
    summary: q.summary,
    description: q.description,
    region: q.region,
    image_url: q.imageUrl,
    image_credit: q.imageCredit,
    category: q.category,
    category_icon: q.categoryIcon,
    category_color: q.categoryColor,
    closes_at: q.closesAt, // TEXT (ISO) -> date
    yes_votes: q.yesVotes,
    no_votes: q.noVotes,
    views: q.views,
    status: q.status,
    ranking_score: q.rankingScore,
    created_at: q.createdAt,
  }));

  await upsertInBatches('questions', mapped);
  console.log('Fragen synchronisiert.');
}

async function syncDrafts() {
  const rows = db.prepare('SELECT * FROM drafts').all();
  console.log(`Drafts: ${rows.length} Datensätze werden synchronisiert...`);

  const mapped = rows.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    region: d.region,
    image_url: d.imageUrl,
    image_credit: d.imageCredit,
    category: d.category,
    votes_for: d.votesFor,
    votes_against: d.votesAgainst,
    time_left_hours: d.timeLeftHours,
    target_closes_at: d.targetClosesAt,
    status: d.status,
    created_at: d.createdAt,
  }));

  await upsertInBatches('drafts', mapped);
  console.log('Drafts synchronisiert.');
}

async function main() {
  try {
    console.log('Starte Synchronisation von SQLite nach Supabase...');
    await syncQuestions();
    await syncDrafts();
    console.log('Synchronisation abgeschlossen.');
  } catch (err) {
    console.error('Fehler bei der Synchronisation:', err);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();

