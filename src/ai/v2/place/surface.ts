// 맵 칸의 표면 — 길·땅·물·벽·출구. 길 판정과 «새 길을 무엇으로 까는가»는 칩셋의 표면 선언(@/project/tilesetSurface) 하나에서만 온다.
// 길을 보는 끝맺음 단계·빌더는 모두 여기를 읽는다(이름표 낱말을 따로 맞추지 않는다).
import { isPassable } from "@/project/collision";
import { tilesetSurface, type TilesetSurface } from "@/project/tilesetSurface";
import type { GameMap, Project } from "@/project/types";

export type SurfaceKind = "gate" | "road" | "water" | "wall" | "ground";

const surfaceOf = (project: Project, map: GameMap): TilesetSurface => tilesetSurface(project.tilesets[map.tilesetId]);
/** 네 층 모두 — 허공·물 위의 다리·잔교는 위층에 놓인 길 칸이다. */
const tileLayers = (map: GameMap): (ArrayLike<number> | undefined)[] => {
  const m = map as unknown as { lowerOverlayTiles?: ArrayLike<number>; upperOverlayTiles?: ArrayLike<number> };
  return [map.lowerTiles, m.lowerOverlayTiles, map.upperTiles, m.upperOverlayTiles];
};

/** 길 칸인가 — 어느 층에든 그 칩셋이 선언한 길 칸이 놓였다(걸을 수 있는지는 보지 않는다). */
export function isRoadCell(project: Project, map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const road = surfaceOf(project, map).road, i = y * map.width + x;
  return tileLayers(map).some((layer) => road.has(layer?.[i] ?? -1));
}

/** 걸을 수 있는 길 칸인가. */
export function isRoadGround(project: Project, map: GameMap, x: number, y: number): boolean {
  return isRoadCell(project, map, x, y) && isPassable(project, map, x, y);
}

/** 맵의 길 칸 전부(칸 번호 y*w+x). */
export function roadCells(project: Project, map: GameMap): Set<number> {
  const road = surfaceOf(project, map).road, layers = tileLayers(map), out = new Set<number>();
  for (let i = 0; i < map.width * map.height; i++) if (layers.some((layer) => road.has(layer?.[i] ?? -1))) out.add(i);
  return out;
}

/**
 * 걸어서 이어지는 «길 줄» 칸 전부(칸 번호) — 길 + 길을 잇는 칸(광장 판석·다리·잔교) + 계단(계단 칸·단을 오르는 경사 칸), 걸을 수 있는 칸만.
 * 길망(judge/roadNetwork)이 «이 길이 어디로 가는가» 를 볼 때 쓴다 — 다리·계단에서 길이 끊긴 것으로 세지 않게.
 */
export function wayCells(project: Project, map: GameMap): Set<number> {
  const { road, links, stairs } = surfaceOf(project, map), layers = tileLayers(map), out = new Set<number>();
  const ramps = (map as unknown as { relief?: { ramps?: ArrayLike<number> } }).relief?.ramps;
  for (let i = 0; i < map.width * map.height; i++) {
    const way = (ramps?.[i] ?? 0) !== 0 || layers.some((layer) => { const t = layer?.[i] ?? -1; return road.has(t) || links.has(t) || stairs.has(t); });
    if (way && isPassable(project, map, i % map.width, Math.floor(i / map.width))) out.add(i);
  }
  return out;
}

/** 칩셋의 물 칸 묶음(tileGroups 역할 water)에 든 칸인가. */
function isWaterTile(project: Project, map: GameMap, tile: number): boolean {
  if (tile < 0) return false;
  const groups = project.tilesets[map.tilesetId]?.tileGroups ?? [];
  return groups.some((g) => g.role === "water" && (g.tileIds as readonly number[] | undefined)?.includes(tile));
}

/** 물 칸인가(바닥 층이 칩셋의 물 묶음). */
export function isWaterCell(project: Project, map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height && isWaterTile(project, map, map.lowerTiles[y * map.width + x] ?? -1);
}

/** 그 칸의 표면: 다른 맵으로 가는 이동이 선 칸은 출구, 선언된 길, 못 걷는 물, 그 밖의 못 걷는 칸은 벽, 나머지는 땅. */
export function surfaceKind(project: Project, map: GameMap, x: number, y: number): SurfaceKind {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return "wall";
  if ((map.events ?? []).some((e) => e.x === x && e.y === y && leavesMap(e.pages ?? e.commands, map.id))) return "gate";
  if (!isPassable(project, map, x, y)) return isWaterTile(project, map, map.lowerTiles[y * map.width + x] ?? -1) ? "water" : "wall";
  return isRoadCell(project, map, x, y) ? "road" : "ground";
}

/** 이벤트 명령 어딘가에 다른 맵으로 가는 이동이 있는가. */
export function leavesMap(node: unknown, here: string): boolean {
  if (Array.isArray(node)) return node.some((n) => leavesMap(n, here));
  if (!node || typeof node !== "object") return false;
  const r = node as Record<string, unknown>;
  if (r.kind === "transfer" && typeof r.mapId === "string" && r.mapId !== here) return true;
  return Object.values(r).some((v) => v && typeof v === "object" && leavesMap(v, here));
}

/** 이 맵에 새 길을 까는 재료(fill_region material) — 선언된 재료 가운데 맵에 가장 많이 깔린 것. 길이 거의 없는 맵(6칸 미만)이나 선언이 없는 칩셋은 undefined. */
export function roadMaterial(project: Project, map: GameMap): string | undefined {
  const { lay } = surfaceOf(project, map);
  if (!lay.length || roadCells(project, map).size < 6) return undefined;
  const count = (tiles: ReadonlySet<number>): number => { let n = 0; for (const t of map.lowerTiles) if (tiles.has(t)) n += 1; return n; };
  return [...lay].sort((a, b) => count(b.tiles) - count(a.tiles))[0]!.material;
}
