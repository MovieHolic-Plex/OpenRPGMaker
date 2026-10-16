// 조수가 지은 연애 한 편(qa:game gen 결과 project.json)을 출하 플레이어로 찍기 위한 입력.
//   bun scripts/qa/romance-real/proof.mts <project.json> <outDir>   → <outDir>/project.json(그대로 복사) + <outDir>/proof.json
// 시나리오 scripts/qa/runtime/romance-real.scenario.mjs 가 proof.json 으로 걷는다. 저작 내용은 쓰지 않는다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deserialize, serialize } from "../../../src/project/io.ts";
import { canMove, isPassable } from "../../../src/project/collision.ts";
import type { GameEvent, GameMap, Project } from "../../../src/project/types.ts";

const [file, outDir] = process.argv.slice(2) as [string, string];
mkdirSync(outDir, { recursive: true });
const project = deserialize(readFileSync(file, "utf8")) as Project;
// 상대 옆에 서는 칸은 좌우를 먼저 본다 — 위아래에서 다가가면 24×32 걷기 그림이 16px 칸 둘에 걸쳐 머리 위에 머리가 얹힌 듯 겹쳐 찍힌다(연애 첫 측정 지적 ⑥).
// BFS 이웃 순서와 도착 칸 고르기가 같은 배열을 쓰므로 순서만 바꾼다(결과 경로의 정당성은 같다).
const dirs = [["left", -1, 0], ["right", 1, 0], ["down", 0, 1], ["up", 0, -1]] as const;

const isNpc = (e: GameEvent) => Boolean(e.characterId) || /^(ev_)?npc[_-]/u.test(e.id);
const visible = (e: GameEvent) => e.pages.some((p) => p.graphic?.transparent !== true && (p.graphic?.sprite !== undefined || p.graphic?.appearanceId !== undefined || p.graphic?.characterResourceId !== undefined));

function bfs(map: GameMap, from: { x: number; y: number }, blocked: Set<number>) {
  const key = (x: number, y: number) => y * map.width + x;
  const prev = new Map<number, { from: number; dir: string }>();
  const q = [key(from.x, from.y)]; prev.set(q[0]!, { from: -1, dir: "" });
  for (let h = 0; h < q.length; h++) {
    const c = q[h]!; const cx = c % map.width, cy = Math.floor(c / map.width);
    for (const [d, dx, dy] of dirs) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || prev.has(key(x, y)) || blocked.has(key(x, y))) continue;
      if (!isPassable(project, map, x, y) || !canMove(project, map, cx, cy, x, y)) continue;
      prev.set(key(x, y), { from: c, dir: d }); q.push(key(x, y));
    }
  }
  return { prev, key };
}

const start = project.maps[project.startMapId]!;
const npcsHere = start.events.filter(isNpc);
const blocked = new Set(npcsHere.map((e) => e.y * start.width + e.x));
const { prev, key } = bfs(start, project.startPos, blocked);
const target = npcsHere.find((e) => dirs.some(([, dx, dy]) => prev.has(key(e.x - dx, e.y - dy)))) ?? null;
let walk: unknown = null;
if (target) {
  const [d, dx, dy] = dirs.find(([, dx2, dy2]) => prev.has(key(target.x - dx2, target.y - dy2)))!;
  const ax = target.x - dx, ay = target.y - dy;
  const moves: { kind: "move"; dir: string }[] = [];
  for (let c = key(ax, ay); prev.get(c)!.from >= 0; c = prev.get(c)!.from) moves.unshift({ kind: "move", dir: prev.get(c)!.dir });
  const face = ax < target.x ? "right" : ax > target.x ? "left" : ay < target.y ? "down" : "up";
  walk = { eventId: target.id, name: target.name, arrive: { x: ax, y: ay }, face, moves, dirUsed: d };
}
// 다른 맵: 이벤트가 있는 칸 근처에서 통행 가능한 칸 하나(맵 가운데에 가까운 쪽)로 순간이동해 찍는다.
const spots = Object.values(project.maps).filter((m) => m.id !== start.id).map((m) => {
  let best: { x: number; y: number; d: number } | null = null;
  const cx = m.width / 2, cy = m.height / 2;
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
    if (!isPassable(project, m, x, y)) continue;
    const d = Math.hypot(x - cx, y - cy);
    if (!best || d < best.d) best = { x, y, d };
  }
  return { mapId: m.id, name: m.name, width: m.width, height: m.height, x: best?.x ?? 1, y: best?.y ?? 1,
    // stand: 그 인물 곁에서 말 걸 수 있는 통행 칸(좌우 먼저) — 책상·문턱에 막힌 아래 칸으로 가면 말 걸기가 안 된다.
    npcs: m.events.filter(isNpc).map((e) => {
      const near = dirs.map(([, dx, dy]) => ({ x: e.x - dx, y: e.y - dy, face: dx === 1 ? "right" : dx === -1 ? "left" : dy === 1 ? "down" : "up" }))
        .find((c) => c.x >= 0 && c.y >= 0 && c.x < m.width && c.y < m.height && isPassable(project, m, c.x, c.y) && canMove(project, m, c.x, c.y, e.x, e.y));
      return { id: e.id, name: e.name, x: e.x, y: e.y, visible: visible(e), stand: near ?? null };
    }) };
});
writeFileSync(`${outDir}/project.json`, serialize(project));
writeFileSync(`${outDir}/proof.json`, JSON.stringify({
  startMapId: start.id, startName: start.name, startPos: project.startPos, walk,
  startNpcs: npcsHere.map((e) => ({ id: e.id, name: e.name, x: e.x, y: e.y, visible: visible(e) })), spots,
}, null, 1));
console.log(JSON.stringify({ startNpcs: npcsHere.length, visibleNpcs: npcsHere.filter(visible).length, walk: Boolean(walk), spots: spots.length }));
