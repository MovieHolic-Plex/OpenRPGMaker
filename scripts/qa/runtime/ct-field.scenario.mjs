import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// Chrono-Trigger-style field features, authored only through editor tools (ct-field-fixture.mts):
// party-derived followers (fromParty, no addFollower), changeParty "lead", a one-way ledge hop,
// and a white-flash time gate between two maps.
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/ct-field-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/vite-node.mjs", "--script", "scripts/qa/runtime/ct-field-fixture.mts"], {
  maxBuffer: 80 * 1024 * 1024,
}));

const START = "map_blank_start";
const PAST = "map_ct_past";

export default {
  id: "ct-field",
  projectFixture: fixture,
  beats: [
    { id: "party-followers", note: "New game: guardian and mage walk behind the hero with no addFollower authored", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitFor", testid: "title-screen", state: "absent" },
      { kind: "waitForRuntime" },
      { kind: "seed", seed: 1 },
      { kind: "waitForFollowers", count: 2, ids: ["actor:actor_guardian", "actor:actor_mage"] },
    ], expect: { mapId: START, x: 10, y: 8 }, shot: true },
    { id: "lead-switch", note: "changeParty lead: the mage becomes the field leader; hero and guardian follow", ops: [
      { kind: "teleport", mapId: START, x: 14, y: 8 },
      { kind: "waitForPosition", mapId: START, x: 14, y: 8 },
      { kind: "face", dir: "right" },
      { kind: "action" },
      { kind: "waitForLeader", actorId: "actor_mage", spriteResourceId: "easyrpg-charset-actor1" },
      { kind: "waitForFollowers", count: 2, ids: ["actor:actor_hero", "actor:actor_guardian"] },
    ], expect: { mapId: START, x: 14, y: 8 }, shot: true },
    { id: "ledge-hop", note: "Stepping down onto the ledge tile at (4,4) hops the player two tiles to (4,5)", ops: [
      { kind: "teleport", mapId: START, x: 4, y: 3 },
      { kind: "waitForPosition", mapId: START, x: 4, y: 3 },
      { kind: "key", key: "ArrowDown" },
      { kind: "waitForLift" },
      { kind: "waitForGrounded" },
      { kind: "waitForPosition", mapId: START, x: 4, y: 5 },
    ], expect: { mapId: START, x: 4, y: 5 }, shot: true },
    { id: "ledge-blocks-up", note: "The ledge is one-way: walking up from (4,5) cannot climb back onto it", ops: [
      { kind: "hold", dir: "up", ms: 600 },
    ], expect: { mapId: START, x: 4, y: 5 } },
    { id: "time-gate", note: "Stepping on the time gate flashes white and transfers to the past map", ops: [
      { kind: "teleport", mapId: START, x: 17, y: 11 },
      { kind: "waitForPosition", mapId: START, x: 17, y: 11 },
      { kind: "key", key: "ArrowDown" },
      { kind: "waitForPosition", mapId: PAST, x: 6, y: 6, timeoutMs: 30_000 },
      { kind: "waitForFollowers", count: 2 },
    ], expect: { mapId: PAST, x: 6, y: 6 }, shot: true },
  ],
};
