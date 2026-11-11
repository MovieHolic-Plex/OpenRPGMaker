// 길 입구 — 장소의 길이 맵 가장자리에 닿는 자리. 바깥 맵끼리의 출구는 여기에 둔다(가장자리 한가운데가 아니라 길이 실제로 나가는 곳).
import { canMove, isPassable } from "@/project/collision";
import { exitRoadCells } from "@/project/composerExitRoads";
import type { GameMap, Project } from "@/project/types";
import type { BuildRun, Side } from "../shared/types";
import { objectAt } from "./cells";
import { ROAD_EXIT_MAX_WIDTH, widenRoadExits } from "./edgeExitRoads";
import { isRoadGround, roadMaterial } from "./surface";

type Cell = { readonly x: number; readonly y: number };

export interface RoadMouth {
  readonly side: Side;
  /** 가장자리 줄을 따라 이어진 길 칸(길 폭 전체). */
  readonly cells: readonly Cell[];
}

/** 이보다 작은 길 덩이는 혼자서는 길 그물이 아니다(가장자리에 걸친 포석 몇 칸). */
const MIN_ROAD_CELLS = 8;
/** 작은 길 토막(3칸 이상)이 이 걸음 안에서 길 그물에 닿으면 그 그물의 일부다 — 다리 앞뒤로 맨땅 한두 칸이 낀 길. */
const JOIN_STEPS = 6;

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const SIDES: readonly { side: Side; inward: readonly [number, number] }[] = [
  { side: "north", inward: [0, 1] }, { side: "south", inward: [0, -1] }, { side: "west", inward: [1, 0] }, { side: "east", inward: [-1, 0] },
];

/**
 * 이 맵의 길 입구들. 가장자리 칸이 길이고 그 안쪽 칸도 길이면(길이 맵 밖으로 나가는 끝) 입구 칸이다 — 가장자리 줄을 따라 붙은 칸을 한 입구로 묶는다.
 * 가장자리에 걸친 작은 포석 조각은 뺀다. 모서리 칸은 어느 변인지 모호해 뺀다.
 */
export function edgeRoadMouths(project: Project, map: GameMap): RoadMouth[] {
  const W = map.width, H = map.height, network = roadNetwork(project, map);
  const mouths: RoadMouth[] = [];
  for (const { side, inward } of SIDES) {
    const horizontal = inward[0] === 0;
    const line = horizontal ? (inward[1] > 0 ? 0 : H - 1) : (inward[0] > 0 ? 0 : W - 1);
    const at = (k: number): Cell => (horizontal ? { x: k, y: line } : { x: line, y: k });
    const length = horizontal ? W : H;
    const end = (k: number): boolean => {
      const c = at(k);
      return isRoadGround(project, map, c.x, c.y) && isRoadGround(project, map, c.x + inward[0], c.y + inward[1]) && canMove(project, map, c.x + inward[0], c.y + inward[1], c.x, c.y);
    };
    for (let k = 1; k < length - 1; k++) {
      if (!end(k)) continue;
      const run: Cell[] = [];
      while (k < length - 1 && end(k)) run.push(at(k++));
      if (!network.has(run[0]!.y * W + run[0]!.x)) continue;
      const cut = Math.max(0, Math.floor((run.length - ROAD_EXIT_MAX_WIDTH) / 2));
      mouths.push({ side, cells: run.length > ROAD_EXIT_MAX_WIDTH ? run.slice(cut, cut + ROAD_EXIT_MAX_WIDTH) : run });
    }
  }
  return mouths;
}

/** 입구의 가운데 칸 — 출구 이벤트를 세우는 자리(나머지 폭은 길 폭 사본이 덮는다). */
export const mouthCenter = (mouth: RoadMouth): Cell => mouth.cells[Math.floor((mouth.cells.length - 1) / 2)]!;

const OPPOSITE: Readonly<Record<Side, Side>> = { north: "south", south: "north", east: "west", west: "east" };
const SIDE_KO: Readonly<Record<Side, string>> = { north: "북쪽", south: "남쪽", east: "동쪽", west: "서쪽" };

/** 장소의 길 그물 — 걸어서 이어진 길 덩이 가운데 8칸 이상인 것들과(성벽 안 마당과 성문 밖 길처럼 떨어진 덩이도 모두), 거기에 몇 걸음으로 닿는 작은 토막의 칸. */
export function roadNetwork(project: Project, map: GameMap): Set<number> {
  const W = map.width, seen = new Set<number>(), blobs: number[][] = [];
  const steps = (x: number, y: number): [number, number][] => DIRS4.map(([dx, dy]) => [x + dx, y + dy] as [number, number]).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < W && ny < map.height && canMove(project, map, x, y, nx, ny));
  for (let i = 0; i < W * map.height; i++) {
    if (seen.has(i) || !isRoadGround(project, map, i % W, Math.floor(i / W))) continue;
    const blob = [i]; seen.add(i);
    for (let q = 0; q < blob.length; q++) for (const [nx, ny] of steps(blob[q]! % W, Math.floor(blob[q]! / W))) {
      const k = ny * W + nx;
      if (seen.has(k) || !isRoadGround(project, map, nx, ny)) continue;
      seen.add(k); blob.push(k);
    }
    blobs.push(blob);
  }
  const network = new Set(blobs.filter((b) => b.length >= MIN_ROAD_CELLS).flat());
  for (const blob of blobs) {
    if (blob.length >= MIN_ROAD_CELLS || blob.length < 3) continue;
    // 토막에서 길 아닌 걷는 칸으로 JOIN_STEPS 걸음 안에 그물에 닿는가.
    const reached = new Set(blob); let frontier = blob, joins = false;
    for (let step = 0; step < JOIN_STEPS && !joins; step++) {
      const next: number[] = [];
      for (const k of frontier) for (const [nx, ny] of steps(k % W, Math.floor(k / W))) {
        const n = ny * W + nx;
        if (network.has(n)) joins = true;
        if (!reached.has(n)) { reached.add(n); next.push(n); }
      }
      frontier = next;
    }
    if (joins) for (const k of blob) network.add(k);
  }
  return network;
}

/** 칸 집합을 사각형들로 묶는다(가로로 이어진 줄을 같은 폭끼리 세로로 합친다) — fill_region 한 번에 사각형 하나. */
function toRects(cells: readonly Cell[]): { x: number; y: number; w: number; h: number }[] {
  const rows = new Map<number, number[]>();
  for (const c of cells) rows.set(c.y, [...(rows.get(c.y) ?? []), c.x]);
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  for (const y of [...rows.keys()].sort((a, b) => a - b)) {
    const xs = rows.get(y)!.sort((a, b) => a - b);
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i]!; let w = 1;
      while (xs[i + 1] === x + w) { w += 1; i += 1; }
      const above = rects.find((r) => r.x === x && r.w === w && r.y + r.h === y);
      if (above) above.h += 1; else rects.push({ x, y, w, h: 1 });
    }
  }
  return rects;
}

/**
 * 길이 그 변에 닿지 않는 맵에 길 그물에서 그 변의 가장자리까지 두 칸 폭 길을 낸다(칩셋이 선언한 길 재료로 — 새 그림 없음).
 * 걸을 수 있고 물건·이벤트가 없는 칸만 지난다. 낼 수 없거나 칩셋에 까는 재료가 없으면(구성기만 길을 내는 칩셋) 아무것도 바꾸지 않고 undefined.
 */
export function layExitRoad(run: BuildRun, mapId: string, side: Side): RoadMouth | undefined {
  const before = run.ctx.project, map = before.maps[mapId];
  const material = map ? roadMaterial(before, map) : undefined;
  if (!map || !material) return undefined;
  const network = roadNetwork(before, map), W = map.width;
  if (!network.size) return undefined;
  const taken = new Set(map.events.map((e) => e.y * W + e.x));
  const cells = exitRoadCells({
    W, H: map.height,
    isRoad: (x, y) => network.has(y * W + x),
    canPave: (x, y) => isPassable(before, map, x, y) && !objectAt(map, { x, y }) && !taken.has(y * W + x),
  }, side);
  if (!cells?.length) return undefined;
  for (const rect of toRects(cells)) run.call("fill_region", { mapId, material, rect, _exactCells: true });
  const mouth = edgeRoadMouths(run.ctx.project, run.ctx.project.maps[mapId]!).filter((m) => m.side === side).sort((a, b) => b.cells.length - a.cells.length)[0];
  if (!mouth) run.ctx.project = before;
  return mouth;
}

/**
 * 가장자리에 길이 닿지 않는 맵(떠 있는 섬·바다에 둘러싸인 섬)의 출구 자리 — 길 그물에서 그 변 쪽으로 가장 멀리 나간 길 끝.
 * 출구를 세워도 그 뒤로 걸어 갈 곳이 끊기지 않는 막다른 끝만 고른다(지나가는 길 한가운데·집 문 앞 doors 는 안 된다).
 */
export function roadEndToward(project: Project, map: GameMap, side: Side, doors: readonly Cell[] = []): RoadMouth | undefined {
  const W = map.width, network = roadNetwork(project, map);
  if (!network.size) return undefined;
  const horizontal = side === "north" || side === "south", sign = side === "east" || side === "south" ? 1 : -1;
  const depth = (k: number): number => sign * (horizontal ? Math.floor(k / W) : k % W);
  const across = (k: number): number => (horizontal ? k % W : Math.floor(k / W));
  // 이벤트·집 문 앞(나중에 실내로 이어질 자리) 두 칸 안의 길 끝은 그 집으로 들어가는 길이다.
  const events = [...map.events.map((e) => ({ x: e.x, y: e.y })), ...doors];
  const mid = (horizontal ? W : map.height) / 2;
  // 깊이(그 변 쪽으로 나간 정도)가 큰 줄부터, 그 줄에서 이어진 길 칸 묶음마다 본다.
  for (const level of [...new Set([...network].map(depth))].sort((a, b) => b - a).slice(0, 6)) {
    const line = [...network].filter((k) => depth(k) === level).sort((a, b) => across(a) - across(b));
    const runs: number[][] = [];
    for (const k of line) { const last = runs[runs.length - 1]; if (last && across(last[last.length - 1]!) + 1 === across(k)) last.push(k); else runs.push([k]); }
    for (const cellsK of runs.sort((a, b) => Math.abs(across(a[0]!) - mid) - Math.abs(across(b[0]!) - mid))) {
      if (cellsK.length > ROAD_EXIT_MAX_WIDTH) continue;
      // 길 끝 — 그 변 쪽 다음 칸은 길이 아니고, 안쪽 칸이 길인 칸들(꺾인 끝의 곁가지 칸은 뺀다).
      const [ox, oy] = horizontal ? [0, sign] : [sign, 0];
      const run = cellsK.map((k) => ({ x: k % W, y: Math.floor(k / W) }));
      if (run.some((c) => network.has((c.y + oy) * W + c.x + ox))) continue;
      const cells = run.filter((c) => network.has((c.y - oy) * W + c.x - ox));
      if (!cells.length) continue;
      if (events.some((e) => cells.some((c) => Math.abs(c.x - e.x) + Math.abs(c.y - e.y) <= 2))) continue;
      if (cutsWalk(project, map, cells, { x: cells[0]!.x - ox, y: cells[0]!.y - oy })) continue;
      return { side, cells };
    }
  }
  return undefined;
}

/** 그 칸들을 막으면(출구는 밟으면 떠난다) from 에서 걸어 닿던 칸이 여섯 넘게 줄어드는가. */
function cutsWalk(project: Project, map: GameMap, block: readonly Cell[], from: Cell): boolean {
  const W = map.width;
  const reach = (stops: ReadonlySet<number>): number => {
    const seen = new Set<number>([from.y * W + from.x]), queue = [from];
    for (let i = 0; i < queue.length; i++) {
      const { x, y } = queue[i]!;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx, ny = y + dy, k = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= map.height || seen.has(k) || stops.has(k) || !canMove(project, map, x, y, nx, ny)) continue;
        seen.add(k); queue.push({ x: nx, y: ny });
      }
    }
    return seen.size;
  };
  const stops = new Set(block.map((c) => c.y * W + c.x));
  return reach(new Set()) - stops.size - reach(stops) > 6;
}

/** 아직 출구가 서지 않은 입구들. */
function freeMouths(map: GameMap, mouths: readonly RoadMouth[]): RoadMouth[] {
  const taken = new Set(map.events.map((e) => `${e.x},${e.y}`));
  return mouths.filter((m) => !m.cells.some((c) => taken.has(`${c.x},${c.y}`)));
}
/** 시작 칸에서 이 걸음 안의 입구는 주인공이 서는 자리로 본다. */
const START_CLEARANCE = 4;
const distance = (mouth: RoadMouth, at: Cell): number => { const c = mouthCenter(mouth); return Math.abs(c.x - at.x) + Math.abs(c.y - at.y); };

/**
 * 한 맵의 출구 자리를 고른다. 차례: ① 바라는 변의 길 입구(가장 넓은 것) ② 그 변까지 길을 내서 생긴 입구(칩셋이 길 재료를 선언했을 때)
 * ③ 다른 변의 입구(near 가 있으면 그 칸에 가까운 것, 없으면 away 에서 먼 것) ④ 가장자리에 길이 없는 맵은 그 변 쪽 길 끝(없으면 다른 쪽 길 끝).
 */
function pickMouth(run: BuildRun, mapId: string, side: Side, hint: { near?: Cell; away?: Cell; doors?: readonly Cell[] }): RoadMouth | undefined {
  const free = (): RoadMouth[] => {
    const project = run.ctx.project, map = project.maps[mapId]!;
    // 주인공이 서서 시작하는 입구는 출구로 쓰지 않는다(시작하자마자 이동 칸 곁이다).
    const start = project.startMapId === mapId ? project.startPos : undefined;
    return freeMouths(map, edgeRoadMouths(project, map)).filter((m) => !start || distance(m, start) > START_CLEARANCE);
  };
  const widest = (mouths: readonly RoadMouth[]) => [...mouths].sort((a, b) => b.cells.length - a.cells.length).find((m) => m.side === side);
  const mouths = free();
  const onSide = widest(mouths) ?? (layExitRoad(run, mapId, side) ? widest(free()) : undefined);
  if (onSide) return onSide;
  if (mouths.length) {
    if (hint.near) return [...mouths].sort((a, b) => distance(a, hint.near!) - distance(b, hint.near!))[0];
    return hint.away ? [...mouths].sort((a, b) => distance(b, hint.away!) - distance(a, hint.away!))[0] : mouths[0];
  }
  // 그 변 쪽 길 끝이 집 문 앞이면 다른 쪽 길 끝(부두 끝)이라도 길 위에 세운다.
  const project = run.ctx.project, map = project.maps[mapId]!;
  for (const toward of [side, ...SIDES.map((s) => s.side).filter((s) => s !== side)]) {
    const end = roadEndToward(project, map, toward, hint.doors);
    if (end && freeMouths(map, [end]).length) return end;
  }
  return undefined;
}

/**
 * 바깥 맵 둘을 길 끝끼리 잇는다(link_maps 한 번). 부모는 바라는 변의 출구 자리(pickMouth), 자식은 마주 보는 변의 자리 — 그 변에 낼 수 없으면
 * 빌더가 정한 들어오는 칸에 가까운 입구. 한쪽에 자리가 없으면 그쪽만 그 변의 가운데로 둔다. 둘 다 없으면 undefined — 부르는 쪽이 예전 길로 잇는다.
 */
export function linkAtRoadMouths(
  run: BuildRun, parentId: string, childId: string, side: Side,
  enter: { parent?: Cell; child?: Cell; /** 집 문 앞 칸(실내로 이어질 자리) — 그 곁의 길 끝은 출구로 쓰지 않는다. */ parentDoors?: readonly Cell[]; childDoors?: readonly Cell[] },
): { ok: boolean; note: string } | undefined {
  if (!run.ctx.project.maps[parentId] || !run.ctx.project.maps[childId]) return undefined;
  const from = pickMouth(run, parentId, side, { away: enter.parent, doors: enter.parentDoors });
  const facing = OPPOSITE[from?.side ?? side];
  const to = pickMouth(run, childId, facing, { near: enter.child, doors: enter.childDoors });
  if (!from && !to) return undefined;
  const project = run.ctx.project, parent = project.maps[parentId]!, child = project.maps[childId]!;
  const a = from ? mouthCenter(from) : undefined, b = to ? mouthCenter(to) : undefined;
  const res = run.call("link_maps", {
    from: { mapId: parentId, ...(a ? { x: a.x, y: a.y, exact: true } : { exit: { side } }) },
    to: { mapId: childId, ...(b ? { x: b.x, y: b.y, exact: true } : { entry: { side: facing } }) },
  });
  // 출구는 길 폭 전체다 — 어느 줄로 걸어 나가도 넘어간다(끝맺음의 길 폭 사본과 같은 함수).
  if (res.ok) for (const mapId of [parentId, childId]) widenRoadExits(run, mapId);
  const where = (mouth: RoadMouth | undefined, fallback: Side) => (mouth ? `${SIDE_KO[mouth.side]} 길 끝(${mouthCenter(mouth).x},${mouthCenter(mouth).y}, 폭 ${mouth.cells.length})` : `${SIDE_KO[fallback]} 가장자리(길 없음)`);
  return { ok: res.ok, note: res.ok ? `${parent.name} ${where(from, side)} ↔ ${child.name} ${where(to, facing)}` : String(res.summary).slice(0, 160) };
}
