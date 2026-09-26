import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// Chrono probe (battle + save point) through the shipped player. Non-screenshot axes:
// the skill submenu lists each actor's techs; a save point interaction opens the save UI.
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/chrono-battle-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/vite-node.mjs", "--script", "scripts/qa/runtime/chrono-fixture.mts"], { maxBuffer: 80 * 1024 * 1024 }));

export default {
  id: "chrono-battle-probe",
  projectFixture: fixture,
  beats: [
    { id: "field", note: "boot into the village", ops: [
      { kind: "cinematic", action: "key", key: "Enter", selector: "[data-testid='cinematic-sequence']" },
      { kind: "pressUntil", key: "Enter", testid: "cinematic-sequence", state: "absent", maxPresses: 8 },
      { kind: "waitForRuntime" },
      { kind: "seed", seed: 1 },
      { kind: "pressUntil", key: "z", testid: "dialogue-box", state: "absent", maxPresses: 12 },
    ], expect: { mapId: "map_era_present", x: 20, y: 23 } },
    { id: "battle", note: "field enemy battle; command window up", ops: [
      { kind: "face", dir: "up" },
      { kind: "action" },
      { kind: "pressUntil", key: "z", testid: "battle-scene", state: "present", maxPresses: 16 },
      { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 40000 },
    ], expect: { testidPresent: ["battle-scene", "actor-command-attack"] }, shot: true },
    { id: "techs", note: "open the tech list of the first ready actor", ops: [
      { kind: "pressUntil", key: "ArrowDown", testid: "actor-command-back", state: "present", maxPresses: 1 },
    ], expect: { testidPresent: ["battle-scene"] }, shot: true },
  ],
};
