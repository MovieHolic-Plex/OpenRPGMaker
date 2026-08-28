import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import {
  buildAiActivityUrls,
  catalogMigrationStates,
  DEFAULT_AI_PROBE_IDS,
  listUntrackedMigrationFiles,
  loadSupabaseEnvironment,
  migrationPlan,
  probeSupabaseSchema,
  SUPABASE_MIGRATIONS,
  verifyAiPersistence,
} from "../scripts/lib/supabase-database-ops.mjs";

const fixtures = [];

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => rm(fixture, { force: true, recursive: true })));
});

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "rpg-zzu-supabase-"));
  fixtures.push(root);
  return root;
}

test("Supabase env loads .env, overlays .env.local, then overlays process values", async () => {
  const root = await fixture();
  await writeFile(path.join(root, ".env"), [
    "VITE_SUPABASE_URL=http://from-env.example",
    "VITE_SUPABASE_ANON_KEY=env-key",
    "VITE_SUPABASE_PROJECT_ID=env-project",
  ].join("\n"));
  await writeFile(path.join(root, ".env.local"), [
    "VITE_SUPABASE_ANON_KEY=local-key",
    "VITE_SUPABASE_PROJECT_ID=local-project",
  ].join("\n"));

  const env = loadSupabaseEnvironment(root, {
    VITE_SUPABASE_PROJECT_ID: "process-project",
  });

  assert.equal(env.VITE_SUPABASE_URL, "http://from-env.example");
  assert.equal(env.VITE_SUPABASE_ANON_KEY, "local-key");
  assert.equal(env.VITE_SUPABASE_PROJECT_ID, "process-project");
});

test("every deployable SQL migration is registered in the migration manifest", () => {
  assert.deepEqual(listUntrackedMigrationFiles(process.cwd()), []);
  assert.equal(SUPABASE_MIGRATIONS.some((migration) => migration.file.startsWith("DRAFT_")), false);
});

test("migration plan baselines complete legacy migrations and applies wholly missing ones", () => {
  const states = Object.fromEntries(SUPABASE_MIGRATIONS.map((migration, index) => [
    migration.file,
    index < 3 ? "complete" : "missing",
  ]));

  const plan = migrationPlan(SUPABASE_MIGRATIONS, new Map(), states);

  assert.deepEqual(plan.slice(0, 3).map((item) => item.action), ["baseline", "baseline", "baseline"]);
  assert.deepEqual(new Set(plan.slice(3).map((item) => item.action)), new Set(["apply"]));
  assert.equal(plan.length, SUPABASE_MIGRATIONS.length);
});

test("migration plan refuses a partial legacy schema instead of replaying unsafe SQL", () => {
  const states = Object.fromEntries(SUPABASE_MIGRATIONS.map((migration) => [migration.file, "missing"]));
  states[SUPABASE_MIGRATIONS[2].file] = "partial";

  assert.throws(
    () => migrationPlan(SUPABASE_MIGRATIONS, new Map(), states),
    /partially applied/i,
  );
});

test("migration plan rejects ledger entries whose schema contract has drifted", () => {
  const states = Object.fromEntries(SUPABASE_MIGRATIONS.map((migration) => [migration.file, "complete"]));
  const first = SUPABASE_MIGRATIONS[0];
  states[first.file] = "partial";

  assert.throws(
    () => migrationPlan(SUPABASE_MIGRATIONS, new Map([[first.file, "checksum"]]), states),
    /schema drift/i,
  );
});

test("remote AI activity URLs are always scoped to the configured project", () => {
  const urls = buildAiActivityUrls({
    url: "http://dbserver:8100/",
    projectId: "project alpha",
  }, 25);

  assert.match(urls.primary, /project_id=eq\.project\+alpha/);
  assert.match(urls.fallback, /project_id=eq\.project\+alpha/);
  assert.match(urls.primary, /limit=25/);
});

test("run filter narrows the activity query and drops the fallback table", () => {
  // ai_analysis_runs 에는 run_id 가 없다 — 폴백을 섞으면 다시 옆 런의 턴이 들어온다.
  const filtered = buildAiActivityUrls({ url: "http://dbserver:8100", projectId: "p1" }, 5, {
    runId: "11111111-2222-4333-8444-555555555555",
  });

  assert.match(filtered.primary, /run_id=eq\.11111111-2222-4333-8444-555555555555/);
  assert.match(filtered.primary, /select=[^&]*run_id/);
  assert.equal(filtered.fallback, null);
});

test("no run filter keeps run_id out of select so unmigrated databases still answer", () => {
  // 20260829000000 미적용 DB 에서 없는 컬럼을 select 하면 PostgREST 가 400 을 준다.
  const unfiltered = buildAiActivityUrls({ url: "http://dbserver:8100", projectId: "p1" }, 5);

  assert.equal(/run_id/.test(unfiltered.primary), false);
  assert.notEqual(unfiltered.fallback, null);
});

test("schema probe distinguishes missing tables from partially applied columns", async () => {
  const requests = [];
  const result = await probeSupabaseSchema({
    url: "http://dbserver:8100",
    anonKey: "anon-key",
  }, async (input, init) => {
    requests.push({ input: String(input), init });
    if (String(input).includes("/ai_activity_logs?")) {
      return new Response(JSON.stringify({ code: "PGRST205", message: "missing table" }), { status: 404 });
    }
    if (String(input).includes("/project_commits?") && String(input).includes("review_status")) {
      return new Response(JSON.stringify({ code: "PGRST204", message: "missing column" }), { status: 400 });
    }
    return new Response("[]", { status: 200 });
  });

  assert.equal(result.states["20260709000000_ai_activity_logs.sql"], "missing");
  assert.equal(result.states["20260706000000_commit_identity.sql"], "partial");
  assert.equal(requests.some((request) => request.init.headers["Accept-Profile"] === "public"), true);
  assert.equal(requests.every((request) => request.init.headers.apikey === "anon-key"), true);
});

test("catalog classification marks a present table with missing required columns as partial", () => {
  const rows = SUPABASE_MIGRATIONS.flatMap((migration) => migration.contracts.filter((contract) => contract.kind === "relation").flatMap((contract) => {
    const columns = contract.columns.length > 0 ? contract.columns : ["id"];
    return columns.map((column) => ({
      table_schema: contract.schema,
      table_name: contract.table,
      column_name: column,
    }));
  })).filter((row) => row.column_name !== "review_status");

  const states = catalogMigrationStates(SUPABASE_MIGRATIONS, rows);

  assert.equal(states["20260706000000_commit_identity.sql"], "partial");
  assert.equal(states["20260709000000_ai_activity_logs.sql"], "complete");
});

test("AI persistence verification inserts, reloads, and removes project-scoped probe rows", async () => {
  const requests = [];
  const result = await verifyAiPersistence({
    url: "http://dbserver:8100",
    anonKey: "anon-key",
    projectId: "project-one",
  }, async (input, init = {}) => {
    const request = { input: String(input), method: init.method ?? "GET", body: init.body };
    requests.push(request);
    if (request.method === "GET") return new Response(JSON.stringify([{ id: "found" }]), { status: 200 });
    return new Response(null, { status: request.method === "POST" ? 201 : 204 });
  }, {
    activityId: "11111111-1111-4111-8111-111111111111",
    conversationId: "schema-probe-conversation",
  });

  assert.equal(result.activityReloaded, true);
  assert.equal(result.conversationReloaded, true);
  assert.equal(requests.filter((request) => request.method === "POST").length, 2);
  assert.equal(requests.filter((request) => request.method === "GET").every((request) => request.input.includes("project_id=eq.project-one")), true);
  assert.equal(requests.filter((request) => request.method === "DELETE").length, 2);
});

test("catalog classification reads revoked-privilege contracts from grant rows", () => {
globalThis.revokeMigration = SUPABASE_MIGRATIONS.find((migration) => migration.contracts.some((contract) => contract.kind === "revoked-privilege"));
  assert.ok(revokeMigration, "a migration must declare revoked-privilege contracts");
globalThis.columnRows = SUPABASE_MIGRATIONS.flatMap((migration) => migration.contracts.filter((contract) => contract.kind === "relation").flatMap((contract) => {
globalThis.columns = contract.columns.length > 0 ? contract.columns : ["id"];
    return columns.map((column) => ({ table_schema: contract.schema, table_name: contract.table, column_name: column }));
  }));
globalThis.stillGranted = revokeMigration.contracts
    .filter((contract) => contract.kind === "revoked-privilege")
    .map((contract) => ({
      table_schema: contract.schema,
      table_name: contract.table,
      grantee: contract.role,
      privilege_type: contract.privilege,
    }));

  assert.equal(catalogMigrationStates(SUPABASE_MIGRATIONS, columnRows, stillGranted)[revokeMigration.file], "missing");
  assert.equal(catalogMigrationStates(SUPABASE_MIGRATIONS, columnRows, [])[revokeMigration.file], "complete");
});

test("AI persistence probe keeps deterministic ids so repeat upserts need no delete", async () => {
globalThis.seen = [];
globalThis.run = () => verifyAiPersistence({ url: "http://dbserver:8100", anonKey: "anon-key", projectId: "project-one" }, async (input, init = {}) => {
globalThis.method = init.method ?? "GET";
    seen.push(String(input));
    if (method === "GET") return new Response(JSON.stringify([{ id: "found" }]), { status: 200 });
    return new Response(null, { status: method === "POST" ? 201 : 204 });
  });
globalThis.first = await run();
globalThis.second = await run();

  assert.equal(first.activityId, second.activityId);
  assert.equal(first.activityId, DEFAULT_AI_PROBE_IDS.activityId);
  assert.equal(first.conversationId, DEFAULT_AI_PROBE_IDS.conversationId);
  assert.equal(seen.some((url) => url.includes(DEFAULT_AI_PROBE_IDS.conversationId)), true);
});

test("AI persistence verification treats a revoked probe delete as retained, not failed", async () => {
globalThis.result = await verifyAiPersistence({
    url: "http://dbserver:8100",
    anonKey: "anon-key",
    projectId: "project-one",
  }, async (input, init = {}) => {
globalThis.method = init.method ?? "GET";
    if (method === "GET") return new Response(JSON.stringify([{ id: "found" }]), { status: 200 });
    if (method === "DELETE") return new Response("permission denied for table", { status: 403 });
    return new Response(null, { status: 201 });
  });

  assert.equal(result.activityReloaded, true);
  assert.equal(result.probeRetained, true);
});
