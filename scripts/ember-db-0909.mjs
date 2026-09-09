// Dedicated Ember persistence receipt. --save refuses existing rows; --verify is read-only.
// No environment variable or argument can change the authorized project id.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { ViteNodeServer } from "vite-node/server";
import { ViteNodeRunner } from "vite-node/client";

const root = fileURLToPath(new URL("../", import.meta.url));
assert.equal(process.cwd(), root.replace(/\/$/, ""), "Run inside this script's worktree");
const mode = process.argv[2];
assert(process.argv.length === 3 && ["--save", "--verify"].includes(mode), "Use --save or --verify");
const projectId = "rpg-zzu-event-command-ember-20260908";
const out = join(root, "output/evidence/event-command-completion/ember-db-20260909");
const env = Object.fromEntries(readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/).flatMap(line => {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  return match ? [[match[1], match[2].replace(/^["']|["']$/g, "")]] : [];
}));
assert(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY, "Required .env.local credentials present");
const config = { projectId, url: env.VITE_SUPABASE_URL.replace(/\/$/, ""), anonKey: env.VITE_SUPABASE_ANON_KEY };
const headers = { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, "Accept-Profile": "rpg_zzu" };
const digest = value => createHash("sha256").update(JSON.stringify(value, (_key, item) => {
  if (item === null || typeof item !== "object" || Array.isArray(item)) return item;
  return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
})).digest("hex");
const write = (name, data) => writeFileSync(join(out, name), JSON.stringify(data, null, 2) + "\n");
mkdirSync(out, { recursive: true });
const requests = [];
const pending = new Set();
const nativeFetch = globalThis.fetch;
// Observe real HTTP without changing requests. Reject any mutation outside the dedicated target.
globalThis.fetch = (input, init = {}) => {
  const operation = (async () => {
    const url = new URL(String(input));
    assert.equal(url.origin, new URL(config.url).origin, "Only configured Supabase origin allowed");
    const table = url.pathname.split("/").at(-1);
    const method = init.method ?? "GET";
    if (method !== "GET") {
      assert.equal(mode, "--save", "Verification must never write");
      assert(["projects", "maps", "tilesets"].includes(table), "Only real project persistence tables allowed");
      if (method === "POST") {
        const body = JSON.parse(String(init.body));
        const rows = Array.isArray(body) ? body : [body];
        assert(rows.length > 0 && rows.every(row => row.project_id === projectId), "Every write row must be the authorized target");
      } else {
        assert.equal(method, "DELETE", "Unexpected persistence mutation");
        assert(["maps", "tilesets"].includes(table), "Never delete a project");
        assert.equal(url.searchParams.get("project_id"), `eq.${projectId}`);
      }
    }
    const entry = { method, table, query: url.searchParams.toString(), startedAt: new Date().toISOString() };
    requests.push(entry);
    const response = await nativeFetch(input, { ...init, signal: AbortSignal.timeout(60000) });
    entry.status = response.status;
    entry.ok = response.ok;
    return response;
  })();
  pending.add(operation);
  operation.then(() => pending.delete(operation), () => pending.delete(operation));
  return operation;
};
let server;
let report = { projectId, mode, processId: process.pid, startedAt: new Date().toISOString(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), requests };
const reportName = mode === "--save" ? "save-receipt.json" : "reload-verification.json";
try {
  // Connectivity first, then exact row lookup. Neither query mutates remote state.
  const connectivity = await fetch(`${config.url}/rest/v1/projects?select=project_id&limit=0`, { headers });
  assert.equal(connectivity.status, 200, "BLOCKER: Supabase connectivity required");
  await connectivity.json();
  report.connectivity = { status: connectivity.status, ok: true };
  const query = new URLSearchParams({ project_id: `eq.${projectId}`, select: "project_id,current_json,current_sha256,map_count,tileset_count,updated_at" });
  const target = await fetch(`${config.url}/rest/v1/projects?${query}`, { headers });
  assert.equal(target.status, 200);
  const rows = await target.json();
  assert(Array.isArray(rows));
  report.target = { status: target.status, rowCount: rows.length, observedAt: new Date().toISOString() };
  if (mode === "--save") {
    assert.deepEqual(rows, [], "BLOCKER: target exists; never overwrite it or retry --save");
    report.target.unused = true;
    report.target.state = "absent";
  } else {
    assert.equal(rows.length, 1, "Saved row must exist exactly once");
    assert.equal(rows[0].project_id, projectId);
  }
  server = await createServer({ root, configFile: false, logLevel: "error",
    cacheDir: join(root, "node_modules/.vite-ember-db-0909"),
    resolve: { alias: { "@": join(root, "src") } }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { watch: null, hmr: false },
  });
  await server.pluginContainer.buildStart({});
  const transform = new ViteNodeServer(server);
  const runner = new ViteNodeRunner({ root, base: server.config.base,
    fetchModule: id => transform.fetchModule(id), resolveId: (id, importer) => transform.resolveId(id, importer),
  });
  const loadModule = path => runner.executeFile(join(root, path));
  const sync = await loadModule("src/project/supabaseProjectSync.ts");
  const refs = await loadModule("src/project/io/references.ts");
  const lint = await loadModule("src/project/lint/projectLint.ts");
  const battle = await loadModule("src/battle/battleBattlers.ts");
  const io = await loadModule("src/project/io.ts");
  function inspect(project) {
    const event = project.maps.map_mist_forest.events.find(entry => entry.id === "ev_forest_slime");
    assert(event, "First encounter event exists");
    const page = event.pages.find(entry => entry.id === "ev_forest_slime_fight");
    assert(page, "Authored fight page exists");
    const commands = page.commands.filter(command => command.kind === "battleProcessing");
    assert.equal(commands.length, 1);
    assert.equal(commands[0].troopId, "troop_slime_pair");
    assert.equal(project.system.initialTroopId, commands[0].troopId);
    const troop = project.database.troops.find(entry => entry.id === commands[0].troopId);
    assert(troop, "Encounter troop resolves");
    const expected = ["enemy_slime", "enemy_meadow_slime"];
    assert.deepEqual(troop.enemyIds, expected);
    assert.deepEqual(troop.members.map(member => member.enemyId), expected);
    const battlers = battle.enemyBattlers(project, troop);
    assert.deepEqual(battlers.map(battler => battler.recordId), expected, "Real runtime resolver preserves both species");
    refs.validateProjectReferences(project);
    const referenceIssues = refs.collectProjectReferenceIssues(project);
    assert.deepEqual(referenceIssues, []);
    const lintIssues = lint.projectLint(project);
    const validation = { referenceIssues: referenceIssues.length,
      lint: { errors: lintIssues.filter(issue => issue.severity === "error").length,
        warnings: lintIssues.filter(issue => issue.severity === "warning").length,
        info: lintIssues.filter(issue => issue.severity === "info").length, total: lintIssues.length, issues: lintIssues } };
    // Record all warnings; lint passes means zero blocking errors, not suppressed warnings.
    report.lastValidation = validation;
    assert.equal(validation.lint.errors, 0, JSON.stringify(lintIssues));
    return { title: project.meta.title, version: project.version,
      counts: { maps: Object.keys(project.maps).length, tilesets: Object.keys(project.tilesets).length,
        events: Object.values(project.maps).reduce((sum, map) => sum + map.events.length, 0),
        enemies: project.database.enemies.length, troops: project.database.troops.length,
        actors: project.database.actors.length, items: project.database.items.length },
      startMapId: project.startMapId, startPos: project.startPos,
      encounter: { mapId: "map_mist_forest", eventId: event.id, pageId: page.id, troopId: troop.id,
        enemyIds: troop.enemyIds, memberEnemyIds: troop.members.map(member => member.enemyId),
        resolvedBattlers: battlers.map(battler => ({ recordId: battler.recordId, hp: battler.hp, hidden: battler.hidden })) },
      validation };
  }
  if (mode === "--save") {
    const builder = await loadModule("src/project/defaults/emberQuestGame.ts");
    const authored = builder.createEmberQuestProject();
    report.authored = inspect(authored);
    // Recheck immediately before persistence so module loading does not widen the preflight window.
    assert.equal(await sync.loadProjectFromSupabase(config), null, "BLOCKER: real loader must still find target absent");
    write(reportName, report);
    const saved = await sync.saveProjectToSupabase(authored, config);
    report.save = { kind: saved.kind, sha256: saved.sha256, completedAt: new Date().toISOString() };
    write(reportName, report); // Preserve a successful write receipt even if later assertions fail.
    assert.equal(saved.kind, "saved");
    report.savedWireCanonicalSha256 = digest(JSON.parse(io.serialize(saved.project)));
    report.persistencePath = "saveProjectToSupabase -> projects upsert -> maps/tilesets mirrors";
  } else {
    const saved = JSON.parse(readFileSync(join(out, "save-receipt.json"), "utf8"));
    assert.equal(saved.projectId, projectId);
    assert.equal(saved.save.kind, "saved");
    assert.notEqual(saved.processId, process.pid, "Reload must use a fresh OS process");
    report.saveProcessId = saved.processId;
    report.rawRow = { sha256: rows[0].current_sha256, canonicalSha256: digest(rows[0].current_json),
      mapCount: rows[0].map_count, tilesetCount: rows[0].tileset_count, updatedAt: rows[0].updated_at };
    assert.equal(report.rawRow.sha256, saved.save.sha256);
    assert.equal(report.rawRow.canonicalSha256, saved.savedWireCanonicalSha256, "Entire persisted JSON preserved");
    report.rawProject = inspect(rows[0].current_json);
    const reloaded = await sync.loadProjectFromSupabase(config);
    assert(reloaded, "Project must reload through real remote API; no local fallback");
    report.reloaded = inspect(reloaded);
    assert.deepEqual(report.reloaded, saved.authored, "Authored counts, encounter, start and validation survive reload");
    report.assertions = { freshProcess: true, rawWireHashMatchesSave: true, rawStoredFixValid: true,
      realLoaderUsed: true, bothSpeciesResolve: true, authoredSummaryPreserved: true,
      referencesPass: true, lintPass: true, remoteWrites: requests.filter(entry => entry.method !== "GET").length };
    report.persistencePath = "loadProjectFromSupabase -> projects current_json deserialize/repair -> maps mirror overlay";
  }
  await Promise.all([...pending]); // Includes the real loader's asynchronous commit-tip read.
  assert(requests.every(entry => entry.ok), "Every observed HTTP request must succeed");
  report.passed = true;
} catch (error) {
  report.passed = false;
  // Never emit raw HTTP error bodies or credentials.
  report.failure = { name: error.name, message: String(error.message).replaceAll(config.anonKey, "[REDACTED]") };
  process.exitCode = 1;
} finally {
  await Promise.allSettled([...pending]);
  if (server) await server.close();
  globalThis.fetch = nativeFetch;
  report.finishedAt = new Date().toISOString();
  report.exitCode = process.exitCode ?? 0;
  write(reportName, report);
  console.log(JSON.stringify(report, null, 2));
}
