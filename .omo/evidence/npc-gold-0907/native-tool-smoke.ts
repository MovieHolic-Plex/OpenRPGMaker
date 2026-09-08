import assert from "node:assert/strict";
import { createBlankProject } from "../../../src/project/defaults";
import { runTool } from "../../../src/editor/tools";
import { parseNpcRewardRequirements } from "../../../src/ai/intentDeclaration";
import { verifyNpcRewardsPlayable } from "../../../src/ai/workItemOutcome";

// Isolated fixture only. runTool publishes a replacement through context.project.
const context = { project: createBlankProject() };
context.project.session.gold = 37;
const mapId = context.project.startMapId;
const authored = runTool(context, "upsert_event", { mapId, event: {
  id: "currency_smoke", name: "Chief", x: 2, y: 3, trigger: { kind: "action" }, commands: [{
    kind: "fork", condition: { kind: "selfSwitch", key: "A", value: false }, then: [
      { kind: "changeGold", op: "+=", amount: 20 }, { kind: "setSelfSwitch", key: "A", value: true },
    ],
  }],
} });
assert.equal(authored.ok, true);
const original = JSON.stringify(context.project);
const required = parseNpcRewardRequirements([{
  target: { eventId: "currency_smoke" }, grants: [{ kind: "gold", count: 20 }], oneTime: true,
}]);
const npc = verifyNpcRewardsPlayable(context.project, required);
assert.deepEqual(npc, { ok: true });
const proof = runTool(context, "run_scene_test", { mapId, start: { x: 2, y: 2 }, steps: [
  { kind: "snapshotRewards" }, { kind: "interact", eventId: "currency_smoke" },
  { kind: "expect", goldDelta: 20, inventoryDelta: { gold: 0 }, interactionComplete: true },
  { kind: "snapshotRewards" }, { kind: "interact", eventId: "currency_smoke" },
  { kind: "expect", goldDelta: 0, inventoryDelta: { gold: 0 }, interactionComplete: true },
] });
assert.equal(proof.ok, true);
assert.equal(proof.data?.ok, true);
const state = proof.data?.finalState;
assert.ok(state && typeof state === "object" && "gold" in state);
assert.equal(state.gold, 57);
assert.equal(JSON.stringify(context.project), original);
console.log(JSON.stringify({ authored: authored.ok, npc, scene: proof.data?.ok,
  gold: state.gold, unchangedProject: true, log: proof.data?.log }, null, 2));
