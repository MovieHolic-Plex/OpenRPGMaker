import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// Vehicles in the shipped player, authored only through editor tools (ct-vehicle-fixture.mts):
// board a parked boat, sail across a lake the walker cannot enter, get off onto the shore,
// then fly the airship over a wall, get refused on a non-landing tile and land on the pad.
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/ct-vehicle-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/vite-node.mjs", "--script", "scripts/qa/runtime/ct-vehicle-fixture.mts"], {
  maxBuffer: 80 * 1024 * 1024,
}));

const START = "map_blank_start";
const VEHICLES = "tex_easyrpg_charset_vehicles";
const tap = (key, x, y) => [
  { kind: "key", key },
  { kind: "waitForPosition", mapId: START, x, y },
];

export default {
  id: "ct-vehicle",
  projectFixture: fixture,
  beats: [
    { id: "parked-vehicles", note: "New game: the guardian follows the hero; the boat and airship are parked sprites on the field", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitFor", testid: "title-screen", state: "absent" },
      { kind: "waitForRuntime" },
      { kind: "seed", seed: 1 },
      { kind: "waitForFollowers", count: 1, ids: ["actor:actor_guardian"] },
    ], expect: { mapId: START, x: 10, y: 8, vehicleBoarded: null, followerSpriteCount: 1, parkedVehicleSprites: ["boat", "airship"] }, shot: true },
    { id: "walker-blocked-by-lake", note: "On foot, the lake edge at (7,4) blocks the hero standing at (8,4)", ops: [
      { kind: "teleport", mapId: START, x: 8, y: 4 },
      { kind: "waitForPosition", mapId: START, x: 8, y: 4 },
      { kind: "hold", dir: "left", ms: 600 },
    ], expect: { mapId: START, x: 8, y: 4, vehicleBoarded: null } },
    { id: "board-boat", note: "Facing the parked boat and pressing action boards it: vehicle texture, followers hidden", ops: [
      { kind: "face", dir: "left" },
      { kind: "action" },
      { kind: "waitForPosition", mapId: START, x: 7, y: 4 },
      { kind: "waitForFollowers", count: 0 },
    ], expect: { mapId: START, x: 7, y: 4, vehicleBoarded: "boat", playerTextureKey: VEHICLES, followerSpriteCount: 0 }, shot: true },
    { id: "boat-crosses-lake", note: "Holding left sails the boat across the water tiles to the west shore (2,4)", ops: [
      { kind: "dir", dir: "left" },
      { kind: "waitForPosition", mapId: START, x: 2, y: 4 },
      { kind: "dir", dir: null },
    ], expect: { mapId: START, x: 2, y: 4, vehicleBoarded: "boat", playerTextureKey: VEHICLES } },
    { id: "boat-blocked-by-land", note: "The boat cannot leave the water: holding left at (2,4) stays put", ops: [
      { kind: "hold", dir: "left", ms: 600 },
    ], expect: { mapId: START, x: 2, y: 4, vehicleBoarded: "boat" } },
    { id: "get-off-boat", note: "Action gets off onto the walkable shore (1,4); the boat stays parked at (2,4) and the follower returns", ops: [
      { kind: "action" },
      { kind: "waitForPosition", mapId: START, x: 1, y: 4 },
      { kind: "waitForFollowers", count: 1 },
    ], expect: { mapId: START, x: 1, y: 4, vehicleBoarded: null, followerSpriteCount: 1, parkedVehicleSprites: ["boat"] }, shot: true },
    { id: "water-blocks-walker-again", note: "After getting off, a water tile the boat crossed blocks the walker again", ops: [
      { kind: "teleport", mapId: START, x: 4, y: 7 },
      { kind: "waitForPosition", mapId: START, x: 4, y: 7 },
      { kind: "hold", dir: "up", ms: 600 },
    ], expect: { mapId: START, x: 4, y: 7, vehicleBoarded: null } },
    { id: "board-airship", note: "Facing the airship at (11,10) and pressing action boards it", ops: [
      { kind: "teleport", mapId: START, x: 12, y: 10 },
      { kind: "waitForPosition", mapId: START, x: 12, y: 10 },
      { kind: "face", dir: "left" },
      { kind: "action" },
      { kind: "waitForPosition", mapId: START, x: 11, y: 10 },
      { kind: "waitForFollowers", count: 0 },
    ], expect: { mapId: START, x: 11, y: 10, vehicleBoarded: "airship", playerTextureKey: VEHICLES, followerSpriteCount: 0 }, shot: true },
    { id: "airship-refuses-landing", note: "(11,10) stone terrain has airshipLand off: action does not land", ops: [
      { kind: "action" },
      // 거절은 기다릴 사건이 없다 — 막힘 검증과 같이 이름 붙은 hold 로 몇 프레임을 흘린다.
      { kind: "hold", ms: 400 },
    ], expect: { mapId: START, x: 11, y: 10, vehicleBoarded: "airship", followerSpriteCount: 0 } },
    { id: "airship-flies-over-wall", note: "The airship crosses the impassable wall column x=13 one tap at a time and stops on the pad (16,10)", ops: [
      ...tap("ArrowRight", 12, 10),
      ...tap("ArrowRight", 13, 10),
      ...tap("ArrowRight", 14, 10),
      ...tap("ArrowRight", 15, 10),
      ...tap("ArrowRight", 16, 10),
    ], expect: { mapId: START, x: 16, y: 10, vehicleBoarded: "airship", playerTextureKey: VEHICLES }, shot: true },
    { id: "airship-lands", note: "(16,10) plain grass (no terrain record) allows landing: action lands, the airship stays parked and the follower returns", ops: [
      { kind: "action" },
      { kind: "waitForFollowers", count: 1 },
    ], expect: { mapId: START, x: 16, y: 10, vehicleBoarded: null, followerSpriteCount: 1, parkedVehicleSprites: ["boat", "airship"] }, shot: true },
  ],
};
