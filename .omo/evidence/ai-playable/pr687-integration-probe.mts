import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { ToolVerificationEvidence } from "../../../src/ai/toolVerificationEvidence";
import { runTool } from "../../../src/editor/tools";
import { createBlankProject } from "../../../src/project/defaults";

const upstream = "9a7069e685bad13cde5cbb22b9cb285e893f2356";
function compiledBlob(path: string): string {
  const source = execFileSync("git", ["show", `${upstream}:${path}`], { encoding: "utf8" });
  return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
}
const url = (source: string) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
// Load the two exact frozen upstream blobs without modifying their behavior or importing
// conflicted sources. Candidate execution below uses its actual registered scene runner.
const parserUrl = url(compiledBlob("src/ai/agentVerification.ts"));
const evidenceUrl = url(compiledBlob("src/ai/toolVerificationEvidence.ts").replace('"./agentVerification"', JSON.stringify(parserUrl)));
const { ToolVerificationEvidence: UpstreamEvidence } = await import(/* @vite-ignore */ evidenceUrl);

const context = { project: createBlankProject() };
const mapId = context.project.startMapId;
const itemId = context.project.database.items[0]!.id;
assert.equal(runTool(context, "place_npc", {
  mapId, id: "reward_npc", name: "Reward", x: 10, y: 7, graphic: { transparent: true },
  pages: [{ commands: [{ kind: "changeItem", itemId, op: "+=", amount: 5 }] }],
}).ok, true);
const steps = [
  { kind: "snapshotRewards" }, { kind: "interact", eventId: "reward_npc" },
  { kind: "expect", inventoryDelta: { [itemId]: 5 }, interactionComplete: true },
];
const args = { mapId, start: { x: 10, y: 8 }, steps };
const passingArgs = { ...args, steps: [{ kind: "face", dir: "up" }, ...steps] };
const passed = runTool(context, "run_scene_test", passingArgs);
assert.equal(passed.ok, true);
assert.equal((passed.data as { ok: boolean }).ok, true);
const candidate = new ToolVerificationEvidence();
const frozen = new UpstreamEvidence();
for (const evidence of [candidate, frozen]) evidence.observe("run_scene_test", passingArgs, passed);
context.project.maps[mapId]!.events = context.project.maps[mapId]!.events.filter(event => event.id !== "reward_npc");
for (const evidence of [candidate, frozen]) evidence.invalidateAfterWrite();
assert.deepEqual(candidate.problems(), []);
assert.equal(frozen.problems().length, 1);

const candidateNavigation = new ToolVerificationEvidence();
const upstreamNavigation = new UpstreamEvidence();
const withSet = { ...args, steps: [{ kind: "set", x: 10, y: 8 }, ...steps] };
// Recreate only the minimum unit fixture; this never reaches store or persistence.
assert.equal(runTool(context, "place_npc", {
  mapId, id: "reward_npc", name: "Reward", x: 10, y: 7, graphic: { transparent: true },
  pages: [{ commands: [{ kind: "changeItem", itemId, op: "+=", amount: 5 }] }],
}).ok, true);
const failed = runTool(context, "run_scene_test", withSet);
assert.equal(failed.ok, true);
assert.equal((failed.data as { ok: boolean }).ok, false);
const corrected = runTool(context, "run_scene_test", passingArgs);
assert.equal((corrected.data as { ok: boolean }).ok, true);
for (const evidence of [candidateNavigation, upstreamNavigation]) {
  evidence.observe("run_scene_test", withSet, failed);
  evidence.invalidateAfterWrite();
  evidence.observe("run_scene_test", passingArgs, corrected);
}
assert.equal(candidateNavigation.problems().length, 1);
assert.deepEqual(upstreamNavigation.problems(), []);
console.log(JSON.stringify({
  candidate: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), upstream,
  unadoptedPassingProbeRemoved: { candidate: candidate.problems(), upstream: frozen.problems() },
  removedDebugPositioningStep: { candidate: candidateNavigation.problems(), upstream: upstreamNavigation.problems() },
  boundary: "Real candidate runTool/scene runner; exact frozen upstream evidence and verdict parser; no network, DB, model or browser execution",
}, null, 2));
