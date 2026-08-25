#!/usr/bin/env node
import {
  listUntrackedMigrationFiles,
  loadSupabaseEnvironment,
  probeSupabaseSchema,
  SUPABASE_MIGRATIONS,
  verifyAiPersistence,
} from "./lib/supabase-database-ops.mjs";

const env = loadSupabaseEnvironment();
const config = {
  url: (env.VITE_SUPABASE_URL ?? "").trim(),
  anonKey: (env.VITE_SUPABASE_ANON_KEY ?? "").trim(),
  projectId: (env.VITE_SUPABASE_PROJECT_ID ?? "").trim(),
};
const json = process.argv.includes("--json");
const verifyWrites = process.argv.includes("--verify-ai");

try {
  const untracked = listUntrackedMigrationFiles();
  if (untracked.length > 0) throw new Error(`Unregistered migrations: ${untracked.join(", ")}`);
  if (!config.url || !config.anonKey) {
    throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required in .env or .env.local");
  }
  if (verifyWrites && !config.projectId) {
    throw new Error("VITE_SUPABASE_PROJECT_ID is required for --verify-ai");
  }

  const report = await probeSupabaseSchema(config);
  const incomplete = SUPABASE_MIGRATIONS
    .map((migration) => ({ file: migration.file, state: report.states[migration.file] }))
    .filter((entry) => entry.state !== "complete");
  let verification = null;
  if (incomplete.length === 0 && verifyWrites) verification = await verifyAiPersistence(config);

  const output = {
    ok: incomplete.length === 0,
    projectId: config.projectId || null,
    migrations: report.states,
    ...(verification ? {
      verification: {
        activityReloaded: verification.activityReloaded,
        conversationReloaded: verification.conversationReloaded,
      },
    } : {}),
  };
  if (json) console.log(JSON.stringify(output, null, 2));
  else {
    for (const migration of SUPABASE_MIGRATIONS) {
      const state = report.states[migration.file];
      console.log(`${state === "complete" ? "OK" : "MISSING"} ${migration.file} (${state})`);
    }
    if (verification) console.log("OK AI activity/conversation insert + reload + cleanup");
  }
  if (incomplete.length > 0) {
    console.error("Supabase schema is behind. Set SUPABASE_DB_URL and run npm run db:migrate.");
    process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (json) console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  else console.error(`Supabase schema check failed: ${message}`);
  process.exitCode = 1;
}
