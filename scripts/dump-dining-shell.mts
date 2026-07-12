import { INTERIOR_ROOM_DEMO_PLANS, runInteriorRoomPipeline, VR } from "../src/editor/interiorRoomPipeline.ts";

const plan = INTERIOR_ROOM_DEMO_PLANS.find((p) => p.theme === "dining")!;
const { map, log, warnings } = runInteriorRoomPipeline(plan);
const w = map.width;
console.log("plan", plan);
console.log("log", log, warnings);

function chip(t: number) {
  return `${t}(${t % 30},${Math.floor(t / 30)})`;
}

for (const [x, y] of [
  [6, 9],
  [9, 9],
  [5, 9],
  [7, 9],
  [10, 9],
  [10, 10],
  [2, 8],
  [2, 10],
  [5, 8],
  [6, 8],
]) {
  console.log(`(${x},${y}) L=${chip(map.lowerTiles[y * w + x]!)} U=${map.upperTiles[y * w + x]}`);
}

console.log("\nfull lower:");
for (let y = 0; y < map.height; y++) {
  const row: string[] = [];
  for (let x = 0; x < map.width; x++) {
    row.push(String(map.lowerTiles[y * w + x]).padStart(3));
  }
  console.log(String(y).padStart(2), row.join(" "));
}

console.log("VR", {
  FLOOR: VR.FLOOR,
  ES: VR.EDGE_S,
  EW: VR.EDGE_W,
  EE: VR.EDGE_E,
  AL: VR.ALCOVE_L,
  AR: VR.ALCOVE_R,
  BODY: VR.BODY,
});
