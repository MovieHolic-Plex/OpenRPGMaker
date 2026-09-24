import { sharedRegionSnapshot } from './sharedSpatialReferences';
import { referenceOwnerManifest } from './tilesetReferences';
import { DIVERSE_VILLAGE_PLACES } from "./diverseVillageReferences";
import { FANTASY_PLACE_REFERENCES } from "./fantasyPlaceReferences";
import { CLIMATE_VILLAGE_PLACE_REFERENCES } from "./climateVillagePlaceReferences";
import { FIELD_ROUTE_PLACE_REFERENCES } from "./fieldRoutePlaceReferences";
import type { GameMap, TilesetDef } from "./types";
import { LAKE_PLACE_REFERENCES, regionReference } from "./regionReferences";

type PlaceSnapshot = { map: GameMap; tileset: TilesetDef };
type SnapshotFile = () => Promise<{ default: unknown }>;
type MultiMapFile = { maps: Record<string, GameMap>; tilesets: Record<string, TilesetDef> };

// 스냅샷 JSON 은 시트 PNG 를 base64 로 품어 합치면 50MB 가 넘는다. 정적 import 하면 편집기 main 청크에
// 통째로 실려 새로고침마다 받고 파싱했다(2026-09-24 실측 main.js 74MB). 파일마다 따로 청크로 두고
// 조수가 그 장소를 읽을 때만 받는다 — 읽기 전에 preloadRegionReference 를 기다린다.
const SNAPSHOT_FILES: Record<string, SnapshotFile> = {
  "river-fortress-160x144": () => import("./regionReferences/river-fortress.json"),
  "castle-courtyard": () => import("./regionReferences/castle-courtyard.json"),
  "castle-small-harbor": () => import("./regionReferences/castle-small-harbor.json"),
  "castle-stone-lodge": () => import("./regionReferences/castle-stone-lodge.json"),
  "forest-cabin-40x30": () => import("./regionReferences/forest-cabin.json"),
  "forest-star-64x56": () => import("./regionReferences/forest-star.json"),
  "gubisup-80x72": () => import("./regionReferences/gubisup.json"),
  "small-forest-village-80x72": () => import("./regionReferences/small-forest-village.json"),
  "forest-cliff-village-80x72": () => import("./regionReferences/forest-cliff-village.json"),
  "high-cliff-village-80x88": () => import("./regionReferences/high-cliff-village.json"),
  "cliff-forest-bridge-80x72": () => import("./regionReferences/cliff-forest-bridge.json"),
  "peaceful-forest-100x100": () => import("./regionReferences/peaceful-forest.json"),
  "great-falls-100x100": () => import("./regionReferences/great-falls.json"),
  "rebuilt-forest-village-64x64": () => import("./regionReferences/rebuilt-forest-village.json"),
  "harmony-hill-village-64x64": () => import("./regionReferences/harmony-hill-village.json"),
  "hill-forest-cave-20x16": () => import("./regionReferences/hill-forest-cave.json"),
  "rebuilt-forest-cave-20x16": () => import("./regionReferences/rebuilt-forest-cave.json"),
  "organic-crescent-lake-80x72": () => import("./regionReferences/organic-crescent-lake.json"),
  "organic-fork-stream-80x72": () => import("./regionReferences/organic-fork-stream.json"),
  "organic-terrace-gardens-80x72": () => import("./regionReferences/organic-terrace-gardens.json"),
  "organic-woodland-lane-80x72": () => import("./regionReferences/organic-woodland-lane.json"),
  "organic-orchard-court-80x72": () => import("./regionReferences/organic-orchard-court.json"),
  "organic-fishing-cove-80x72": () => import("./regionReferences/organic-fishing-cove.json"),
  "organic-five-groves-80x72": () => import("./regionReferences/organic-five-groves.json"),
  "pine-hamlets-80x64": () => import("./regionReferences/pine-hamlets.json"),
  "terrace-cliff-village-88x72": () => import("./regionReferences/terrace-cliff-village.json"),
  "reed-bay-village-88x64": () => import("./regionReferences/reed-bay-village.json"),
  "twin-falls-river-village-88x72": () => import("./regionReferences/twin-falls-river-village.json"),
  "chapel-hill-parish-80x64": () => import("./regionReferences/chapel-hill-parish.json"),
  "ford-castle-town-100x92": () => import("./regionReferences/ford-castle-town.json"),
  "mistpond-hollow-80x64": () => import("./regionReferences/mistpond-hollow.json"),
  "river-forest-village-78x44": () => import("./regionReferences/river-forest-village.json"),
  "emerald-basin-80x64": () => import("./regionReferences/emerald-basin.json"),
  "hill-forest-village-64x64": () => import("./regionReferences/hill-forest-village.json"),
  "castle-town-100x100": () => import("./regionReferences/castle-town.json"),
  "walled-settlement-43x45": () => import("./regionReferences/walled-settlement.json"),
  "lake-village-60x60": () => import("./regionReferences/lake-village.json"),
};
const FANTASY_FILE: SnapshotFile = () => import("./regionReferences/fantasy-places.json");
const CLIMATE_FILE: SnapshotFile = () => import("./regionReferences/climate-villages.json");
const FIELD_FILE: SnapshotFile = () => import("./regionReferences/field-routes.json");
const SHIPS_FILE: SnapshotFile = () => import("./regionReferences/ships.json");
const SHIP_MAP_IDS: Record<string, string> = {
  "bluewave-ship": "map_bluewave_ship",
  "giant-ship": "map_bluewave_giant",
  "wide-ship": "map_bluewave_vertical",
  "bluewave-harbor": "map_bluewave_harbor",
};

type SnapshotSource = { file: SnapshotFile; pick(data: unknown): PlaceSnapshot | undefined };

const whole = (file: SnapshotFile): SnapshotSource => ({ file, pick: data => data as PlaceSnapshot });
/** Fantasy/climate/field/ship snapshots share one file per family; the entry names its map. */
const fromMaps = (file: SnapshotFile, mapId: string): SnapshotSource => ({ file, pick: (data) => {
  const source = data as MultiMapFile;
  const map = source.maps[mapId];
  return map ? { map, tileset: source.tilesets[map.tilesetId]! } : undefined;
} });

function snapshotSource(id: string): SnapshotSource | undefined {
  if (SNAPSHOT_FILES[id]) return whole(SNAPSHOT_FILES[id]);
  // Place cards for the diverse villages reuse their region snapshot.
  const place = DIVERSE_VILLAGE_PLACES.find(entry => entry.id === id);
  if (place && SNAPSHOT_FILES[place.regionReferenceId]) return whole(SNAPSHOT_FILES[place.regionReferenceId]);
  const fantasy = FANTASY_PLACE_REFERENCES.find(entry => entry.id === id);
  if (fantasy) return fromMaps(FANTASY_FILE, fantasy.sourceMapId);
  const climate = CLIMATE_VILLAGE_PLACE_REFERENCES.find(entry => entry.id === id);
  if (climate) return fromMaps(CLIMATE_FILE, climate.sourceMapId);
  const field = FIELD_ROUTE_PLACE_REFERENCES.find(entry => entry.id === id);
  if (field) return fromMaps(FIELD_FILE, field.sourceMapId);
  const shipMapId = SHIP_MAP_IDS[id];
  return shipMapId ? fromMaps(SHIPS_FILE, shipMapId) : undefined;
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

const snapshotId = (id: string): string => LAKE_PLACE_REFERENCES.some(entry => entry.id === id) ? "lake-village-60x60" : id;

/** Fetch the snapshot chunk behind one reference id. Unknown ids resolve quietly; readRegionReference reports them. */
export async function preloadRegionReference(id: string): Promise<void> {
  const source = sharedRegionSnapshot(id) ? undefined : snapshotSource(snapshotId(id));
  if (source) await load(source.file);
}

/** Every snapshot chunk — for sweeps over all references (tests, capture scripts). */
export async function preloadAllRegionReferences(): Promise<void> {
  await Promise.all([...Object.values(SNAPSHOT_FILES), FANTASY_FILE, CLIMATE_FILE, FIELD_FILE, SHIPS_FILE].map(load));
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

/** Bounded rows let AI recover the complete raster without truncating a single large response. */
export function readRegionReference(id: string, row = 0, rows = 8) {
  const reference = regionReference(id);
  if (!reference) throw new Error(`Unknown region reference: ${id}`);
  if (!Number.isInteger(row) || !Number.isInteger(rows) || row < 0 || row >= reference.height || rows < 1 || rows > 16) {
    throw new Error("row must be within the map; rows must be 1..16");
  }
  const place = LAKE_PLACE_REFERENCES.find(entry => entry.id === id);
  const source = snapshotFor(snapshotId(id));
  if (!source) throw new Error(`Unknown region reference: ${id}`);
  const crop = (tiles: number[]) => Array.from({ length: reference.height }, (_, y) => tiles.slice((y + (place?.y ?? 0)) * source.map.width + (place?.x ?? 0), (y + (place?.y ?? 0)) * source.map.width + (place?.x ?? 0) + reference.width)).flat();
  const selected = place ? { ...source, map: { ...source.map, width: place.width, height: place.height, lowerTiles: crop(source.map.lowerTiles), upperTiles: crop(source.map.upperTiles), events: [] } } : source;
  const endRow = Math.min(reference.height, row + rows);
  const { map, tileset } = selected;
  const lowerTiles = map.lowerTiles.slice(row * map.width, endRow * map.width);
  const upperTiles = map.upperTiles.slice(row * map.width, endRow * map.width);
  const used = [...new Set([...lowerTiles, ...upperTiles])].filter(tile => tile >= 0);
  return structuredClone({ ...referenceOwnerManifest(reference), map: {
    id: map.id, width: map.width, height: map.height, tileSize: map.tileSize,
    tilesetId: map.tilesetId, row, rows: endRow - row, nextRow: endRow < map.height ? endRow : null,
    lowerTiles, upperTiles, events: map.events,
  }, tileset: { id: tileset.id, image: tileset.image, tileSize: tileset.tileSize, tilesPerRow: tileset.tilesPerRow,
    tiles: used.map(tile => ({ tile, passability: tileset.passability[tile], priority: tileset.priority[tile], terrain: tileset.terrain[tile] })),
  } });
}
