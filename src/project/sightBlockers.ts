// 시선을 막는 칸 — eventSeesPlayer 의 시선 광선(conditionEventSight.ts)과 소리 거리에 쓴다.
//
// 벽만 막는다. 가구(탁자·궤짝·옷장)는 막지 않는다 — 집주인은 탁자 너머로 서랍 뒤지는 손님을 본다.
//  - 하층(1·2층) 칸이 비었거나(천장·바깥 공백) 사방이 막힌 칸(벽면·천장 타일), 또는 이름표가 벽면·벽·wall 인 칸.
//    물·용암처럼 못 걷지만 트인 칸은 빼고(호수 너머는 보인다), 3·4층(가구)은 보지 않는다.
//  - 맵에 방(명명 로케이션)이 있으면: 어느 방에도 안 든 칸 중 못 걷는 칸(방 사이 벽 띠). 걷는 칸은 문틀이라 트였다.
// 맵 밖은 막힌 것으로 본다.
import { isPassable } from "@/project/collision";
import type { SightBlocker } from "@/project/conditionEventSight";
import type { GameMap, Project, TilesetDef } from "@/project/types";

type MetaLike = { label?: string; role?: string; tags?: readonly string[]; defaultLayer?: string } | null | undefined;

const WALL_WORDS = /벽면|^벽\b|(?:^|[\s·:_-])벽(?:$|[\s·:_-])|천장|ceiling|(?:^|[\s.:_-])wall(?:$|[\s.:_-])/i;
const OPEN_WORDS = /water|river|lake|lava|물|호수|강물|용암|바닥|floor|ground|grass|road|path|길|잔디/i;

const wallTileCache = new WeakMap<TilesetDef, Map<number, boolean>>();

function metaOf(tileset: TilesetDef, tile: number): MetaLike {
  const meta = (tileset as { tileMeta?: unknown }).tileMeta;
  if (!meta) return undefined;
  if (Array.isArray(meta)) return meta[tile] as MetaLike;
  return (meta as Record<string, MetaLike>)[String(tile)];
}

/** 하층 타일 하나가 벽(시선 차단)인가. */
export function isSightWallTile(tileset: TilesetDef | undefined, tile: number): boolean {
  if (!tileset || tile < 0) return false;
  let cache = wallTileCache.get(tileset);
  if (!cache) { cache = new Map(); wallTileCache.set(tileset, cache); }
  const cached = cache.get(tile);
  if (cached !== undefined) return cached;
  const meta = metaOf(tileset, tile);
  const name = `${meta?.role ?? ""} ${meta?.label ?? ""} ${(meta?.tags ?? []).join(" ")}`;
  const pass = tileset.passability?.[tile];
  const sealed = Boolean(pass && !pass.up && !pass.down && !pass.left && !pass.right);
  const wall = WALL_WORDS.test(name) || (sealed && !OPEN_WORDS.test(name));
  cache.set(tile, wall);
  return wall;
}

function insideAnyRoom(map: GameMap, x: number, y: number): boolean {
  return (map.locations ?? []).some((r) => x >= r.x && y >= r.y && x < r.x + Math.max(0, r.w) && y < r.y + Math.max(0, r.h));
}

/** 이 맵의 시선 차단 판정기. 칸마다 한 번 계산해 기억한다(맵·타일이 바뀌면 새로 만든다). */
export function sightBlockerForMap(project: Project, map: GameMap): SightBlocker {
  const tileset = project.tilesets[map.tilesetId];
  const hasRooms = (map.locations?.length ?? 0) > 0;
  const memo = new Map<number, boolean>();
  return (x, y) => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return true;
    const index = y * map.width + x;
    const hit = memo.get(index);
    if (hit !== undefined) return hit;
    const lower = map.lowerTiles[index] ?? -1;
    const overlay = map.lowerOverlayTiles?.[index] ?? -1;
    let blocked = lower < 0 && overlay < 0 && Boolean(tileset);
    if (!blocked) blocked = isSightWallTile(tileset, lower) || isSightWallTile(tileset, overlay);
    if (!blocked && hasRooms && !insideAnyRoom(map, x, y)) blocked = !isPassable(project, map, x, y);
    memo.set(index, blocked);
    return blocked;
  };
}

const blockerCache = new WeakMap<GameMap, { project: Project; blocker: SightBlocker }>();

/** 같은 (프로젝트, 맵) 객체면 판정기를 재사용한다. 런타임 맵 사본이 바뀌면 새로 만든다. */
export function cachedSightBlocker(project: Project | undefined, map: GameMap | undefined): SightBlocker | undefined {
  if (!project || !map || !Array.isArray(map.lowerTiles)) return undefined;
  const hit = blockerCache.get(map);
  if (hit && hit.project === project) return hit.blocker;
  const blocker = sightBlockerForMap(project, map);
  blockerCache.set(map, { project, blocker });
  return blocker;
}
