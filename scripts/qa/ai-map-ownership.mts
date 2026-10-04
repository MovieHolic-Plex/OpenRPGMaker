// Focused ownership probe. Real relay/team/queue code, controlled worker completion.
// No provider calls or project persistence. Does not invoke a test runner or gates.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createBlankProject } from "../../src/project/defaults/blankProject.ts";
import { runPiTeam } from "../lib/piTeamRuntime.ts";
import { startRelayedRun, cancelRelayedRun, resetRelayForTests } from "../lib/piRunRelay.mjs";
import { createStampOrderQueue } from "../../src/editor/stampOrderQueue.ts";
import type { PiAgentRequest, PiAgentDoneEvent } from "../../src/ai/piAgent/protocol.ts";
import type { PiToolShape } from "../../src/ai/piAgent/toolAdapter.ts";
import { defaultTeamSpec } from "../../src/ai/piAgent/teamSpec.ts";
import { createMapRunLocks, settleMapRuns } from "../../src/ai/piAgent/mapRunLocks.mjs";

const checks: string[] = [];
const record = (name: string) => { checks.push(name); console.log(`PASS ${name}`); };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const project = createBlankProject();
project.tilesets = {};
project.assets = { ...project.assets, uploaded: {} };
const source = project.maps[Object.keys(project.maps)[0]!]!;
project.maps = Object.fromEntries(["a", "child", "b"].map(id => [id, { ...structuredClone(source), id, name: id }]));
project.mapTree = { mapId: "a", children: [{ mapId: "child", children: [] }] };
const done = (request: PiAgentRequest): PiAgentDoneEvent => ({ type: "done", project: request.project, changedKeys: [], stats: { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 } });

const ownership = createMapRunLocks();
const parentClaim = ownership.acquire("probe", ["a", "b"], "parent");
assert.equal(parentClaim.ok, true);
let finishRemaining!: () => void;
const remaining = new Promise<void>(resolve => { finishRemaining = resolve; });
const grouped = settleMapRuns([Promise.reject(new Error("first worker failed")), remaining]).catch(() => { if (parentClaim.ok) parentClaim.release(); });
await tick();
assert.equal(ownership.acquire("probe", ["b"], "too-early").ok, false);
finishRemaining(); await grouped;
const nextClaim = ownership.acquire("probe", ["b"], "after-stop");
assert.equal(nextClaim.ok, true); if (nextClaim.ok) nextClaim.release();
record("A child failure does not release the parent's map ownership while another child runs");

// Relay reservations precede async worker startup and survive socket detach/cancel.
let starts = 0;
const streams: ReadableStreamDefaultController<Uint8Array>[] = [];
const start = async () => { starts++; return { ndjson: new ReadableStream<Uint8Array>({ start(controller) { streams.push(controller); } }) }; };
const body = (id: string, mapId: string, projectKey = "probe") => ({ runId: id, mode: "single", provider: "controlled", task: "probe", mapIds: [mapId], scopeStrict: true, projectKey, project });
try {
  const a = await startRelayedRun(body("probe-a-000", "a"), start);
  assert.equal(a.status, 200);
  const duplicate = await startRelayedRun(body("probe-a-001", "a"), start);
  assert.equal(duplicate.body.code, "map-busy");
  assert.equal((await startRelayedRun(body("probe-child-000", "child"), start)).body.code, "map-busy");
  const b = await startRelayedRun(body("probe-b-000", "b"), start);
  assert.equal(b.status, 200); assert.equal(starts, 2);
  record("Relay blocks same map and owned child before worker startup; different map starts");
  await a.ndjson.cancel();
  cancelRelayedRun("probe-a-000");
  assert.equal((await startRelayedRun(body("probe-a-002", "a"), start)).body.code, "map-busy");
  record("Disconnect/cancel does not release ownership before worker stops");
  streams[0]!.close(); await tick();
  const again = await startRelayedRun(body("probe-a-003", "a"), start);
  assert.equal(again.status, 200);
  streams[1]!.error(new Error("controlled worker failure")); await tick();
  const afterFailure = await startRelayedRun(body("probe-b-001", "b"), start);
  assert.equal(afterFailure.status, 200);
  record("Relay releases completed and failed workers; map can be reused");
  streams[2]!.close(); streams[3]!.close(); await tick();
  await assert.rejects(startRelayedRun(body("probe-start-fail", "a"), async () => { throw new Error("startup failed"); }));
  const afterStartupFailure = await startRelayedRun(body("probe-start-again", "a"), start);
  assert.equal(afterStartupFailure.status, 200); streams[4]!.close(); await tick();
  record("Worker startup failure releases the reservation");
} finally { resetRelayForTests(); }

// Team reviewers and builders use one reservation table, including bundled children.
const gates = new Map<string, () => void>();
const started: string[] = [];
const call = async (tools: readonly PiToolShape[], name: string, params: unknown) => {
  const result = await tools.find(tool => tool.name === name)!.execute("probe", params);
  return JSON.parse(result.content[0]!.text!);
};
await runPiTeam({ mode: "team", provider: "controlled", task: "ownership", mapIds: [], project, team: { version: 1, orchestratorNotes: "", members: defaultTeamSpec().members } }, {
  runAgent: async (request, options) => {
    const tools = options.extraTools ?? [];
    if (tools.some(tool => tool.name === "assign_map_agent")) {
      await call(tools, "assign_map_agent", { mapId: "a", task: "first" });
      await assert.rejects(call(tools, "assign_map_agent", { mapId: "a", task: "duplicate" }));
      await assert.rejects(call(tools, "assign_map_agent", { mapId: "child", task: "child" }));
      await assert.rejects(call(tools, "review_map", { mapId: "a" }));
      await call(tools, "assign_map_agent", { mapId: "b", task: "parallel" });
      assert.deepEqual(started, ["a", "b"]);
      record("Team blocks duplicate/child/review during construction; another map runs");
      gates.get("a")!(); gates.get("b")!();
      await call(tools, "wait_agents", {});
      const review = call(tools, "review_map", { mapId: "a" });
      await assert.rejects(call(tools, "assign_map_agent", { mapId: "a", task: "during review" }));
      await assert.rejects(call(tools, "review_map", { mapId: "a" }));
      await assert.rejects(call(tools, "assign_task_agent", { mode: "project", task: "during review" }));
      await assert.rejects(call(tools, "finish", { report: "premature" }));
      record("Review blocks construction, another review, project write and premature finish");
      gates.get("review")!(); await review;
      await call(tools, "assign_map_agent", { mapId: "a", task: "after review" });
      gates.get("a")!(); await call(tools, "wait_agents", {});
      record("Map can be reassigned after reviewer finishes");
      return done(request);
    }
    const reviewing = tools.some(tool => tool.name === "report_review");
    const key = reviewing ? "review" : request.mapIds[0]!;
    started.push(key);
    await new Promise<void>(resolve => gates.set(key, resolve));
    if (reviewing) await call(tools, "report_review", { ok: true, findings: [] });
    return done(request);
  },
});

// Rapid stamp orders on separated regions of one map still run sequentially.
const pending: (() => void)[] = [];
const stamps: string[] = [];
const queue = createStampOrderQueue({ projectKey: () => "stamp-probe", mapSize: () => ({ width: 20, height: 20 }), run: input => {
  stamps.push(input.text);
  return new Promise(resolve => pending.push(() => resolve({ ok: true, applied: 0, lines: [], usedModel: false })));
} });
try {
  queue.enqueue({ mapId: "a", text: "first", selection: { mapId: "a", x: 0, y: 0, width: 2, height: 2 } });
  queue.enqueue({ mapId: "a", text: "second", selection: { mapId: "a", x: 10, y: 10, width: 2, height: 2 } });
  queue.enqueue({ mapId: "b", text: "other", selection: null });
  assert.deepEqual(stamps, ["first", "other"]);
  pending[0]!(); await tick();
  assert.deepEqual(stamps, ["first", "other", "second"]);
  pending[1]!(); pending[2]!(); await tick();
  record("Separated stamp regions on one map are serialized; another map runs concurrently");
} finally { queue.dispose(); }

mkdirSync("verify-shots/ai-map-ownership", { recursive: true });
writeFileSync("verify-shots/ai-map-ownership/controlled.json", JSON.stringify({ mode: "Real relay/team/queue, controlled workers; no live models", checks }, null, 2));
