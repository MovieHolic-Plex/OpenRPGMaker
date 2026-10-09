/**
 * 봉쇄 진단 — 특정 플랜을 시공한 뒤 문 BFS 도달 집합과 '문을 막은 타일'을 짚는다.
 *   npx vite-node --script scripts/adv-interior-diag.mts -- <plansJson> <caseId>
 */
import fs from "node:fs";
import {
  floorMaskFromPlan,
  reachableOpenCells,
  runInteriorRoomPipeline,
  type InteriorRoomPlan,
} from "../src/editor/interiorRoomPipeline.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { isPassable } from "../src/project/collision.ts";

const [plansJson, caseId] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const spec = JSON.parse(fs.readFileSync(plansJson!, "utf8")) as { cases: Array<{ id: string; plan?: InteriorRoomPlan }> };
const found = spec.cases.find((c) => c.id === caseId);
if (!found?.plan) throw new Error(`case with plan 없음: ${caseId}`);
const plan = found.plan;
const map = runInteriorRoomPipeline(plan).map;
const floor = floorMaskFromPlan(plan);
const reach = reachableOpenCells(map, floor, plan.door);
const w = map.width;

const project = createBlankProject();
const rows: string[] = [];
for (let y = 0; y < map.height; y += 1) {
  let line = String(y).padStart(2, " ") + " ";
  for (let x = 0; x < w; x += 1) {
    const i = y * w + x;
    const walkableFloor = isPassable(project, map, x, y) || map.upperTiles[i]! >= 0;
    if (!floor[i]) line += ".";
    else if (map.upperTiles[i]! >= 0 || !walkableFloor) line += "#";
    else if (reach.has(i)) line += " ";
    else line += "X";
  }
  rows.push(line);
}
console.log("   " + Array.from({ length: w }, (_, x) => String(x % 10)).join(""));
console.log(rows.join("\n"));
console.log("legend: . 비바닥/벽  # 가구점유  (공백) 문에서 도달  X 도달불가");

for (const d of plan.innerDoors ?? []) {
  const i = d.y * w + d.x;
  console.log(
    `innerDoor (${d.x},${d.y}) floor=${floor[i] === true} lower=${map.lowerTiles[i]} upper=${map.upperTiles[i]} reach=${reach.has(i)}`,
  );
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
    const nx = d.x + dx;
    const ny = d.y + dy;
    const ni = ny * w + nx;
    console.log(
      `   nb (${nx},${ny}) floor=${floor[ni] === true} lower=${map.lowerTiles[ni]} upper=${map.upperTiles[ni]} reach=${reach.has(ni)}`,
    );
  }
}
