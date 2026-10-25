// 장면 재생 녹화용 길찾기 — 저장본 맵에서 제품 통행 판정(canMove)으로 최단 경로를 낸다.
//   bun sceneRoute.mts <live.json> <mapId> <fx> <fy> <tx> <ty> [blocked "x,y;x,y"]
// 목표 칸이 막혔거나 이벤트 칸이면 상하좌우 이웃까지 걸어 그 칸을 바라보는 방향(face)을 함께 낸다.
// 출력: {"moves":[...],"face":"up"|null,"reached":bool}
import { readFileSync } from "node:fs";
import { canMove } from "../../../project/collision";
import type { Project } from "../../../project/types";

type Dir = "up" | "down" | "left" | "right";
const [file, mapId, fx, fy, tx, ty, blockedArg] = process.argv.slice(2);
const project = JSON.parse(readFileSync(file!, "utf8")) as Project;
const map = project.maps[mapId!];
if (!map) { console.log(JSON.stringify({ moves: [], face: null, reached: false, error: "no map" })); process.exit(0); }
const blocked = new Set((blockedArg ?? "").split(";").filter(Boolean));
const start = { x: Number(fx), y: Number(fy) }, goal = { x: Number(tx), y: Number(ty) };
const steps: [Dir, number, number][] = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]];
const key = (x: number, y: number) => `${x},${y}`;
const goalOpen = !blocked.has(key(goal.x, goal.y));
const prev = new Map<string, { from: string; dir: Dir }>();
const queue: [number, number][] = [[start.x, start.y]];
prev.set(key(start.x, start.y), { from: "", dir: "down" });
let end: string | null = null, face: Dir | null = null;
const isGoal = (x: number, y: number): Dir | null | "on" => {
  if (x === goal.x && y === goal.y && goalOpen) return "on";
  for (const [dir, dx, dy] of steps) if (x + dx === goal.x && y + dy === goal.y) return dir;
  return null;
};
while (queue.length) {
  const [x, y] = queue.shift()!;
  const hit = isGoal(x, y);
  if (hit === "on") { end = key(x, y); face = null; break; }
  if (hit && !goalOpen) { end = key(x, y); face = hit; break; }
  for (const [dir, dx, dy] of steps) {
    const nx = x + dx, ny = y + dy, k = key(nx, ny);
    if (prev.has(k)) continue;
    if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
    const onGoal = nx === goal.x && ny === goal.y;
    if (!onGoal && blocked.has(k)) continue;
    if (onGoal && !goalOpen) continue;
    if (!canMove(project, map, x, y, nx, ny) && !onGoal) continue;
    if (onGoal && !canMove(project, map, x, y, nx, ny)) {
      // Bump doors: a blocked door cell fires when walked into. Stop next to it and face it.
      if (!end) { end = key(x, y); face = dir; }
      continue;
    }
    prev.set(k, { from: key(x, y), dir });
    queue.push([nx, ny]);
  }
  if (end) break;
}
const moves: Dir[] = [];
for (let at = end; at && prev.get(at)?.from; at = prev.get(at)!.from) moves.unshift(prev.get(at)!.dir);
console.log(JSON.stringify({ moves, face, reached: Boolean(end) }));
