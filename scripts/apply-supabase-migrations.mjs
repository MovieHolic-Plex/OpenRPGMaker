#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SQL } from "bun";
import {
  catalogMigrationStates,
  listUntrackedMigrationFiles,
  loadSupabaseEnvironment,
  migrationPlan,
  probeSupabaseSchema,
  SUPABASE_MIGRATIONS,
  verifyAiPersistence,
} from "./lib/supabase-database-ops.mjs";

const root = process.cwd();
const env = loadSupabaseEnvironment(root);
const databaseUrl = (env.SUPABASE_DB_URL ?? "").trim();
const restConfig = {
  url: (env.VITE_SUPABASE_URL ?? "").trim(),
  anonKey: (env.VITE_SUPABASE_ANON_KEY ?? "").trim(),
  projectId: (env.VITE_SUPABASE_PROJECT_ID ?? "").trim(),
};

if (!databaseUrl) fail("SUPABASE_DB_URL is required; keep the admin DSN in .env.local, not in git");
if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) fail("SUPABASE_DB_URL must be a PostgreSQL connection URL");
if (!restConfig.url || !restConfig.anonKey || !restConfig.projectId) {
  fail("VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_SUPABASE_PROJECT_ID are required");
}
const untracked = listUntrackedMigrationFiles(root);
if (untracked.length > 0) fail(`Unregistered migrations: ${untracked.join(", ")}`);

const database = new SQL(databaseUrl, { max: 1 });
try {
  await database.unsafe(`
    create schema if not exists rpg_zzu;
    create table if not exists rpg_zzu.schema_migrations (
      filename text primary key,
      sha256 text not null,
      baselined boolean not null default false,
      applied_at timestamptz not null default now()
    );
    revoke all on rpg_zzu.schema_migrations from anon, authenticated;
  `);

  const appliedRows = await database.unsafe("select filename, sha256 from rpg_zzu.schema_migrations order by filename");
  const applied = new Map(appliedRows.map((row) => [row.filename, row.sha256]));
  const catalogRows = await readCatalog(database);
  const grantRows = await readGrants(database);
  const states = catalogMigrationStates(SUPABASE_MIGRATIONS, catalogRows, grantRows);
  const plan = migrationPlan(SUPABASE_MIGRATIONS, applied, states);

  for (const item of plan) {
    const filePath = path.join(root, "supabase", "migrations", item.file);
    const checksum = sha256(readFileSync(filePath));
    if (item.action === "skip") {
      if (applied.get(item.file) !== checksum) throw new Error(`Applied migration checksum changed: ${item.file}`);
      console.log(`SKIP ${item.file}`);
      continue;
    }
    if (item.action === "baseline") {
      await database`
        insert into rpg_zzu.schema_migrations (filename, sha256, baselined)
        values (${item.file}, ${checksum}, true)
      `;
      console.log(`BASELINE ${item.file}`);
      continue;
    }
    await database.begin(async (transaction) => {
      await transaction.file(filePath);
      const afterRows = await readCatalog(transaction);
      const afterGrants = await readGrants(transaction);
      const afterState = catalogMigrationStates([item], afterRows, afterGrants)[item.file];
      if (afterState !== "complete") throw new Error(`${item.file} did not satisfy its schema contract`);
      await transaction`
        insert into rpg_zzu.schema_migrations (filename, sha256, baselined)
        values (${item.file}, ${checksum}, false)
      `;
    });
    console.log(`APPLY ${item.file}`);
  }

  await database.unsafe(`
    revoke all on rpg_zzu.schema_migrations from anon, authenticated;
    notify pgrst, 'reload schema';
  `);
} finally {
  await database.close();
}

let report = null;
for (let attempt = 0; attempt < 10; attempt += 1) {
  report = await probeSupabaseSchema(restConfig);
  if (Object.values(report.states).every((state) => state === "complete")) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!report || Object.values(report.states).some((state) => state !== "complete")) {
  fail(`PostgREST schema cache is still incomplete: ${JSON.stringify(report?.states ?? {})}`);
}
const verification = await verifyAiPersistence(restConfig);
if (verification.probeRetained) await removeRetainedProbeRows(verification);
console.log(`VERIFIED project=${restConfig.projectId} activityReloaded=${verification.activityReloaded} conversationReloaded=${verification.conversationReloaded} probeRetained=${verification.probeRetained}`);

async function removeRetainedProbeRows(probe) {
  const admin = new SQL(databaseUrl, { max: 1 });
  try {
    await admin`delete from rpg_zzu.ai_activity_logs where project_id = ${restConfig.projectId} and log_id = ${probe.activityId}::uuid`;
    await admin`delete from rpg_zzu.ai_conversations where project_id = ${restConfig.projectId} and conversation_id = ${probe.conversationId}`;
  } finally {
    await admin.close();
  }
}

async function readGrants(client) {
  return client.unsafe(`
    select table_schema, table_name, grantee, privilege_type
    from information_schema.role_table_grants
    where table_schema in ('rpg_zzu', 'public')
  `);
}

async function readCatalog(client) {
  return client.unsafe(`
    select table_schema, table_name, column_name
    from information_schema.columns
    where table_schema in ('rpg_zzu', 'public')
  `);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fail(message) {
  console.error(`Supabase migration failed: ${message}`);
  process.exit(1);
}
