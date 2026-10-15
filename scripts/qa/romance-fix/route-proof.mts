// 시작 칸 → 상대 옆 칸까지의 걷기 경로를 엔진 통행(isPassable/canMove)으로 BFS 해 proof.json 에 쓴다. 런타임 QA 시나리오 입력.
//   bun scripts/qa/romance-fix/route-proof.mts <project.json> <proof.json> [targetEventId]
import { readFileSync, writeFileSync } from "node:fs";
import { deserialize } from "../../../src/project/io.ts";
import { canMove, isPassable } from "../../../src/project/collision.ts";
const [file, out, targetId = "ev_romance_partner"] = process.argv.slice(2) as [string, string, string?];
const project = deserialize(readFileSync(file, "utf8"));
const map = project.maps[project.startMapId]!;
const target = map.events.find(e => e.id === targetId);
if (!target) throw new Error("대상 이벤트가 시작 맵에 없다: " + targetId);
const dirs = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]] as const;
const key = (x: number, y: number) => y * map.width + x;
const prev = new Map<number, { from: number; dir: string }>();
const queue = [key(project.startPos.x, project.startPos.y)];
prev.set(queue[0]!, { from: -1, dir: "" });
let goal = -1;
for (let head = 0; head < queue.length && goal < 0; head++) {
  const cell = queue[head]!; const cx = cell % map.width, cy = Math.floor(cell / map.width);
  if (Math.abs(cx - target.x) + Math.abs(cy - target.y) === 1) { goal = cell; break; }
  for (const [dir, dx, dy] of dirs) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height || prev.has(key(x, y))) continue;
    if (!isPassable(project, map, x, y) || !canMove(project, map, cx, cy, x, y) || (x === target.x && y === target.y)) continue;
    prev.set(key(x, y), { from: cell, dir }); queue.push(key(x, y));
  }
}
if (goal < 0) throw new Error("상대 옆 칸까지 걸어 닿는 길이 없다");
const moves: { kind: "move"; dir: string }[] = [];
for (let c = goal; prev.get(c)!.from >= 0; c = prev.get(c)!.from) moves.unshift({ kind: "move", dir: prev.get(c)!.dir });
const at = { x: goal % map.width, y: Math.floor(goal / map.width) };
const face = (["up", "down", "left", "right"] as const).find((d, i) => at.x + dirs[i]![1] === target.x && at.y + dirs[i]![2] === target.y)!;
writeFileSync(out, JSON.stringify({ mapId: map.id, mapName: map.name, start: project.startPos, partner: { x: target.x, y: target.y }, at, face, moves }, null, 1));
console.log(JSON.stringify({ steps: moves.length, at, face }));
