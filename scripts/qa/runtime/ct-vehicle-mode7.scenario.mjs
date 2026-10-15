import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// Pseudo-Mode7 flight view in the shipped player, authored only through place_vehicle{flightView:"mode7"} (ct-vehicle-mode7-fixture.mts).
// QA_FLIGHT_VIEW=flat renders the same flight without the filter (side-by-side baseline; the scenario id stays the same, compare the shots).
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/ct-vehicle-mode7-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/dist/cli.mjs", "--script", "scripts/qa/runtime/ct-vehicle-mode7-fixture.mts"], {
  maxBuffer: 200 * 1024 * 1024,
}));
const START = "map_blank_start";
export default {
  id: "ct-vehicle-mode7",
  projectFixture: fixture,
  beats: [
    { id: "walking", note: "On foot the view is the normal top-down camera", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitFor", testid: "title-screen", state: "absent" },
      { kind: "waitForRuntime" },
      { kind: "seed", seed: 1 },
    ], expect: { mapId: START, vehicleBoarded: null }, shot: true },
    { id: "board-airship", note: "Boarding the airship switches to the flight view (zoomed out, horizon perspective, sky)", ops: [
      { kind: "face", dir: "right" },
      { kind: "action" },
      { kind: "waitForPosition", mapId: START, x: 32, y: 24 },
      { kind: "hold", ms: 800 },
    ], expect: { mapId: START, x: 32, y: 24, vehicleBoarded: "airship" }, shot: true },
    { id: "fly-north", note: "Flying north over lakes and roads keeps the perspective", ops: [
      { kind: "dir", dir: "up" },
      { kind: "waitForPosition", mapId: START, x: 32, y: 14 },
      { kind: "dir", dir: null },
    ], expect: { mapId: START, vehicleBoarded: "airship" }, shot: true },
  ],
};
