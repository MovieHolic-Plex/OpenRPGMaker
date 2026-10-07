import { sharedRegionSnapshot } from './sharedSpatialReferences';
import { referenceOwnerManifest } from './tilesetReferences';
import { JOSEON_PLACE_REFERENCES } from "./joseonPlaceReferences";
import type { GameMap, TilesetDef } from "./types";
import { regionReference } from "./regionReferences";

/** 건물 목록·킷 요약(생성 건물 장소). 조수가 「3층 대저택」처럼 이름으로 고르고 출처(생성형 이미지/손 도트)를 본다. */
type PlaceBuilding = { id: string; role: string; name: string; kit: string; image: string; x: number; y: number; width: number; height: number; doors: { x: number; y: number }[] };
type PlaceKitSummary = { kit: string; name: string; image: string; blueprint: string; width: number; height: number; stories?: number | null; usedHere: string[] };
type PlaceSnapshot = { map: GameMap; tileset: TilesetDef; assets?: import('./types').Project['assets']['uploaded']; buildings?: PlaceBuilding[]; kits?: PlaceKitSummary[] };
type SnapshotFile = () => Promise<{ default: unknown }>;
type MultiMapFile = { maps: Record<string, GameMap>; tilesets: Record<string, TilesetDef> };

// 스냅샷 JSON 은 시트 PNG 를 base64 로 품어 합치면 50MB 가 넘는다. 정적 import 하면 편집기 main 청크에
// 통째로 실려 새로고침마다 받고 파싱했다(2026-09-24 실측 main.js 74MB). 파일마다 따로 청크로 두고
// 조수가 그 장소를 읽을 때만 받는다 — 읽기 전에 preloadRegionReference 를 기다린다.
const SNAPSHOT_FILES: Record<string, SnapshotFile> = {
  "modern-city-60x60": () => import("./regionReferences/modern-city.json"),
  "jp-city-shopstreet-48x40": () => import("./regionReferences/jp-city-shopstreet.json"),
  "wz-space-boathouse-30x22": () => import("./regionReferences/wz-space-boathouse.json"),
  "wz-space-carriage-30x22": () => import("./regionReferences/wz-space-carriage.json"),
  "wz-space-clocktower-24x18": () => import("./regionReferences/wz-space-clocktower.json"),
  "wz-space-greenhouse-24x17": () => import("./regionReferences/wz-space-greenhouse.json"),
  "wz-space-honeydukes-22x16": () => import("./regionReferences/wz-space-honeydukes.json"),
  "wz-space-infirmary-26x18": () => import("./regionReferences/wz-space-infirmary.json"),
  "wz-space-library-24x17": () => import("./regionReferences/wz-space-library.json"),
  "wz-space-owlery-22x16": () => import("./regionReferences/wz-space-owlery.json"),
  "wz-space-postoffice-20x15": () => import("./regionReferences/wz-space-postoffice.json"),
  "wz-space-potions-24x17": () => import("./regionReferences/wz-space-potions.json"),
  "wz-space-quidditch-32x24": () => import("./regionReferences/wz-space-quidditch.json"),
  "wz-space-shared-common-24x17": () => import("./regionReferences/wz-space-shared-common.json"),
  "wz-space-shared-corridor-10x22": () => import("./regionReferences/wz-space-shared-corridor.json"),
  "wz-space-shared-30x22": () => import("./regionReferences/wz-space-shared.json"),
  "wz-space-wandshop-20x15": () => import("./regionReferences/wz-space-wandshop.json"),
  "wz-nat-example-forest-edge-16x12": () => import("./regionReferences/wz-nat-example-forest-edge.json"),
  "wz-post-example-street-18x14": () => import("./regionReferences/wz-post-example-street.json"),
  "jp-city-tram-street-48x30": () => import("./regionReferences/jp-city-tramstreet.json"),
  "jp-city-school-68x48": () => import("./regionReferences/jp-city-school.json"),
  "jp-city-town-96x80": () => import("./regionReferences/jp-city-town.json"),
};
const JOSEON_FILE: SnapshotFile = () => import("./regionReferences/joseon-village.json");

type SnapshotSource = { file: SnapshotFile; pick(data: unknown): PlaceSnapshot | undefined };

const whole = (file: SnapshotFile): SnapshotSource => ({ file, pick: data => data as PlaceSnapshot });
/** Multi-map snapshots (조선) share one file; the entry names its map. */
const fromMaps = (file: SnapshotFile, mapId: string): SnapshotSource => ({ file, pick: (data) => {
  const source = data as MultiMapFile;
  const map = source.maps[mapId];
  return map ? { map, tileset: source.tilesets[map.tilesetId]! } : undefined;
} });

function snapshotSource(id: string): SnapshotSource | undefined {
  if (SNAPSHOT_FILES[id]) return whole(SNAPSHOT_FILES[id]);
  const joseon = JOSEON_PLACE_REFERENCES.find(entry => entry.id === id);
  return joseon ? fromMaps(JOSEON_FILE, joseon.sourceMapId) : undefined;
}

const loaded = new Map<SnapshotFile, unknown>();
const pending = new Map<SnapshotFile, Promise<void>>();
const failed = new Map<SnapshotFile, unknown>();

function load(file: SnapshotFile): Promise<void> {
  if (loaded.has(file)) return Promise.resolve();
  let promise = pending.get(file);
  if (!promise) {
    failed.delete(file);
    promise = file()
      .then(module => { loaded.set(file, module.default); })
      .catch((error: unknown) => { failed.set(file, error); throw error; })
      .finally(() => pending.delete(file));
    pending.set(file, promise);
  }
  return promise;
}


/** Fetch the snapshot chunk behind one reference id. Unknown ids resolve quietly; readRegionReference reports them. */
export async function preloadRegionReference(id: string): Promise<void> {
  const source = sharedRegionSnapshot(id) ? undefined : snapshotSource(id);
  if (source) await load(source.file);
}

/** Every snapshot chunk — for sweeps over all references (tests, capture scripts). */
export async function preloadAllRegionReferences(): Promise<void> {
  await Promise.all([...Object.values(SNAPSHOT_FILES), JOSEON_FILE].map(load));
}

function snapshotFor(id: string): PlaceSnapshot | undefined {
  const shared = sharedRegionSnapshot(id); if (shared) return shared;
  const source = snapshotSource(id);
  if (!source) return undefined;
  if (!loaded.has(source.file)) {
    const error = failed.get(source.file);
    // A synchronous caller that skipped preload starts the fetch so the same call succeeds on retry.
    void load(source.file).catch(() => undefined);
    throw new Error(error
      ? `${id}: 참고 원본을 불러오지 못했습니다 (${error instanceof Error ? error.message : String(error)}) — 같은 호출을 다시 하면 재시도합니다.`
      : `${id}: 참고 원본을 불러오는 중입니다 — 잠시 뒤 같은 호출을 다시 하세요.`);
  }
  return source.pick(loaded.get(source.file));
}

/**
 * The shipped snapshot behind one reference. Throws the
 * same 「불러오는 중」 error as readRegionReference until preloadRegionReference resolved; undefined for unknown ids.
 * Snapshot tilesets can be trimmed (no tileMeta) — importers prefer the reference's projectDownload when it has one.
 */
export function regionReferenceSnapshotScene(id: string): PlaceSnapshot | undefined {
  if (!regionReference(id)) return undefined;
  return snapshotFor(id);
}

/** Bounded rows let AI recover the complete raster without truncating a single large response. */
export function readRegionReference(id: string, row = 0, rows = 8) {
  const reference = regionReference(id);
  if (!reference) throw new Error(`Unknown region reference: ${id}`);
  if (!Number.isInteger(row) || !Number.isInteger(rows) || row < 0 || row >= reference.height || rows < 1 || rows > 16) {
    throw new Error("row must be within the map; rows must be 1..16");
  }
  const source = snapshotFor(id);
  if (!source) throw new Error(`Unknown region reference: ${id}`);
  const selected = regionReferenceSnapshotScene(id)!;
  const endRow = Math.min(reference.height, row + rows);
  const { map, tileset } = selected;
  const lowerTiles = map.lowerTiles.slice(row * map.width, endRow * map.width);
  const upperTiles = map.upperTiles.slice(row * map.width, endRow * map.width);
  const used = [...new Set([...lowerTiles, ...upperTiles])].filter(tile => tile >= 0);
  // 건물 목록·킷 요약은 첫 쪽(row 0)에만 싣는다 — 이어 읽기마다 되풀이하지 않게.
  const catalog = row === 0 && source.buildings ? { buildings: source.buildings, kits: source.kits ?? [] } : {};
  return structuredClone({ ...referenceOwnerManifest(reference), ...catalog, map: {
    id: map.id, width: map.width, height: map.height, tileSize: map.tileSize,
    tilesetId: map.tilesetId, row, rows: endRow - row, nextRow: endRow < map.height ? endRow : null,
    lowerTiles, upperTiles, events: map.events,
  }, tileset: { id: tileset.id, image: tileset.image, tileSize: tileset.tileSize, tilesPerRow: tileset.tilesPerRow,
    tiles: used.map(tile => ({ tile, passability: tileset.passability[tile], priority: tileset.priority[tile], terrain: tileset.terrain[tile] })),
  } });
}
