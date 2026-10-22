// project/objectFootprint.ts
/**
 * 서는 물건(소품·가구·공방 기물)의 발자국 검사. stamp_tileset_object·stamp_object 가 찍기 전에 같은 규칙으로 본다.
 *
 * 왜(2026-10-21 objectgen 적대 VQA FAIL): 조수가 2×4 혼천의를 stamp_object 로 서재 두 방 사이 벽·천장 위에 찍었다.
 * stamp_object 는 놓기 규칙이 있는 킷·던전 받침 킷만 보고 일반 소품의 밑칸은 보지 않았다.
 *
 * 규칙:
 * - 발 칸(그림이 막는 칸, 막는 칸이 없으면 그림 맨 아래 줄) = 걷는 바닥이어야 한다. 허공(타일 없음)·벽·천장·지붕·물·막힌 구조물 위면 거부.
 * - 그림 칸 전부: 다른 물체(위층 타일)와 겹치면 거부. 위로 솟은 칸(발 칸이 아닌 칸)은 벽 앞면에 걸쳐도 된다(벽 앞 가구의 윗부분).
 * - 거부할 때 같은 크기로 놓을 수 있는 가장 가까운 자리(왼쪽 위)를 함께 돌려준다 — 조수가 그 자리로 다시 부른다.
 */
import { isPassable } from "./collision";
import type { GameMap, Project, TilesetDef } from "./types";

export type FootprintCell = { readonly dx: number; readonly dy: number; readonly foot: boolean };
export type FootprintProblemCode = "object-out-of-bounds" | "object-on-void" | "object-on-wall" | "object-on-blocked" | "object-overlaps-object";
export type FootprintProblem = { readonly code: FootprintProblemCode; readonly x: number; readonly y: number; readonly why: string };

const CEILING_TAG = /천장|ceiling|지붕|roof/iu;

function wallLike(tileset: TilesetDef | undefined, tile: number): string | null {
  if (tile < 0 || !tileset) return null;
  const meta = tileset.tileMeta?.[tile];
  if (!meta) return null;
  if (meta.tags?.some((tag) => CEILING_TAG.test(tag))) return "천장·지붕";
  if (meta.role === "wall") return "벽";
  if (meta.role === "roof") return "지붕";
  return null;
}

/** 바닥에 깔린 지나가는 덧그림(접지 그림자·노면 표시)은 물체가 아니다 — 그 위에 물건을 세워도 된다(2026-10-21 시험 2: jp_city 보도의 건물 밑 그림자 때문에 자판기 자리가 하나도 없었다). */
const GROUND_DECAL = /그림자|shadow|노면|횡단보도|중앙선|차선|marking/iu;
function groundDecal(tileset: TilesetDef | undefined, tile: number): boolean {
  const meta = tileset?.tileMeta?.[tile];
  if (!meta || meta.passage !== "passable") return false;
  return [meta.label ?? "", ...(meta.tags ?? [])].some((text) => GROUND_DECAL.test(text));
}

/** 칸 하나에 이미 물체(위층 그림)가 있나 — 3·4층. 바닥 덧그림은 빼고 센다. */
function objectAt(map: GameMap, index: number, tileset: TilesetDef | undefined): number {
  const upper = map.upperTiles[index] ?? -1;
  if (upper >= 0 && !groundDecal(tileset, upper)) return upper;
  const overlay = map.upperOverlayTiles?.[index] ?? -1;
  return overlay >= 0 && !groundDecal(tileset, overlay) ? overlay : -1;
}

/** 패턴(위층 칸 배열, -1 = 빈 칸)에서 발자국 칸을 만든다. 막는(통행 X) 그림 칸이 발, 없으면 그림 맨 아래 줄이 발. */
export function footprintFromUpper(width: number, height: number, upper: readonly number[], source: TilesetDef | undefined): FootprintCell[] {
  const drawn: { dx: number; dy: number; blocks: boolean }[] = [];
  for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) {
    const tile = upper[dy * width + dx] ?? -1;
    if (tile < 0) continue;
    const pass = source?.passability[tile];
    drawn.push({ dx, dy, blocks: !!pass && !Object.values(pass).some(Boolean) });
  }
  if (!drawn.length) return [];
  const anyBlocks = drawn.some((cell) => cell.blocks);
  const bottom = Math.max(...drawn.map((cell) => cell.dy));
  return drawn.map((cell) => ({ dx: cell.dx, dy: cell.dy, foot: anyBlocks ? cell.blocks : cell.dy === bottom }));
}

/** (ox,oy)=왼쪽 위에 놓을 때 첫 문제. 없으면 null. */
export function footprintProblem(project: Project, map: GameMap, cells: readonly FootprintCell[], ox: number, oy: number): FootprintProblem | null {
  const tileset = project.tilesets[map.tilesetId];
  for (const cell of cells) {
    const x = ox + cell.dx, y = oy + cell.dy;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return { code: "object-out-of-bounds", x, y, why: "맵 밖이다" };
    const index = y * map.width + x;
    const other = objectAt(map, index, tileset);
    if (other >= 0) return { code: "object-overlaps-object", x, y, why: `다른 물체(위층 타일 ${other})와 겹친다` };
    if (!cell.foot) continue;
    const lower = map.lowerTiles[index] ?? -1;
    if (lower < 0) return { code: "object-on-void", x, y, why: "바닥이 없는 허공(빈 칸)이다" };
    const wall = wallLike(tileset, lower) ?? wallLike(tileset, map.lowerOverlayTiles?.[index] ?? -1);
    if (wall) return { code: "object-on-wall", x, y, why: `${wall} 칸 위다` };
    if (!isPassable(project, map, x, y)) return { code: "object-on-blocked", x, y, why: "걷지 못하는 칸(물·구조물) 위다" };
  }
  return null;
}

/** (ox,oy) 둘레에서 같은 발자국을 놓을 수 있는 가장 가까운 왼쪽 위 자리. 체비셰프 거리 순, 같은 거리면 위→왼쪽. */
export function nearestFootprintOrigin(project: Project, map: GameMap, cells: readonly FootprintCell[], ox: number, oy: number, maxRadius = 10): { x: number; y: number } | null {
  for (let r = 1; r <= maxRadius; r += 1) {
    const ring: { x: number; y: number; d: number }[] = [];
    for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      ring.push({ x: ox + dx, y: oy + dy, d: dx * dx + dy * dy });
    }
    ring.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    for (const spot of ring) if (!footprintProblem(project, map, cells, spot.x, spot.y)) return { x: spot.x, y: spot.y };
  }
  return null;
}

/** 거부 글 — 문제 칸·이유 + 가까운 자리(at 과 base 둘 다). 조수는 이 좌표로 다시 부른다. */
export function footprintRefusal(project: Project, map: GameMap, cells: readonly FootprintCell[], ox: number, oy: number, label: string): { message: string; code: FootprintProblemCode; suggestion: { at: { x: number; y: number }; base: { x: number; y: number } } | null } | null {
  const problem = footprintProblem(project, map, cells, ox, oy);
  if (!problem) return null;
  const near = nearestFootprintOrigin(project, map, cells, ox, oy);
  const bottom = cells.length ? Math.max(...cells.map((cell) => cell.dy)) : 0;
  const suggestion = near ? { at: near, base: { x: near.x, y: near.y + bottom } } : null;
  const foot = problem.code === "object-overlaps-object" ? "" : " 물체의 발(막히는 맨 아래 칸)은 걷는 바닥 위에 와야 한다.";
  const next = suggestion
    ? ` 가장 가까운 빈 바닥 자리: 왼쪽 위 (${suggestion.at.x},${suggestion.at.y}) = base (${suggestion.base.x},${suggestion.base.y}). 그 자리로 다시 찍거나 show_map_region 으로 바닥을 보고 고른다.`
    : " 둘레 10칸 안에 놓을 자리가 없다 — 방 안 빈 바닥을 show_map_region 으로 찾아 고른다.";
  return { code: problem.code, suggestion, message: `${label} 을(를) (${ox},${oy}) 에 놓으면 (${problem.x},${problem.y}) 칸이 ${problem.why}.${foot}${next}` };
}
