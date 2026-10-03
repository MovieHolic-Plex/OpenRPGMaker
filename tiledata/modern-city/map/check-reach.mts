/**
 * 예제 도시 맵 도달성 검사 — repo 엔진의 canMove(src/project/collision.ts)로 시작 위치에서 4방향 BFS 한다.
 *
 *   npx vite-node tiledata/modern-city/map/check-reach.mts [seed=1]
 *
 * 입력  tiledata/modern-city/map/modern-city-<seed>.json (맵)  +  modern-city-<seed>-plan.json (시작 위치·문 접근 칸)
 * 출력  표준출력 JSON + tiledata/modern-city/map/modern-city-<seed>-reach.json
 * 범위  타일 통행(층 규칙·★·방향 비트)만 본다. 이벤트·NPC·차량 움직임·미적 품질은 검사하지 않는다.
 */
import fs from "node:fs";
import path from "node:path";
import { canMove, isPassable } from "../../../src/project/collision";
import { createModernCityTileset } from "../../../src/project/defaults/modernCity";
import type { GameMap, Project } from "../../../src/project/types";

const seed = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 1);
const dir = path.dirname(new URL(import.meta.url).pathname);
const map = JSON.parse(fs.readFileSync(path.join(dir, `modern-city-${seed}.json`), "utf8")) as GameMap;
const plan = JSON.parse(fs.readFileSync(path.join(dir, `modern-city-${seed}-plan.json`), "utf8")) as { start: [number, number]; doors: [number, number][][] };
const tileset = createModernCityTileset();
const project = { tilesets: { [tileset.id]: tileset }, maps: { [map.id]: map } } as unknown as Project;

const [sx, sy] = plan.start;
const key = (x: number, y: number) => y * map.width + x;
const seen = new Set<number>([key(sx, sy)]);
const queue: [number, number][] = [[sx, sy]];
while (queue.length) {
  const [x, y] = queue.shift()!;
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen.has(key(nx, ny))) continue;
    if (canMove(project, map, x, y, nx, ny)) { seen.add(key(nx, ny)); queue.push([nx, ny]); }
  }
}
const walkable: number[] = [];
for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (isPassable(project, map, x, y)) walkable.push(key(x, y));
const accessCells = plan.doors.flat();
const unreachable = accessCells.filter(([x, y]) => !seen.has(key(x, y)));
const result = {
  engine: "src/project/collision.ts canMove / isPassable",
  seed, start: plan.start, startWalkable: isPassable(project, map, sx, sy),
  doors: plan.doors.length, accessCells: accessCells.length, unreachableAccessCells: unreachable,
  walkableCells: walkable.length, reachableCells: seen.size, walkableUnreachableCells: walkable.filter((i) => !seen.has(i)).length,
  tileIdRange: (() => {
    let bad = 0;
    for (const layer of [map.lowerTiles, map.lowerOverlayTiles ?? [], map.upperTiles, map.upperOverlayTiles ?? []]) for (const t of layer) if (t !== -1 && !(t >= 0 && t < tileset.count)) bad++;
    return { tilesetCount: tileset.count, outOfRange: bad };
  })(),
};
fs.writeFileSync(path.join(dir, `modern-city-${seed}-reach.json`), JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify(result));
