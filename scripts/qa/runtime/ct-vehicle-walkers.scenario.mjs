import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// Walking vehicles in the shipped player, authored only through editor tools (ct-vehicle-walkers-fixture.mts):
// chocobo crosses a solid forest the walker cannot, a mine cart runs only on rail tiles, a raft sails a river but not the sea.
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/ct-vehicle-walkers-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/dist/cli.mjs", "--script", "scripts/qa/runtime/ct-vehicle-walkers-fixture.mts"], {
  maxBuffer: 200 * 1024 * 1024,
}));

const START = "map_blank_start";
const VEHICLES = "tex_easyrpg_charset_vehicles";
const ANIMAL = "tex_easyrpg_charset_animal";
const at = (x, y) => [{ kind: "teleport", mapId: START, x, y }, { kind: "waitForPosition", mapId: START, x, y }];

export default {
  id: "ct-vehicle-walkers",
  projectFixture: fixture,
  beats: [
    { id: "parked", note: "New game: chocobo, cart and raft are parked sprites on the field", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitFor", testid: "title-screen", state: "absent" },
      { kind: "waitForRuntime" },
      { kind: "seed", seed: 1 },
    ], expect: { mapId: START, vehicleBoarded: null, parkedVehicleSprites: ["chocobo", "cart", "raft"] }, shot: true },
    { id: "walker-blocked-by-forest", note: "On foot the solid forest at (4,2) blocks the hero at (3,2)", ops: [
      ...at(3, 2),
      { kind: "hold", dir: "right", ms: 600 },
    ], expect: { mapId: START, x: 3, y: 2, vehicleBoarded: null } },
    { id: "board-chocobo", note: "Facing the chocobo and pressing action boards it (Animal sheet)", ops: [
      ...at(1, 2),
      { kind: "face", dir: "right" },
      { kind: "action" },
      { kind: "waitForPosition", mapId: START, x: 2, y: 2 },
    ], expect: { mapId: START, x: 2, y: 2, vehicleBoarded: "chocobo", playerTextureKey: ANIMAL }, shot: true },
    { id: "chocobo-crosses-forest", note: "Holding right carries the chocobo through the 3-wide forest to (7,2)", ops: [
      { kind: "dir", dir: "right" },
      { kind: "waitForPosition", mapId: START, x: 7, y: 2 },
      { kind: "dir", dir: null },
    ], expect: { mapId: START, x: 7, y: 2, vehicleBoarded: "chocobo", playerTextureKey: ANIMAL }, shot: true },
    { id: "chocobo-blocked-by-water", note: "The lake cell at (8,2) stops the chocobo", ops: [
      { kind: "hold", dir: "right", ms: 600 },
    ], expect: { mapId: START, x: 7, y: 2, vehicleBoarded: "chocobo" } },
    { id: "get-off-chocobo", note: "Walk down one cell, action gets off onto (7,4); the chocobo stays at (7,3)", ops: [
      { kind: "dir", dir: "down" },
      { kind: "waitForPosition", mapId: START, x: 7, y: 3 },
      { kind: "dir", dir: null },
      { kind: "action" },
      { kind: "waitForPosition", mapId: START, x: 7, y: 4 },
    ], expect: { mapId: START, x: 7, y: 4, vehicleBoarded: null, parkedVehicleSprites: ["chocobo", "cart", "raft"] } },
    { id: "board-cart", note: "Facing the cart at (2,10) and pressing action boards it", ops: [
      ...at(1, 10),
      { kind: "face", dir: "right" },
      { kind: "action" },
      { kind: "waitForPosition", mapId: START, x: 2, y: 10 },
    ], expect: { mapId: START, x: 2, y: 10, vehicleBoarded: "cart", playerTextureKey: VEHICLES }, shot: true },
    { id: "cart-runs-on-rail", note: "Holding right runs the cart along the rail to its end (12,10)", ops: [
      { kind: "dir", dir: "right" },
      { kind: "waitForPosition", mapId: START, x: 12, y: 10 },
      { kind: "dir", dir: null },
    ], expect: { mapId: START, x: 12, y: 10, vehicleBoarded: "cart" } },
    { id: "cart-stays-on-rail", note: "Grass beyond the rail end and beside it stops the cart", ops: [
      { kind: "hold", dir: "right", ms: 600 },
      { kind: "hold", dir: "up", ms: 600 },
    ], expect: { mapId: START, x: 12, y: 10, vehicleBoarded: "cart" } },
    { id: "get-off-cart", note: "Action gets off onto the grass at (13,10)", ops: [
      { kind: "face", dir: "right" },
      { kind: "action" },
      { kind: "waitForPosition", mapId: START, x: 13, y: 10 },
    ], expect: { mapId: START, x: 13, y: 10, vehicleBoarded: null } },
    { id: "board-raft", note: "Facing the raft on the river at (16,5) and pressing action boards it", ops: [
      ...at(15, 5),
      { kind: "face", dir: "right" },
      { kind: "action" },
      { kind: "waitForPosition", mapId: START, x: 16, y: 5 },
    ], expect: { mapId: START, x: 16, y: 5, vehicleBoarded: "raft", playerTextureKey: VEHICLES }, shot: true },
    { id: "raft-refuses-sea", note: "The sea cell (17,5) next to the river stops the raft", ops: [
      { kind: "hold", dir: "right", ms: 600 },
    ], expect: { mapId: START, x: 16, y: 5, vehicleBoarded: "raft" } },
    { id: "raft-sails-river", note: "Holding up sails the raft up the river to (16,1)", ops: [
      { kind: "dir", dir: "up" },
      { kind: "waitForPosition", mapId: START, x: 16, y: 1 },
      { kind: "dir", dir: null },
    ], expect: { mapId: START, x: 16, y: 1, vehicleBoarded: "raft" }, shot: true },
    { id: "raft-stays-in-river", note: "Land to the left stops the raft; action gets off onto (15,1)", ops: [
      { kind: "hold", dir: "left", ms: 600 },
      { kind: "action" },
      { kind: "waitForPosition", mapId: START, x: 15, y: 1 },
    ], expect: { mapId: START, x: 15, y: 1, vehicleBoarded: null } },
  ],
};
