import { INTERIOR_ROOM_DEMO_PLANS, runInteriorRoomPipeline, VR } from "../src/editor/interiorRoomPipeline.ts";

const plan = INTERIOR_ROOM_DEMO_PLANS.find((p) => p.theme === "study")!;
const map = runInteriorRoomPipeline(plan).map;
const w = map.width;

function chip(t: number) {
  return `(${t % 30},${Math.floor(t / 30)})`;
}

console.log("wings", plan.wings, "door", plan.door);
console.log("key cells:");
for (const [x, y] of [
  [1, 1],
  [1, 2],
  [1, 3],
  [2, 1],
  [2, 2],
  [2, 3],
  [2, 4],
  [2, 5],
  [3, 2],
  [3, 3],
  [4, 2],
  [4, 3],
  [1, 10],
  [1, 11],
  [2, 11],
  [5, 11],
]) {
  const L = map.lowerTiles[y * w + x]!;
  const U = map.upperTiles[y * w + x]!;
  console.log(`map(${x},${y}) L=${L} chip${chip(L)} U=${U}`);
}

console.log("\ngrid y0-6 x0-10:");
for (let y = 0; y <= 6; y++) {
  const row: string[] = [];
  for (let x = 0; x <= 10; x++) {
    const L = map.lowerTiles[y * w + x]!;
    row.push(String(L).padStart(3));
  }
  console.log(`y${y}`, row.join(" "));
}

console.log("\ngold-like expected NW for floor starting (2,5):");
console.log("cap y2: CNW@x2 EN... ; post x1 EDGE_W");
console.log("VR", {
  CNW: VR.CORNER_NW,
  EN: VR.EDGE_N,
  EW: VR.EDGE_W,
  IL: VR.INNER_L,
  BODY: VR.BODY,
  EE: VR.EDGE_E,
  CNE: VR.CORNER_NE,
  ES: VR.EDGE_S,
  BSW: VR.BEAM_SW,
});
