// project/staging/doorCells.ts
// 문·계단·출구 그림 칸 찾기(타일 이름표 낱말 + 건물 키트 entrance 부품). 장면 검사(lint/scenePolishLint.ts)와
// 런타임 문 연출(player/playSceneDoorway.ts — 문 칸이면 문 소리)이 같이 쓴다. 검사 모듈이 큰 JSON 을 들고 있어
// 출하 플레이어가 그 모듈을 끌어오지 않게 여기로 뺐다(2026-10-22).
import type { GameMap, Project, TilesetDef } from "../types";

const DOOR_WORDS = /(?<![창주])문(?![양자서장제구화턱])|door|(?<!인)도어|입구|출입|출구|현관|계단|stair|엘리베이터|승강기|에스컬레이터|escalator|elevator|lift|사다리|ladder|개찰|portal|포털|게이트|gate|구멍|hole|셔터|맨홀|manhole|동굴 입/iu;
const STAIR_DOWN = /내려가|아래로|하강|down|下り|구멍|hole/iu;
const STAIR_UP = /올라가|위로|상승|\bup\b|上り/iu;

// ---------------------------------------------------------------------------- 문·계단 타일

export type TileMetaLike = { label?: string; tags?: readonly string[]; description?: string };
type DoorSets = { door: Set<number>; down: Set<number>; up: Set<number> };
/** 쓰기 도구마다 초안이 타일셋을 복제하므로 객체가 아니라 id·크기로 기억한다(이름표·키트가 바뀌면 크기도 바뀐다). */
const doorTileCache = new Map<string, DoorSets>();

export function doorCacheKey(tileset: TilesetDef): string {
  const meta = (tileset as { tileMeta?: unknown }).tileMeta;
  const metaSize = Array.isArray(meta) ? meta.length : meta && typeof meta === "object" ? Object.keys(meta).length : 0;
  const kits = (tileset as { structureKits?: readonly unknown[] }).structureKits?.length ?? 0;
  return `${tileset.id}|${metaSize}|${kits}`;
}

function metaAt(tileset: TilesetDef, tile: number): TileMetaLike | undefined {
  const meta = (tileset as { tileMeta?: unknown }).tileMeta;
  if (!meta) return undefined;
  if (Array.isArray(meta)) return meta[tile] as TileMetaLike | undefined;
  return (meta as Record<string, TileMetaLike>)[String(tile)];
}

/** 이 타일셋에서 문·계단·출구로 읽히는 칸 번호. 이름표 낱말 + 건물 키트의 entrance 부품 칸. */
function doorTiles(tileset: TilesetDef | undefined): DoorSets {
  const empty = { door: new Set<number>(), down: new Set<number>(), up: new Set<number>() };
  if (!tileset) return empty;
  const key = doorCacheKey(tileset);
  const cached = doorTileCache.get(key);
  if (cached) return cached;
  const out = { door: new Set<number>(), down: new Set<number>(), up: new Set<number>() };
  const meta = (tileset as { tileMeta?: unknown }).tileMeta;
  const entries: Array<[number, TileMetaLike]> = Array.isArray(meta)
    ? meta.map((m, i) => [i, m as TileMetaLike])
    : meta && typeof meta === "object" ? Object.entries(meta as Record<string, TileMetaLike>).map(([k, m]) => [Number(k), m]) : [];
  for (const [tile, m] of entries) {
    if (!m || typeof m !== "object") continue;
    const text = `${m.label ?? ""} ${(m.tags ?? []).join(" ")}`;
    if (!DOOR_WORDS.test(text)) continue;
    out.door.add(tile);
    if (/계단|stair|escalator|에스컬레이터|구멍|hole|사다리|ladder/iu.test(text)) {
      if (STAIR_DOWN.test(m.label ?? "")) out.down.add(tile);
      else if (STAIR_UP.test(m.label ?? "")) out.up.add(tile);
    }
  }
  for (const raw of (tileset as { structureKits?: readonly unknown[] }).structureKits ?? []) {
    const kit = raw as { rows?: Array<{ tiles?: number[]; upperTiles?: number[] }>; parts?: Array<{ kind?: string; dx?: number; dy?: number; w?: number; h?: number }> };
    for (const part of kit.parts ?? []) {
      if (part?.kind !== "entrance" || typeof part.dx !== "number" || typeof part.dy !== "number") continue;
      for (let y = part.dy; y < part.dy + (part.h ?? 1); y++) {
        for (let x = part.dx; x < part.dx + (part.w ?? 1); x++) {
          const row = kit.rows?.[y];
          for (const t of [row?.tiles?.[x], row?.upperTiles?.[x]]) {
            if (typeof t !== "number" || t < 0) continue;
            // 키트 문 부품 칸이라도 풀밭·포석 같은 바닥 타일은 문 그림이 아니다(다른 곳에도 깔린다).
            const m = metaAt(tileset, t) as (TileMetaLike & { role?: string; passage?: string }) | undefined;
            if (m && (m.role === "terrain" || m.role === "empty" || (m.passage && m.passage !== "solid" && m.role !== "building" && m.role !== "prop"))) continue;
            out.door.add(t);
          }
        }
      }
    }
  }
  if (doorTileCache.size > 64) doorTileCache.clear();
  doorTileCache.set(key, out);
  return out;
}

export const LAYERS = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"] as const;

function tilesAt(map: GameMap, x: number, y: number): number[] {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return [];
  const i = y * map.width + x;
  const out: number[] = [];
  for (const key of LAYERS) {
    const arr = (map as unknown as Record<string, unknown>)[key];
    if (Array.isArray(arr)) { const t = arr[i]; if (typeof t === "number" && t >= 0) out.push(t); }
  }
  return out;
}

export function cellIs(project: Project, map: GameMap, x: number, y: number, kind: "door" | "down" | "up"): boolean {
  const set = doorTiles(project.tilesets[map.tilesetId])[kind];
  return set.size > 0 && tilesAt(map, x, y).some((t) => set.has(t));
}

/** 문·계단·엘리베이터 그림 칸인가(이름표 낱말 + 건물 키트 entrance 부품). create_transfer_pair 가 트리거를 문 칸에 둘 때 쓴다. */
export function isDoorArtCell(project: Project, map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height && cellIs(project, map, x, y, "door");
}

