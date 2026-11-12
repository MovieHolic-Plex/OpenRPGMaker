// 방에서 방으로 가는 길은 그려진 계단이다 — 문 그림 없는 맨바닥 이동 칸 대신 칩셋이 적어 둔 계단 키트를 벽 앞에 찍고 그 칸을 이동 칸으로 쓴다.
// 왜(2026-11-12 r1s-fun 「증기의 심장」): 「지하 보일러실」 → 「대심장 기관실」 이 동쪽 벽 곁 맨바닥 한 칸이었다(구성기 방에는 벽 문 조각이 없다).
// 읽는 것: 칩셋 표면 계약의 계단 타일(tilesetSurface.stairs)로만 된 구조 키트. 그런 키트가 없는 칩셋은 undefined — 부르는 쪽이 예전 자리를 쓰고 끝맺음이 «없는 그림» 으로 적는다.
import { isPassable } from "@/project/collision";
import { objectClusterAt } from "@/project/objectFootprint";
import { tilesetSurface } from "@/project/tilesetSurface";
import type { GameMap, Project } from "@/project/types";
import { reachableCells } from "../judge/eventReach";
import type { BuildRun } from "../shared/types";

type Kit = { id: string; name?: string; width?: number; height?: number; rows?: { tiles?: number[]; upperTiles?: number[] }[] };

/** 오르는 계단인가 내려가는 계단인가 — 키트가 id 끝에 적어 둔 것(…-up · …-down). 안 적었으면 undefined. */
const kitWay = (kit: Kit): "up" | "down" | undefined => (/(^|[-_: ])up$/iu.test(kit.id) ? "up" : /(^|[-_: ])down$/iu.test(kit.id) ? "down" : undefined);

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
  const kits = stairKits(project0, map0).sort((a, b) => Number(kitWay(b) === way) - Number(kitWay(a) === way));
  const count = (r: Uint8Array) => r.reduce((n, v) => n + (v ? 1 : 0), 0);
  const events = map0.events ?? [];
  for (const kit of kits.slice(0, 2)) {
    const w = kit.width ?? 1, h = kit.height ?? 1;
    const spots: { x: number; y: number; far: number }[] = [];
    for (let y = 1; y + h <= map0.height - 1; y += 1) for (let x = 1; x + w <= map0.width - 1; x += 1) {
      let ok = true;
      for (let yy = y; yy < y + h && ok; yy += 1) for (let xx = x; xx < x + w && ok; xx += 1) {
        ok = !!reach0[yy * map0.width + xx] && isPassable(project0, map0, xx, yy) && !objectClusterAt(project0, map0, xx, yy) && !events.some((e) => Math.abs(e.x - xx) + Math.abs(e.y - yy) <= 1);
      }
      // 뒷벽에 등을 댄다 — 바로 위 줄이 모두 못 걷는 칸. 계단 발치(아래 줄)는 걸어 닿는 빈 바닥.
      for (let xx = x; xx < x + w && ok; xx += 1) ok = !isPassable(project0, map0, xx, y - 1) && !!reach0[(y + h) * map0.width + xx] && !objectClusterAt(project0, map0, xx, y + h);
      if (!ok) continue;
      const far = Math.min(...events.map((e) => Math.abs(e.x - x) + Math.abs(e.y - y)), 99);
      spots.push({ x, y, far });
    }
    // 다른 이벤트·출구에서 먼 자리부터 — 문 곁에 계단이 붙지 않게.
    spots.sort((a, b) => b.far - a.far || a.y - b.y || a.x - b.x);
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
