// 방에서 방으로 가는 길은 그려진 계단이다 — 문 그림 없는 맨바닥 이동 칸 대신 칩셋이 적어 둔 계단 키트를 벽 앞에 찍고 그 칸을 이동 칸으로 쓴다.
// 왜(2026-11-12 r1s-fun 「증기의 심장」): 「지하 보일러실」 → 「대심장 기관실」 이 동쪽 벽 곁 맨바닥 한 칸이었다(구성기 방에는 벽 문 조각이 없다).
// 읽는 것: 칩셋 표면 계약의 계단 타일(tilesetSurface.stairs)로만 된 구조 키트. 그런 키트가 없는 칩셋은 undefined — 부르는 쪽이 예전 자리를 쓰고 끝맺음이 «없는 그림» 으로 적는다.
import { isPassable } from "@/project/collision";
import { objectClusterAt } from "@/project/objectFootprint";
import { tilesetSurface } from "@/project/tilesetSurface";
import type { GameMap, Project } from "@/project/types";
import { reachableCells } from "../judge/eventReach";
import type { BuildRun } from "../shared/types";
import { behindBuildingStrip, buildingEntrances, declaredStairCells } from "./entrances";
import { walkReach } from "./cells";
import { laneCells } from "./placementRules";

type Kit = { id: string; name?: string; width?: number; height?: number; rows?: { tiles?: number[]; upperTiles?: number[] }[] };

/** 오르는 계단인가 내려가는 계단인가 — 키트가 id 끝에 적어 둔 것(…-up · …-down). 안 적었으면 undefined. */
const kitWay = (kit: Kit): "up" | "down" | undefined => (/(^|[-_: ])up$/iu.test(kit.id) ? "up" : /(^|[-_: ])down$/iu.test(kit.id) ? "down" : undefined);

/** 땅에 얹는 내려가는 길(해치·바닥 계단)인가 — 내려가는 계단 키트(…-down) 가운데 아래층 타일이 없는 것: 땅을 바꾸지 않고 덧그리고, 벽에 등을 대지 않아도 된다. */
const laidOnGround = (kit: Kit): boolean => kitWay(kit) === "down" && (kit.rows ?? []).every((r) => (r.tiles ?? []).every((t) => t < 0));

function stairKits(project: Project, map: GameMap): Kit[] {
  const tileset = project.tilesets[map.tilesetId];
  const stairs = tilesetSurface(tileset).stairs;
  const kits = ((tileset as { structureKits?: readonly Kit[] } | undefined)?.structureKits ?? []) as readonly Kit[];
  return kits.filter((kit) => {
    const tiles = (kit.rows ?? []).flatMap((r) => [...(r.tiles ?? []), ...(r.upperTiles ?? [])]).filter((t) => t >= 0);
    return tiles.length > 0 && tiles.every((t) => stairs.has(t)) && (kit.width ?? 1) * (kit.height ?? 1) <= 9;
  });
}

/**
 * 방 맵에 계단 한 벌을 찍고 이동 칸(계단 발치 줄의 왼쪽 칸)을 돌려준다. way 쪽 키트 먼저.
 * 자리: 뒷벽(북쪽 벽)에 등을 댄 빈 바닥, 다른 이벤트·출구에서 떨어진 곳. 걸어 닿던 칸이 줄면 되돌린다.
 */
export function stampRoomStairs(run: BuildRun, mapId: string, way: "up" | "down" | undefined): { x: number; y: number; note: string } | undefined {
  const project0 = run.ctx.project;
  const map0 = project0.maps[mapId];
  const reach0 = map0 ? reachableCells(project0, map0) : undefined;
  if (!map0 || !reach0) return undefined;
  // 땅에 얹는 해치는 바깥 것이다 — 방에서는 벽에 등을 대는 계단만 쓴다(키트 차례가 바뀌어도 방의 고르기가 그대로).
  const kits = stairKits(project0, map0).filter((kit) => !laidOnGround(kit)).sort((a, b) => Number(kitWay(b) === way) - Number(kitWay(a) === way));
  const count = (r: Uint8Array) => r.reduce((n, v) => n + (v ? 1 : 0), 0);
  const events = map0.events ?? [];
  for (const kit of kits.slice(0, 2)) {
    const w = kit.width ?? 1, h = kit.height ?? 1;
    const spots: { x: number; y: number; far: number; hung: number }[] = [];
    for (let y = 1; y + h <= map0.height - 1; y += 1) for (let x = 1; x + w <= map0.width - 1; x += 1) {
      let ok = true;
      for (let yy = y; yy < y + h && ok; yy += 1) for (let xx = x; xx < x + w && ok; xx += 1) {
        ok = !!reach0[yy * map0.width + xx] && isPassable(project0, map0, xx, yy) && !objectClusterAt(project0, map0, xx, yy) && !events.some((e) => Math.abs(e.x - xx) + Math.abs(e.y - yy) <= 1);
      }
      // 뒷벽에 등을 댄다 — 바로 위 줄이 모두 못 걷는 칸. 계단 발치(아래 줄)는 걸어 닿는 빈 바닥.
      for (let xx = x; xx < x + w && ok; xx += 1) ok = !isPassable(project0, map0, xx, y - 1) && !!reach0[(y + h) * map0.width + xx] && !objectClusterAt(project0, map0, xx, y + h);
      if (!ok) continue;
      const far = Math.min(...events.map((e) => Math.abs(e.x - x) + Math.abs(e.y - y)), 99);
      // 벽에 걸린 그림(밸브 바퀴·압력계) 아래는 나중 — 계단이 그 아래를 차지하면 그 그림 앞에 설 자리가 없어진다.
      let hung = 0;
      for (let xx = x; xx < x + w; xx += 1) hung += objectClusterAt(project0, map0, xx, y - 1) ? 1 : 0;
      spots.push({ x, y, far, hung });
    }
    // 빈 벽 앞 먼저, 그다음 다른 이벤트·출구에서 먼 자리 — 문 곁에 계단이 붙지 않게.
    spots.sort((a, b) => a.hung - b.hung || b.far - a.far || a.y - b.y || a.x - b.x);
    for (const spot of spots.slice(0, 8)) {
      const snapshot = run.ctx.project;
      const res = run.call("stamp_object", { objectId: `kit:${map0.tilesetId}/${kit.id}`, mapId, x: spot.x, y: spot.y });
      const map = run.ctx.project.maps[mapId]!;
      const reach = res.ok ? reachableCells(run.ctx.project, map) : undefined;
      if (!reach || count(reach) < count(reach0)) { run.ctx.project = snapshot; continue; }
      // 이동 칸은 계단 그림의 발치 줄 — 이동 도구(create_transfer_pair)가 계단 폭만큼 스스로 넓힌다.
      return { x: spot.x, y: spot.y + h - 1, note: `계단 「${kit.name ?? kit.id}」을 (${spot.x},${spot.y})에 놓음` };
    }
  }
  return undefined;
}

/**
 * 바깥 맵에 내려가는 길 한 벌을 얹고 이동 칸(그림의 아랫줄 왼쪽 칸)을 돌려준다 — 땅 밑에 있다고 적힌 방(WorldKind.below)으로 들어가는 길.
 * 자리: 걸어 닿는 빈 땅(차도·선로 · 문 앞 접근 줄 · 지붕 뒤 띠 · 맵 가장자리 · 다른 이벤트 곁은 피한다), near(그 방의 건물 문 앞)에서 가까운 곳, 건물 벽에 등을 댄 곳 먼저.
 * 그런 키트가 없거나 자리가 없으면 undefined — 부르는 쪽이 예전처럼 건물 문으로 잇는다.
 */
export function stampWayDown(run: BuildRun, mapId: string, near?: { x: number; y: number }): { x: number; y: number; note: string } | undefined {
  const project0 = run.ctx.project;
  const map0 = project0.maps[mapId];
  const reach0 = map0 ? reachableCells(project0, map0) : undefined;
  if (!map0 || !reach0) return undefined;
  const kits = stairKits(project0, map0).filter(laidOnGround);
  if (!kits.length) return undefined;
  const lanes = laneCells(project0, map0), strip = behindBuildingStrip(project0, map0);
  const fronts = buildingEntrances(project0, map0).map((e) => e.front);
  const events = map0.events ?? [];
  const count = (r: Uint8Array) => r.reduce((n, v) => n + (v ? 1 : 0), 0);
  const free = (x: number, y: number) => {
    const i = y * map0.width + x;
    return !!reach0[i] && isPassable(project0, map0, x, y) && !objectClusterAt(project0, map0, x, y) && !lanes.has(i) && !strip[i]
      && !events.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1) && !fronts.some((f) => f.x === x && y >= f.y && y <= f.y + 2);
  };
  const anchor = near ?? { x: Math.floor(map0.width / 2), y: Math.floor(map0.height / 2) };
  for (const kit of kits.slice(0, 2)) {
    const w = kit.width ?? 1, h = kit.height ?? 1;
    const spots: { x: number; y: number; d: number; backed: number }[] = [];
    for (let y = 1; y + h <= map0.height - 1; y += 1) for (let x = 1; x + w <= map0.width - 1; x += 1) {
      let ok = true;
      for (let yy = y; yy < y + h && ok; yy += 1) for (let xx = x; xx < x + w && ok; xx += 1) ok = free(xx, yy);
      // 내려서는 칸(아랫줄) 바로 아래는 걸어 닿는 빈 땅 — 그쪽에서 밟고 들어간다.
      for (let xx = x; xx < x + w && ok; xx += 1) ok = !!reach0[(y + h) * map0.width + xx] && isPassable(project0, map0, xx, y + h);
      if (!ok) continue;
      let backed = 1;
      for (let xx = x; xx < x + w; xx += 1) backed &&= isPassable(project0, map0, xx, y - 1) ? 0 : 1;
      spots.push({ x, y, d: Math.abs(x - anchor.x) + Math.abs(y + h - 1 - anchor.y), backed });
    }
    // 가까운 곳(여섯 칸 단위) 먼저, 그 안에서는 건물 벽에 등을 댄 곳 — 길 한가운데 구멍보다 벽 곁 해치가 자연스럽다.
    spots.sort((a, b) => Math.floor(a.d / 6) - Math.floor(b.d / 6) || b.backed - a.backed || a.d - b.d || a.y - b.y || a.x - b.x);
    for (const spot of spots.slice(0, 16)) {
      // 밟으면 내려가는 칸이라 골목 어귀를 채우면 그 너머가 끊긴다 — 그림 칸을 막아도 나머지 땅이 다 이어지는 자리만.
      const cells = new Set<number>();
      for (let yy = spot.y; yy < spot.y + h; yy += 1) for (let xx = spot.x; xx < spot.x + w; xx += 1) cells.add(yy * map0.width + xx);
      const approach = { x: spot.x, y: spot.y + h };
      const open = walkReach(project0, map0, approach, new Set()), shut = walkReach(project0, map0, approach, cells);
      if (open.some((v, i) => v && !shut[i] && !cells.has(i))) continue;
      const snapshot = run.ctx.project;
      const res = run.call("stamp_object", { objectId: `kit:${map0.tilesetId}/${kit.id}`, mapId, x: spot.x, y: spot.y });
      const map = run.ctx.project.maps[mapId]!;
      const reach = res.ok ? reachableCells(run.ctx.project, map) : undefined;
      const foot = { x: spot.x, y: spot.y + h - 1 };
      if (reach && count(reach) >= count(reach0) && declaredStairCells(run.ctx.project, map).some((c) => c.x === foot.x && c.y === foot.y)) {
        return { ...foot, note: `내려가는 길 「${kit.name ?? kit.id}」을 (${spot.x},${spot.y})에 놓음` };
      }
      run.ctx.project = snapshot;
    }
  }
  return undefined;
}
