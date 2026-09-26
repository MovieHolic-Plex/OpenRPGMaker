import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// Chrono Trigger criteria through the shipped player. The fixture is authored only through editor tools
// (scripts/qa/runtime/chrono-fixture.mts). Start stands just south of a visible field enemy.
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/chrono-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/vite-node.mjs", "--script", "scripts/qa/runtime/chrono-fixture.mts"], {
  maxBuffer: 80 * 1024 * 1024,
  env: { ...process.env, CHRONO_REPORT: join(temporary, "report.json") },
}));
const scene = (id) => `[data-testid="cinematic-sequence"]`;

export default {
  id: "chrono",
  projectFixture: fixture,
  beats: [
    { id: "ct-title", note: "improve_title_screen stage 3 + moonlitCastle effects", ops: [
      { kind: "waitForAttr", testid: "title-effects", attr: "data-title-effects-renderer", value: "webgl", timeoutMs: 30000 },
    ], expect: { testidPresent: ["title-screen", "title-effects"], visibleText: { "title-text": "시간의 문" } }, shot: true },
    { id: "ct-opening", note: "set_opening text scene plays before the map", ops: [
      { kind: "cinematic", action: "key", key: "Enter", selector: scene() },
    ], expect: { testidPresent: ["cinematic-sequence"], visibleText: { "cinematic-sequence": "가르디아" } }, shot: true },
    { id: "ct-field", note: "Opening skipped into the village; start cell south of the field enemy", ops: [
      { kind: "pressUntil", key: "Enter", testid: "cinematic-sequence", state: "absent", maxPresses: 8 },
      { kind: "waitForRuntime" },
      { kind: "seed", seed: 1 },
      { kind: "pressUntil", key: "z", testid: "dialogue-box", state: "absent", maxPresses: 12 },
    ], expect: { mapId: "map_era_present", x: 20, y: 23, testidAbsent: ["title-screen", "battle-scene"] }, shot: true },
    { id: "ct-battle", note: "Face the visible enemy and fight: chrono skin, gauge flow, 3-person party", ops: [
      { kind: "face", dir: "up" },
      { kind: "action" },
      { kind: "pressUntil", key: "z", testid: "battle-scene", state: "present", maxPresses: 16 },
      { kind: "waitFor", testid: "battle-actor-sprites", state: "present" },
      { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 30000 },
      { kind: "waitForAttr", testid: "battle-scene", attr: "data-battle-skin", value: "chrono", timeoutMs: 5000 },
    ], expect: { testidPresent: ["battle-scene", "battle-actor-sprites"] }, shot: true },
    { id: "ct-battle-attack", note: "Confirm an attack in the gauge battle", ops: [
      { kind: "key", key: "z" }, { kind: "key", key: "z" },
    ], expect: { testidPresent: ["battle-scene"] }, shot: true },
    { id: "ct-era-future", note: "Time gate destination: duplicated map with fog + dark lighting", ops: [
      { kind: "teleport", mapId: "map_era_future", x: 20, y: 16 },
      { kind: "waitForPosition", mapId: "map_era_future", x: 20, y: 16 },
    ], expect: { mapId: "map_era_future" }, shot: true },
    { id: "ct-castle", note: "build_castle map", ops: [
      { kind: "teleport", mapId: "map_castle", x: 24, y: 30 },
      { kind: "waitForPosition", mapId: "map_castle", x: 24, y: 30 },
    ], expect: { mapId: "map_castle" }, shot: true },
    { id: "ct-cave", note: "run_dungeon_room_pipeline cave with save point", ops: [
      { kind: "teleport", mapId: "map_cave", x: 29, y: 20 },
      { kind: "waitForPosition", mapId: "map_cave", x: 29, y: 20 },
    ], expect: { mapId: "map_cave" }, shot: true },
  ],
};
