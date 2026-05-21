// One-shot migration from the old Tauri SQLite store to Supabase.
//
// Reads ~/Library/Application Support/com.jschull.todo/todo.sqlite and upserts
// tasks/priorities/settings for a single user. Preserves UUIDs so re-runs are
// idempotent (on conflict do nothing).
//
// Auto-loads .env.local. Required keys there (or in shell env):
//   VITE_SUPABASE_URL  (or SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY
//   MIGRATE_EMAIL
//
// Run:
//   npx tsx scripts/migrate-sqlite-to-supabase.ts [--dry-run]

import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const loadEnvFile = (path: string) => {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
};
loadEnvFile(join(process.cwd(), ".env.local"));

type SqliteTask = {
  id: string;
  title: string;
  notes: string | null;
  deadline: string | null;
  scheduled_date: string | null;
  completed_at: string | null;
  priority_rank: number;
  created_at: string;
  updated_at: string;
};

type SqlitePriority = {
  week_start: string;
  text: string;
  created_at: string;
  updated_at: string;
};

type SqliteSetting = { key: string; value: string };

const SQLITE_PATH = join(
  homedir(),
  "Library/Application Support/com.jschull.todo/todo.sqlite",
);

const requireEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
};

const main = async () => {
  const dryRun = process.argv.includes("--dry-run");
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error("Missing SUPABASE_URL (or VITE_SUPABASE_URL).");
    process.exit(1);
  }
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requireEnv("MIGRATE_EMAIL");

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Looking up user ${email}…`);
  const { data: userList, error: userErr } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (userErr) {
    console.error("Failed to list users:", userErr.message);
    process.exit(1);
  }
  const user = userList.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!user) {
    console.error(`No Supabase user found with email ${email}.`);
    console.error("Sign in once via the web app to create the user, then re-run.");
    process.exit(1);
  }
  console.log(`Found user ${user.id}`);

  console.log(`Opening ${SQLITE_PATH}…`);
  const db = new Database(SQLITE_PATH, { readonly: true });

  const tasks = db
    .prepare(
      `SELECT id, title, notes, deadline, scheduled_date, completed_at,
              priority_rank, created_at, updated_at
         FROM tasks`,
    )
    .all() as SqliteTask[];

  const priorities = db
    .prepare(
      `SELECT week_start, text, created_at, updated_at FROM priorities`,
    )
    .all() as SqlitePriority[];

  const settings = db
    .prepare(`SELECT key, value FROM settings`)
    .all() as SqliteSetting[];

  console.log(
    `Read ${tasks.length} tasks, ${priorities.length} priorities, ${settings.length} settings.`,
  );

  if (dryRun) {
    console.log("\n--- dry run, sample task:");
    console.log(tasks[0]);
    console.log("--- dry run, priorities:");
    console.log(priorities);
    console.log("--- dry run, settings:");
    console.log(settings);
    return;
  }

  const taskRows = tasks.map((t) => ({
    id: t.id,
    user_id: user.id,
    title: t.title,
    notes: t.notes,
    deadline: t.deadline,
    scheduled_date: t.scheduled_date,
    completed_at: t.completed_at,
    priority_rank: t.priority_rank,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }));

  const priorityRows = priorities.map((p) => ({
    user_id: user.id,
    week_start: p.week_start,
    text: p.text,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));

  const settingRows = settings.map((s) => ({
    user_id: user.id,
    key: s.key,
    value: s.value,
  }));

  console.log("Upserting tasks…");
  const { error: tErr, count: tCount } = await supabase
    .from("tasks")
    .upsert(taskRows, { onConflict: "id", count: "exact" });
  if (tErr) {
    console.error("Tasks upsert failed:", tErr.message);
    process.exit(1);
  }
  console.log(`  tasks: ${tCount ?? taskRows.length} rows`);

  console.log("Upserting priorities…");
  const { error: pErr, count: pCount } = await supabase
    .from("priorities")
    .upsert(priorityRows, {
      onConflict: "user_id,week_start",
      count: "exact",
    });
  if (pErr) {
    console.error("Priorities upsert failed:", pErr.message);
    process.exit(1);
  }
  console.log(`  priorities: ${pCount ?? priorityRows.length} rows`);

  console.log("Upserting settings…");
  const { error: sErr, count: sCount } = await supabase
    .from("settings")
    .upsert(settingRows, { onConflict: "user_id,key", count: "exact" });
  if (sErr) {
    console.error("Settings upsert failed:", sErr.message);
    process.exit(1);
  }
  console.log(`  settings: ${sCount ?? settingRows.length} rows`);

  console.log("\nDone.");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
