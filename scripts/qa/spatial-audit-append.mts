import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createBlankProject } from "../../src/project/defaults/defaultProject";
import { serialize } from "../../src/project/io";
import { recordProjectCommit } from "../../src/project/projectCommitLog";
import { supabaseProjectConfig } from "../../src/project/supabaseProjectConfig";
import {
  peekLastRemoteCommitTip, recordProjectCommitToSupabase, saveProjectToSupabase,
  SupabaseProjectSyncError,
} from "../../src/project/supabaseProjectSync";
import { rawObject } from "../../src/project/spatial/persistenceWire";
import { sha256HexText } from "../../src/util/sha256";
import { postgrest } from "./spatial-postgrest.mts";
import { SqlSession } from "./spatial-db-session.mts";

const evidence = process.env["SPATIAL_TEST_EVIDENCE"];
assert(evidence?.includes("/output/evidence/tile-to-world/task-37/run."));
await using http = await postgrest(evidence);
const config = { ...http.config, projectId: "task37-audit" };
// Only this run's loopback target reaches the application's default-config caller.
process.env["VITE_SUPABASE_URL"] = config.url;
process.env["VITE_SUPABASE_ANON_KEY"] = config.anonKey;
process.env["VITE_SUPABASE_PROJECT_ID"] = config.projectId;
assert.deepEqual(supabaseProjectConfig(), config);
const project = createBlankProject();
assert.equal((await saveProjectToSupabase(project, config)).kind, "saved");
const input = { project, identity: { id: "task37", label: "fixture", kind: "human" },
  reviewStatus: "direct", summary: "first fixture", toolNames: ["task37-fixture"] } as const;

// Given the actual anon/authenticator identity with unchanged append-only ACLs.
await using sql = new SqlSession();
const privileges = await sql.query(`SELECT jsonb_build_object('table',t,'select',has_table_privilege('anon',t,'SELECT'),
 'insert',has_table_privilege('anon',t,'INSERT'),'update',has_table_privilege('anon',t,'UPDATE'),
 'delete',has_table_privilege('anon',t,'DELETE')) FROM unnest(ARRAY['rpg_zzu.project_commits','rpg_zzu.project_changes']) t;`);
for (const line of privileges) {
  const acl = rawObject(JSON.parse(line));
  assert.equal(acl.select, true); assert.equal(acl.insert, true);
  assert.equal(acl.update, false); assert.equal(acl.delete, false);
}
await writeFile(resolve(evidence, "privileges.json"), `[${privileges.join(",")}]`);
assert.equal(peekLastRemoteCommitTip(config.projectId), null);

// When the application's awaitable audit entry point writes a linked commit/change pair.
let first: Awaited<ReturnType<typeof recordProjectCommit>>;
try { first = await recordProjectCommit(input); }
catch (error) {
  if (!(error instanceof SupabaseProjectSyncError)) throw error;
  await writeFile(resolve(evidence, "rejected-receipt.json"), JSON.stringify({ status: error.status,
    body: error.message, tip: peekLastRemoteCommitTip(config.projectId) }, null, 2));
  assert.equal(peekLastRemoteCommitTip(config.projectId), null);
  throw error; // RED is a real failing run, never converted into a green result.
}
// Then the caller receives a persisted receipt only after both actual POSTs succeed.
assert.equal(first.persisted, true); assert(first.commitId);
assert.equal(peekLastRemoteCommitTip(config.projectId), first.commitId);
const auditPosts = http.trace.filter(exchange => exchange.method === "POST" &&
  ["/rest/v1/project_commits", "/rest/v1/project_changes"].includes(exchange.path));
assert.equal(auditPosts.length, 2);
for (const post of auditPosts) {
  assert.equal(post.status, 201);
  const preferenceIndex = post.requestHeaders.findIndex(header => header.toLowerCase() === "prefer");
  assert.equal(post.requestHeaders[preferenceIndex + 1], "return=minimal");
}

const readHeaders = { Authorization: `Bearer ${config.anonKey}`, "Accept-Profile": "rpg_zzu" };
const writeHeaders = { ...readHeaders, "Content-Profile": "rpg_zzu", "Content-Type": "application/json", Prefer: "return=minimal" };
async function rows(table: string): Promise<readonly Record<string, unknown>[]> {
  const response = await fetch(`${config.url}/rest/v1/${table}`, { headers: readHeaders, signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  const parsed: unknown = await response.json(); assert(Array.isArray(parsed));
  return parsed.map(rawObject);
}
const [commit] = await rows("project_commits"); const [change] = await rows("project_changes");
assert(commit && change);
assert.equal(commit.commit_id, first.commitId); assert.equal(change.commit_id, first.commitId);
assert.equal(commit.current_sha256, await sha256HexText(serialize(project)));
assert.equal(commit.parent_commit_id, null);
assert.deepEqual(rawObject(change.patch_json).toolNames, input.toolNames);

// Given an accepted first receipt; when a second audit is appended; then ancestry advances.
const second = await recordProjectCommit({ ...input, summary: "second fixture" });
assert(second.persisted && second.commitId && second.commitId !== first.commitId);
assert.equal(peekLastRemoteCommitTip(config.projectId), second.commitId);
const commits = await rows("project_commits"); const changes = await rows("project_changes");
assert.equal(commits.length, 2); assert.equal(changes.length, 2);
assert.equal(commits.find(row => row.commit_id === second.commitId)?.parent_commit_id, first.commitId);
assert(changes.some(row => row.commit_id === second.commitId));
await writeFile(resolve(evidence, "accepted-receipts.json"), JSON.stringify({ first, second,
  tip: peekLastRemoteCommitTip(config.projectId), commits, changes }, null, 2));

// Given existing immutable rows; each hostile request is one independent When.
// Then raw UPDATE/DELETE and merge attempts are denied, plain duplicate PKs conflict.
for (const fixture of [
  { table: "project_commits", key: "commit_id", row: commit, overwrite: { ...commit, message: "overwrite attempt" } },
  { table: "project_changes", key: "change_id", row: change, overwrite: { ...change, patch_json: { tampered: true } } },
]) {
  const endpoint = `${config.url}/rest/v1/${fixture.table}`;
  for (const method of ["PATCH", "DELETE"] as const) {
    const response = await fetch(`${endpoint}?${fixture.key}=eq.${fixture.row[fixture.key]}`, {
      method, headers: writeHeaders, ...(method === "PATCH" ? { body: JSON.stringify(fixture.overwrite) } : {}),
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 401); assert.equal(rawObject(await response.json()).code, "42501");
  }
  const duplicate = await fetch(endpoint, { method: "POST", headers: writeHeaders,
    body: JSON.stringify(fixture.overwrite), signal: AbortSignal.timeout(5000) });
  assert.equal(duplicate.status, 409); assert.equal(rawObject(await duplicate.json()).code, "23505");
  // Toggle only the suspected preference, against both fresh and duplicate IDs.
  for (const row of [fixture.overwrite, { ...fixture.overwrite,
    [fixture.key]: fixture.key === "commit_id" ? randomUUID() : 900001 }]) {
    const merge = await fetch(endpoint, { method: "POST", headers: { ...writeHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(row), signal: AbortSignal.timeout(5000) });
    assert.equal(merge.status, 401); assert.equal(rawObject(await merge.json()).code, "42501");
  }
  const expected = fixture.table === "project_commits" ? commits : changes;
  assert.deepEqual(await rows(`${fixture.table}?order=${fixture.key}`),
    [...expected].sort((a, b) => String(a[fixture.key]).localeCompare(String(b[fixture.key]))));
}

// Given a missing project's FK; when the actual writer tries an append; then no receipt advances.
const missing = { ...config, projectId: "task37-missing" };
await assert.rejects(recordProjectCommitToSupabase(input, missing), error =>
  error instanceof SupabaseProjectSyncError && error.status === 409 && rawObject(JSON.parse(error.message)).code === "23503");
assert.equal(peekLastRemoteCommitTip(missing.projectId), null);

// Given an ordinary legacy root; when its normal upsert runs again; then it still overwrites.
const updated = { ...project, meta: { ...project.meta, title: "ordinary upsert remains supported" } };
assert.equal((await saveProjectToSupabase(updated, config)).kind, "saved");
assert.equal((await rows(`projects?project_id=eq.${config.projectId}`))[0]?.title, updated.meta.title);
const rootPosts = http.trace.filter(exchange => exchange.method === "POST" && exchange.path.startsWith("/rest/v1/projects?"));
assert.equal(rootPosts.length, 2);
for (const post of rootPosts) assert(post.requestHeaders.includes("resolution=merge-duplicates,return=minimal"));
await writeFile(resolve(evidence, "result.json"), JSON.stringify({ result: "passed", deploymentProven: false,
  appendPosts: auditPosts.map(post => ({ path: post.path, status: post.status })),
  receiptsAdvanced: true, parentLinked: true, immutableRowsPreserved: true,
  duplicatePrimaryKeys: "409/23505", rawUpdateDeleteAndMerge: "401/42501",
  missingProject: "409/23503; tip unchanged", ordinaryUpsertPreserved: true }, null, 2));
console.log("Task37 real PostgREST append, receipt, immutability and ordinary-upsert checks passed.");
