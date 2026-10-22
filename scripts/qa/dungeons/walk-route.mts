// 던전 걷기 영상 경로(2026-10-22): 조수가 저장·재로드한 프로젝트(live.json)에서 시작 칸 → (층 계단) → 보스 앞까지 실제 걸음 경로를 만든다.
//   bun scripts/qa/dungeons/walk-route.mts <run-dir> <out-dir>
// 보이는 적(…_foe…) 둘레 2칸은 되도록 피한다(영상 중간에 전투가 열리지 않게). 계단 이동 이벤트 칸을 밟아 층을 옮긴다.
import fs from "node:fs";
import path from "node:path";
import { isPassable } from "../../../src/project/collision.ts";
import type { GameMap, Project } from "../../../src/project/types.ts";

const [runDir, outDir] = process.argv.slice(2) as [string, string];
fs.mkdirSync(outDir, { recursive: true });
const project = JSON.parse(fs.readFileSync(path.join(runDir, "live.json"), "utf8")) as Project;
type P = { x: number; y: number };
const transferOf = (e: GameMap["events"][number]) => (e.pages?.[0]?.commands ?? []).find((c) => c.kind === "transfer") as { mapId: string; x: number; y: number } | undefined;
const blockers = (map: GameMap) => map.events.filter((e) => e.pages?.[0]?.priority === "same" && !e.pages?.[0]?.graphic?.transparent);
function bfs(map: GameMap, from: P, goal: (p: P) => boolean, avoid: Set<string>, allowGoalBlocked: Set<string>): P[] | null {
  const key = (p: P) => `${p.x},${p.y}`;
  const block = new Set(blockers(map).map((e) => `${e.x},${e.y}`));
  const prev = new Map<string, string>([[key(from), ""]]);
  const q: P[] = [from];
  while (q.length) {
    const c = q.shift()!;
    if (goal(c)) { const out: P[] = []; let k = key(c); while (k) { const [x, y] = k.split(",").map(Number); out.unshift({ x: x!, y: y! }); k = prev.get(k)!; } return out; }
    for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) {
      const n = { x: c.x + dx!, y: c.y + dy! }, k = key(n);
      if (prev.has(k) || n.x < 0 || n.y < 0 || n.x >= map.width || n.y >= map.height) continue;
      if (!allowGoalBlocked.has(k) && (!isPassable(project, map, n.x, n.y) || block.has(k) || avoid.has(k))) continue;
      prev.set(k, key(c)); q.push(n);
    }
  }
  return null;
}
const dirOf = (a: P, b: P) => (b.x > a.x ? "right" : b.x < a.x ? "left" : b.y > a.y ? "down" : "up");
let mapId = project.startMapId, pos: P = { x: project.startPos.x, y: project.startPos.y };
const segments: { mapId: string; mapName: string; from: P; moves: { kind: "move"; dir: string }[]; to: { mapId: string; x: number; y: number }; why: string }[] = [];
const seen = new Set<string>();
for (let guard = 0; guard < 6; guard += 1) {
  const map = project.maps[mapId]!;
  seen.add(mapId);
  const stair = map.events.find((e) => { const t = transferOf(e); return t && !seen.has(t.mapId) && project.maps[t.mapId]?.mapRole === "dungeon"; });
  const foes = map.events.filter((e) => /_foe|field_enemy/.test(e.id));
  const avoid = new Set<string>();
  for (const f of foes) for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) if (Math.abs(dx) + Math.abs(dy) <= 2) avoid.add(`${f.x + dx},${f.y + dy}`);
  let path: P[] | null, to: { mapId: string; x: number; y: number }, why: string;
  if (stair) {
    const t = transferOf(stair)!;
    const goalKey = `${stair.x},${stair.y}`;
    path = bfs(map, pos, (p) => p.x === stair.x && p.y === stair.y, avoid, new Set([goalKey])) ?? bfs(map, pos, (p) => p.x === stair.x && p.y === stair.y, new Set(), new Set([goalKey]));
    to = { mapId: t.mapId, x: t.x, y: t.y }; why = `계단 ${stair.id}`;
  } else {
    const boss = map.events.find((e) => /_boss$/.test(e.id)) ?? map.events.find((e) => /boss/.test(e.id))
      ?? map.events.filter((e) => /battle|field_enemy/.test(e.id)).sort((a, b) => (Math.abs(b.x - pos.x) + Math.abs(b.y - pos.y)) - (Math.abs(a.x - pos.x) + Math.abs(a.y - pos.y)))[0];
    if (!boss) { console.log("보스 없음", mapId); break; }
    const near = (p: P) => Math.abs(p.x - boss.x) + Math.abs(p.y - boss.y) === 2 && p.y >= boss.y;
    path = bfs(map, pos, near, avoid, new Set()) ?? bfs(map, pos, near, new Set(), new Set());
    const end = path?.[path.length - 1];
    to = { mapId, x: end?.x ?? pos.x, y: end?.y ?? pos.y }; why = `보스 ${boss.id} 앞`;
  }
  if (!path) { console.log("길 없음", mapId, why); break; }
  const moves = path.slice(1).map((p, i) => ({ kind: "move" as const, dir: dirOf(path![i]!, p) }));
  segments.push({ mapId, mapName: map.name, from: pos, moves, to, why });
  console.log(map.name, `${moves.length}걸음`, why);
  if (!stair) break;
  mapId = to.mapId; pos = { x: to.x, y: to.y };
}
fs.writeFileSync(path.join(outDir, "proof.json"), JSON.stringify({ start: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y }, segments }, null, 1));
fs.copyFileSync(path.join(runDir, "live.json"), path.join(outDir, "project.json"));
