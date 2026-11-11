// 컷신 속 걷기와 자리 — 길 따라 걸어 들어오기(planRoadWalk), 누구에게 다가가기(approachSpot · approachSteps · towardSpot), 장면 뒤 도착 칸, 주인공 둘레 자리(nearHero).
import type { Dir, GameMap, Project } from "@/project/types";
import { canMove } from "@/project/collision";
import { planApproach } from "@/project/staging/approach";
import { dist, edgeExitCells, keepsMapConnected, objectAt, shortestPathCells, transferCells, walkReach, walkStart, eventBlockers } from "../place/cells";
import { roadCells } from "../place/surface";
import { Cell, PLAYER, DIR_STEP, StageSim } from "./eventStage";

export const ROAD = /^(길|도로|큰길|길가|길 ?위|마을 ?길|골목|거리|road|street|path|way)$/i;

/** 「주인공 옆·앞·곁」 같은 자리 낱말 — 장면이 시작될 때 주인공이 선 칸 둘레. */
export const HERO_NEAR = /^(주인공|플레이어|용사|player|hero)\s*(의\s*)?(옆|앞|곁|근처|가까이|주변|맞은편|정면|beside|next|near|front)/iu;

export const MIN_WALK = 3;

/** 길(포석) 칸 — 칩셋에 길 이름표가 없으면 시작에서 맵 밖으로 나가는 최단 길. */
export function roadsFor(project: Project, map: GameMap): Set<number> {
  const roads = roadCells(project, map);
  if (roads.size >= 6) return roads;
  const start = walkStart(project, map);
  const blockers = eventBlockers(map);
  const reach = walkReach(project, map, start, blockers);
  const exit = edgeExitCells(map, reach).filter((c) => dist(c, start) > 1).sort((a, b) => dist(a, start) - dist(b, start))[0];
  return exit ? shortestPathCells(project, map, start, exit, blockers) : roads;
}

/**
 * «길로 걸어 나온다»: 가장 가까운 길 칸으로 들어서(이미 길이면 그 칸), 길만 밟아 4~9칸 — 마을 안쪽(맵 가운데) 쪽으로.
 * 굽은 곳마다 경유 칸을 돌려준다(런타임 길찾기가 풀밭으로 질러가지 않게).
 */
export function planRoadWalk(sim: StageSim, key: string): Cell[] | undefined {
  const { map } = sim;
  const w = map.width;
  const from = sim.actors.get(key)!.cell;
  const reach = sim.distances(from, key);
  const roads = sim.roads;
  let entry: Cell | undefined;
  let best = Infinity;
  for (const i of roads) {
    const d = reach.get(i);
    if (d === undefined || d >= best) continue;
    best = d;
    entry = { x: i % w, y: Math.floor(i / w) };
  }
  if (!entry || best > 12) return undefined;
  // 길만 밟는 BFS.
  const world = sim.world(key);
  const rdist = new Map<number, number>([[entry.y * w + entry.x, 0]]);
  const prev = new Map<number, number>();
  const q: Cell[] = [entry];
  for (let k = 0; k < q.length; k++) {
    const c = q[k]!;
    const d = rdist.get(c.y * w + c.x)!;
    if (d >= 12) continue;
    for (const s of Object.values(DIR_STEP)) {
      const n = { x: c.x + s.x, y: c.y + s.y };
      const i = n.y * w + n.x;
      if (!roads.has(i) || rdist.has(i) || !world.canStand(n) || !world.canStep(c, n)) continue;
      rdist.set(i, d + 1);
      prev.set(i, c.y * w + c.x);
      q.push(n);
    }
  }
  const centre = { x: (w - 1) / 2, y: (map.height - 1) / 2 };
  const edgeGap = (c: Cell) => Math.min(c.x, c.y, w - 1 - c.x, map.height - 1 - c.y);
  const freeSide = (c: Cell) => [{ x: c.x - 1, y: c.y }, { x: c.x + 1, y: c.y }].some((n) => world.canStand(n) && world.canStep(c, n));
  let target: Cell | undefined;
  let score = Infinity;
  for (const [i, rd] of rdist) {
    if (rd < 4 || rd > 10) continue;
    const t = { x: i % w, y: Math.floor(i / w) };
    if (best + rd < 4) continue;
    const gain = dist(entry, centre) - dist(t, centre);
    let open = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (reach.has((t.y + dy) * w + t.x + dx) && t.x + dx >= 0 && t.x + dx < w) open++;
    const s = Math.abs(rd - 6) * 0.6 - gain * 0.5 + (edgeGap(t) < 3 ? 6 : 0) + (objectAt(map, t) ? 4 : 0) + (freeSide(t) ? 0 : 3) - open * 0.5;
    if (s < score) { score = s; target = t; }
  }
  if (!target) return undefined;
  // 길 위 경로 → 굽는 칸마다 경유.
  const cells: Cell[] = [];
  for (let i: number | undefined = target.y * w + target.x; i !== undefined; i = prev.get(i)) cells.unshift({ x: i % w, y: Math.floor(i / w) });
  const waypoints: Cell[] = [];
  if (best > 0) waypoints.push(entry);
  for (let k = 1; k < cells.length - 1; k++) {
    const a = cells[k - 1]!, b = cells[k]!, c = cells[k + 1]!;
    if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) waypoints.push(b);
  }
  waypoints.push(target);
  return waypoints;
}

/** 다가오는 사람이 나타날 자리: 지금 주인공에게서 걸어서 4~8칸, 길 위·주인공 앞쪽 먼저, 지붕·가구 밑 아님, 길을 막지 않음. */
export function approachSpot(sim: StageSim, hero: Cell, heroDir: Dir, avoid: readonly Cell[]): Cell | undefined {
  const { map, project } = sim;
  const w = map.width;
  const reach = sim.distances(hero, PLAYER);
  const transfers = new Set(transferCells(map).map((c) => c.y * w + c.x));
  const avoidSet = new Set(avoid.map((c) => c.y * w + c.x));
  const ahead = DIR_STEP[heroDir];
  const ranked: { c: Cell; s: number }[] = [];
  for (const [i, d] of reach) {
    if (d < 4 || d > 8) continue;
    const c = { x: i % w, y: Math.floor(i / w) };
    if (transfers.has(i) || avoidSet.has(i) || objectAt(map, c)) continue;
    const dx = c.x - hero.x, dy = c.y - hero.y;
    const front = dx * ahead.x + dy * ahead.y > 0;
    const edge = c.x === 0 || c.y === 0 || c.x === w - 1 || c.y === map.height - 1;
    const sameRowish = Math.abs(dy) <= 2 ? 0 : 0.5; // 옆으로 걸어와 나란히 서는 그림이 3/4 시점에서 잘 읽힌다
    ranked.push({ c, s: Math.abs(d - 5.5) + (sim.roads.has(i) ? 0 : 1.5) + (front ? 0 : 1.5) + (edge ? 3 : 0) + sameRowish });
  }
  ranked.sort((a, b) => a.s - b.s);
  const start = walkStart(project, map);
  const blockers = eventBlockers(map);
  // 다가오는 길을 미리 걸어 본다 — 실제 걸음(주인공 곁 칸까지, 런타임과 같은 계획)이 4~9 이어야 한다.
  let best: { c: Cell; s: number } | undefined;
  for (const { c, s } of ranked.slice(0, 80)) {
    const steps = approachSteps(sim, c, hero);
    if (steps === undefined || steps < MIN_WALK + 1 || steps > 9) continue;
    const total = s + Math.abs(steps - 5.5) * 0.8;
    if (best && total >= best.s) continue;
    if (!keepsMapConnected(project, map, start, c, blockers)) continue;
    best = { c, s: total };
  }
  return best?.c;
}

/** c 에 선 사람이 주인공 곁(1칸)까지 걷는 걸음 수(런타임 계획). 못 닿으면 undefined. */
export function approachSteps(sim: StageSim, c: Cell, hero: Cell): number | undefined {
  const key = "__probe";
  sim.actors.set(key, { cell: c, dir: "down", visible: true, name: key });
  const plan = planApproach(sim.world(key), c, hero, 1);
  sim.actors.delete(key);
  return plan && !plan.fallback ? plan.steps.length : undefined;
}

/** 걷기 목적지를 못 쓸 때(막힘·3칸 미만): 목적지 쪽으로 걸어서 4~7칸인 칸. */
export function towardSpot(sim: StageSim, key: string, aim: Cell): Cell | undefined {
  const from = sim.actors.get(key)!.cell;
  const reach = sim.distances(from, key);
  const w = sim.map.width;
  const vx = aim.x - from.x, vy = aim.y - from.y;
  const len = Math.hypot(vx, vy) || 1;
  let best: Cell | undefined;
  let score = Infinity;
  for (const [i, d] of reach) {
    if (d < 4 || d > 7) continue;
    const c = { x: i % w, y: Math.floor(i / w) };
    const along = ((c.x - from.x) * vx + (c.y - from.y) * vy) / len;
    const s = dist(c, aim) * 0.5 - along * 0.5 + Math.abs(d - 5) * 0.3 + (objectAt(sim.map, c) ? 3 : 0) + (sim.roads.has(i) ? 0 : 0.5);
    if (s < score) { score = s; best = c; }
  }
  return best;
}

// ───────────────────────── 빌더 ─────────────────────────

/** 그 맵으로 들어오는 이동(다른 맵의 transfer)이 내려 주는 칸 — 가장 많이 쓰이는 칸. 시작 맵이면 시작 칸도 센다. */
export function arrivalCell(project: Project, map: GameMap): Cell | undefined {
  const count = new Map<string, number>();
  const visit = (list: unknown): void => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      const c = raw as Record<string, unknown> | null;
      if (!c || typeof c !== "object") continue;
      if (c.kind === "transfer" && c.mapId === map.id && typeof c.x === "number" && typeof c.y === "number") count.set(`${c.x},${c.y}`, (count.get(`${c.x},${c.y}`) ?? 0) + 1);
      for (const v of Object.values(c)) if (Array.isArray(v)) { visit(v); for (const o of v) if (o && typeof o === "object") { visit((o as Record<string, unknown>).branch); visit((o as Record<string, unknown>).commands); } }
    }
  };
  for (const m of Object.values(project.maps)) { if (m.id === map.id) continue; for (const e of m.events ?? []) for (const pg of e.pages ?? []) visit(pg.commands); }
  if (map.id === project.startMapId && project.startPos) count.set(`${project.startPos.x},${project.startPos.y}`, (count.get(`${project.startPos.x},${project.startPos.y}`) ?? 0) + 1);
  const best = [...count].sort((a, b) => b[1] - a[1])[0];
  if (!best) return undefined;
  const [x, y] = best[0].split(",").map(Number) as [number, number];
  return isPassableCell(project, map, x, y) ? { x, y } : undefined;
}

function isPassableCell(project: Project, map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  return ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => canMove(project, map, x, y, x + dx, y + dy));
}

/** 주인공 둘레 2~3칸(바라보는 쪽 먼저)에서 걸어 닿는 빈 칸. */
export function nearHero(sim: StageSim, hero: { cell: Cell; dir: string }, used: readonly Cell[]): Cell | undefined {
  const front: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const f = front[hero.dir] ?? [0, -1];
  const dirs: [number, number][] = [f, [0, -1], [0, 1], [-1, 0], [1, 0]];
  for (const d of [2, 3]) for (const [dx, dy] of dirs) {
    const c = { x: hero.cell.x + dx * d, y: hero.cell.y + dy * d };
    if (used.some((u) => u.x === c.x && u.y === c.y)) continue;
    if (!isPassableCell(sim.project, sim.map, c.x, c.y)) continue;
    const steps = approachSteps(sim, c, hero.cell);
    if (steps !== undefined && steps <= d + 2) return c;
  }
  return undefined;
}

export function dirTo(from: Cell, to: Cell): Dir {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return dx > 0 ? "right" : "left";
  return dy < 0 ? "up" : "down";
}
