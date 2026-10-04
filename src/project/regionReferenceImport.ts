// 등록 장소(REGION_REFERENCES·PLACE_REFERENCES)를 프로젝트 맵으로 가져온다 — 조수 도구 import_region_reference 와
// 편집기 「장소 → 맵에 넣기」가 같은 경로를 쓴다.
//
// 원본은 두 가지다. ① 장소의 projectDownload(.oprn.json) — 타일셋 전체(메타·이식·그룹·참고문서)와 업로드 아틀라스
// 자산을 품는다. ② 번들 스냅샷(regionReferenceSnapshots) — 내려받기가 없는 장소용. 스냅샷 타일셋은 메타가 깎였을 수
// 있어 ①을 먼저 쓴다.
//
// 타일셋은 칸 번호가 곧 그림이라, 프로젝트에 같은 id 타일셋이 있으면 같은 그림을 가리키는지(이미지·이식)를 확인하고
// 모자란 뒤쪽 칸(이식 2550~ 등)만 붙인다. 이미 다른 그림이 앉은 칸이 하나라도 있으면 덮지 않고 사본 타일셋을 따로 둔다.
import { regionReference } from "./regionReferences";
import { preloadRegionReference, regionReferenceSnapshotScene } from "./regionReferenceSnapshots";
import { EXTRA_LAYER_KEYS, type ExtraLayerFields } from "./mapLayers";
import { bundledChipsetFrameCount } from "@/assets/bundled";
import { ensureDocumentedTileset } from "./defaults/dungeonSheetTilesets";
import type { GameEvent, GameMap, MapId, Project, TileGraft, TilesetDef, TilesetId } from "./types";

export interface RegionReferenceScene {
  readonly referenceId: string;
  readonly name: string;
  readonly map: GameMap;
  readonly tileset: TilesetDef;
  /** Uploaded images the tileset (or its grafts) draws from, keyed by asset id. */
  readonly assets: Project["assets"]["uploaded"];
  readonly source: "download" | "snapshot" | "reviewed";
}

type DownloadProject = {
  maps?: Record<string, GameMap>;
  tilesets?: Record<string, TilesetDef>;
  assets?: { uploaded?: Project["assets"]["uploaded"] };
};

type DownloadLoader = (publicPath: string) => Promise<unknown>;

const fetchLoader: DownloadLoader = async (publicPath) => {
  const response = await fetch(publicPath);
  if (!response.ok) throw new Error(`${publicPath}: HTTP ${response.status}`);
  return response.json();
};
let downloadLoader: DownloadLoader = fetchLoader;

/** The browser fetches public/ over HTTP; the headless runner installs a file reader. */
export function setRegionReferenceDownloadLoader(loader: DownloadLoader | null): void {
  downloadLoader = loader ?? fetchLoader;
}

const scenes = new Map<string, RegionReferenceScene>();
const pending = new Map<string, Promise<RegionReferenceScene>>();
const failures = new Map<string, string>();

function sceneFromDownload(id: string, data: DownloadProject): RegionReferenceScene | undefined {
  const reference = regionReference(id);
  if (!reference || !data.maps || !data.tilesets) return undefined;
  const maps = Object.values(data.maps);
  const map = data.maps[reference.sourceMapId]
    ?? data.maps[id]
    ?? maps.find(candidate => candidate.width === reference.width && candidate.height === reference.height && candidate.tilesetId === reference.tilesetId)
    ?? (maps.length === 1 ? maps[0] : undefined);
  const tileset = map && data.tilesets[map.tilesetId];
  if (!map || !tileset) return undefined;
  const uploaded = data.assets?.uploaded ?? {};
  const assetIds = new Set<string>();
  if (tileset.image.type === "uploaded") assetIds.add(tileset.image.id);
  for (const graft of tileset.tileGrafts ?? []) if (uploaded[graft.sourceChipset]) assetIds.add(graft.sourceChipset);
  const assets = Object.fromEntries([...assetIds].filter(assetId => uploaded[assetId]).map(assetId => [assetId, uploaded[assetId]!]));
  return { referenceId: id, name: reference.name, map, tileset, assets, source: "download" };
}

async function loadScene(id: string): Promise<RegionReferenceScene> {
  const reference = regionReference(id);
  if (!reference) throw new Error(`Unknown region reference: ${id}`);
  const download = "projectDownload" in reference && typeof reference.projectDownload === "string" ? reference.projectDownload : undefined;
  if (download) {
    try {
      const scene = sceneFromDownload(id, await downloadLoader(download) as DownloadProject);
      if (scene) return scene;
    } catch {
      // Fall through to the bundled snapshot; it still carries the tiles.
    }
  }
  await preloadRegionReference(id);
  const snapshot = regionReferenceSnapshotScene(id);
  if (!snapshot) throw new Error(`${id}: 이 장소의 맵 자료를 찾을 수 없습니다`);
  return { referenceId: id, name: reference.name, map: snapshot.map, tileset: snapshot.tileset, assets: snapshot.assets ?? {}, source: "snapshot" };
}

/** Load one reference's importable scene (download first, snapshot second). Cached per id. */
export function preloadRegionReferenceScene(id: string): Promise<RegionReferenceScene> {
  const ready = scenes.get(id);
  if (ready) return Promise.resolve(ready);
  let promise = pending.get(id);
  if (!promise) {
    failures.delete(id);
    promise = loadScene(id)
      .then(scene => { scenes.set(id, scene); return scene; })
      .catch((error: unknown) => { failures.set(id, error instanceof Error ? error.message : String(error)); throw error; })
      .finally(() => pending.delete(id));
    pending.set(id, promise);
  }
  return promise;
}

/** Synchronous read for tools: throws a retryable 「불러오는 중」 error until the scene is cached. */
export function regionReferenceScene(id: string): RegionReferenceScene {
  const scene = scenes.get(id);
  if (scene) return scene;
  if (!regionReference(id)) throw new Error(`Unknown region reference: ${id} — read_region_reference 를 id 없이 불러 목록을 보세요`);
  const failure = failures.get(id);
  void preloadRegionReferenceScene(id).catch(() => undefined);
  throw new Error(failure
    ? `${id}: 장소 원본을 불러오지 못했습니다 (${failure}) — 같은 호출을 다시 하면 재시도합니다.`
    : `${id}: 장소 원본을 불러오는 중입니다 — 잠시 뒤 같은 호출을 다시 하세요.`);
}

// ── 검토 장소(reviewedPlaceIndex, 편집기 「장소」 탭) ──────────────────────
// 검토 장소는 층·방마다 맵이 하나씩이라 장면이 여러 개다. 원본(reviewedPlaces/catalog.json, 11MB)은 쓸 때만 불러온다.
const reviewedScenes = new Map<string, RegionReferenceScene[]>();
const reviewedPending = new Map<string, Promise<RegionReferenceScene[]>>();
const reviewedFailures = new Map<string, string>();

async function loadReviewedScenes(placeId: string): Promise<RegionReferenceScene[]> {
  const catalog = await import("./defaults/spatial/reviewedPlaceCatalog");
  const uploaded = catalog.reviewedPlaceAssets();
  return catalog.reviewedPlaceMaps(placeId).map(({ map, tileset }) => {
    const assetIds = new Set<string>();
    if (tileset.image.type === "uploaded") assetIds.add(tileset.image.id);
    for (const graft of tileset.tileGrafts ?? []) if (uploaded[graft.sourceChipset]) assetIds.add(graft.sourceChipset);
    const assets = Object.fromEntries([...assetIds].filter(assetId => uploaded[assetId]).map(assetId => [assetId, uploaded[assetId]!]));
    return { referenceId: placeId, name: map.name, map, tileset, assets, source: "reviewed" as const };
  });
}

/** Load every map of one reviewed place (floors, rooms). Cached per id. */
export function preloadReviewedPlaceScenes(placeId: string): Promise<RegionReferenceScene[]> {
  const ready = reviewedScenes.get(placeId);
  if (ready) return Promise.resolve(ready);
  let promise = reviewedPending.get(placeId);
  if (!promise) {
    reviewedFailures.delete(placeId);
    promise = loadReviewedScenes(placeId)
      .then(found => { reviewedScenes.set(placeId, found); return found; })
      .catch((error: unknown) => { reviewedFailures.set(placeId, error instanceof Error ? error.message : String(error)); throw error; })
      .finally(() => reviewedPending.delete(placeId));
    reviewedPending.set(placeId, promise);
  }
  return promise;
}

/** Synchronous read for tools, like regionReferenceScene. */
export function reviewedPlaceScenes(placeId: string): RegionReferenceScene[] {
  const ready = reviewedScenes.get(placeId);
  if (ready) return ready;
  const failure = reviewedFailures.get(placeId);
  void preloadReviewedPlaceScenes(placeId).catch(() => undefined);
  throw new Error(failure
    ? `${placeId}: 검토 장소를 불러오지 못했습니다 (${failure})`
    : `${placeId}: 검토 장소 원본을 불러오는 중입니다 — 잠시 뒤 같은 호출을 다시 하세요.`);
}

// ── 타일셋 설치 ─────────────────────────────────────────────────────────────

export type ReferenceTilesetMode = "same" | "extended" | "installed" | "copied";
export interface ReferenceTilesetInstall {
  readonly tilesetId: string;
  readonly mode: ReferenceTilesetMode;
  readonly tilesAdded: number;
  readonly graftsAdded: number;
  readonly conflict?: string;
}

const graftKey = (graft: TileGraft) => `${graft.sourceChipset}:${graft.sourceTile}`;
const sameImage = (a: TilesetDef, b: TilesetDef) => a.image.type === b.image.type && a.image.id === b.image.id
  && a.tileSize === b.tileSize && a.tilesPerRow === b.tilesPerRow;

/** Cells the image itself paints; slots past it are blank until a graft fills them. */
function imageFrames(tileset: TilesetDef): number {
  return tileset.image.type === "bundled" ? bundledChipsetFrameCount(tileset.image.id) : tileset.count;
}

/** What slot `tile` shows: a graft, the sheet's own cell, blank, or nothing (past the tileset's end). */
function slotPicture(tileset: TilesetDef, grafts: ReadonlyMap<number, TileGraft>, tile: number): string {
  if (tile >= tileset.count) return "absent";
  const graft = grafts.get(tile);
  if (graft) return `graft:${graftKey(graft)}`;
  return tile < imageFrames(tileset) ? "base" : "blank";
}

/** Every tile number the map paints on any layer. */
export function sceneTilesUsed(map: GameMap): Set<number> {
  const used = new Set<number>();
  const extras = map as GameMap & ExtraLayerFields;
  for (const layer of [map.lowerTiles, map.upperTiles, extras.lowerOverlayTiles, extras.upperOverlayTiles]) {
    for (const tile of layer ?? []) if (tile >= 0) used.add(tile);
  }
  return used;
}

type SlotPlan = { conflict?: string; fill: number[] };

/**
 * Plan how the scene's tile numbers land on `project`. Only tiles the scene map uses must agree; a slot the project
 * leaves blank (past its sheet, no graft) may take the scene's graft, and slots past the project's end are appended.
 */
function planSlots(project: TilesetDef, scene: TilesetDef, used: ReadonlySet<number>): SlotPlan {
  if (!sameImage(project, scene)) return { conflict: `그림이 다르다(${project.image.id} ≠ ${scene.image.id})`, fill: [] };
  const own = new Map((project.tileGrafts ?? []).map(graft => [graft.targetTile, graft]));
  const theirs = new Map((scene.tileGrafts ?? []).map(graft => [graft.targetTile, graft]));
  const fill: number[] = [];
  for (const tile of used) {
    const mine = slotPicture(project, own, tile), wanted = slotPicture(scene, theirs, tile);
    if (mine === wanted || mine === "absent") continue;
    if (mine === "blank" && wanted.startsWith("graft:")) { fill.push(tile); continue; }
    return { conflict: `${tile}번 칸에 다른 그림이 있다`, fill: [] };
  }
  return { fill };
}

function copySlot(target: TilesetDef, scene: TilesetDef, tile: number): void {
  target.passability[tile] = structuredClone(scene.passability[tile] ?? { up: true, down: true, left: true, right: true });
  target.priority[tile] = scene.priority[tile] ?? "lower";
  target.terrain[tile] = scene.terrain[tile] ?? 0;
  (target.tileMeta ??= [])[tile] = structuredClone(scene.tileMeta?.[tile] ?? { label: "", description: "" });
}

function appendMissingById<T extends { id: string }>(target: T[] | undefined, source: readonly T[] | undefined): T[] | undefined {
  if (!source?.length) return target;
  const ids = new Set((target ?? []).map(entry => entry.id));
  const missing = source.filter(entry => !ids.has(entry.id));
  return missing.length ? [...(target ?? []), ...structuredClone(missing)] : target;
}

/** Grow `target` to the scene's end and fill the planned blank slots. Caller ran planSlots without a conflict. */
function extendTileset(target: TilesetDef, scene: TilesetDef, plan: SlotPlan): { tilesAdded: number; graftsAdded: number } {
  const start = target.count;
  const end = Math.max(target.count, scene.count);
  for (let tile = start; tile < end; tile += 1) copySlot(target, scene, tile);
  target.count = end;
  for (const tile of plan.fill) copySlot(target, scene, tile);
  const own = new Set((target.tileGrafts ?? []).map(graft => graft.targetTile));
  const fill = new Set(plan.fill);
  const added = (scene.tileGrafts ?? []).filter(graft => !own.has(graft.targetTile) && (graft.targetTile >= start || fill.has(graft.targetTile)));
  if (added.length) target.tileGrafts = [...(target.tileGrafts ?? []), ...structuredClone(added)];
  target.tileGroups = appendMissingById(target.tileGroups, scene.tileGroups);
  target.autotileGroups = appendMissingById(target.autotileGroups, scene.autotileGroups);
  target.structureKits = appendMissingById(target.structureKits, scene.structureKits);
  // A tileset that shares another's documents (referenceSourceTilesetId) may not also own some.
  if (!target.referenceSourceTilesetId) target.referenceDocuments = appendMissingById(target.referenceDocuments, scene.referenceDocuments);
  return { tilesAdded: end - start + plan.fill.length, graftsAdded: added.length };
}

function completeTileset(scene: TilesetDef): TilesetDef {
  const copy = structuredClone(scene);
  // Trimmed snapshot tilesets carry no labels; tools expect one entry per tile.
  if (!copy.tileMeta) copy.tileMeta = Array.from({ length: copy.count }, () => ({ label: "", description: "" }));
  return copy;
}

function installAssets(project: Project, assets: RegionReferenceScene["assets"]): void {
  for (const [assetId, asset] of Object.entries(assets)) {
    if (!project.assets.uploaded[assetId]) project.assets.uploaded[assetId] = structuredClone(asset);
  }
}

/**
 * Make `scene.tileset` usable in the project and return the id maps should use. Existing tilesets are only grown at
 * their end; a tileset whose slots already show other pictures is left alone and a copy is installed beside it.
 */
export function installReferenceTileset(project: Project, scene: Pick<RegionReferenceScene, "tileset" | "assets" | "referenceId" | "map">): ReferenceTilesetInstall {
  const source = scene.tileset;
  installAssets(project, scene.assets);
  const used = sceneTilesUsed(scene.map);
  // Documented sheets (oprn_dungeon_*) are built the same way create_map builds them, sharing the stock documents.
  const built = !project.tilesets[source.id] && ensureDocumentedTileset(project, source.id);
  const existing = project.tilesets[source.id];
  if (!existing) {
    project.tilesets[source.id] = completeTileset(source);
    return { tilesetId: source.id, mode: "installed", tilesAdded: source.count, graftsAdded: (source.tileGrafts ?? []).length };
  }
  const plan = planSlots(existing, source, used);
  const conflict = plan.conflict;
  if (!conflict) {
    const grown = extendTileset(existing, source, plan);
    if (built) return { tilesetId: source.id, mode: "installed", tilesAdded: existing.count, graftsAdded: (existing.tileGrafts ?? []).length };
    return { tilesetId: source.id, mode: grown.tilesAdded || grown.graftsAdded ? "extended" : "same", ...grown };
  }
  // A copy made by an earlier import of the same reference is reused when it still matches.
  const copyId = `${source.id}__${scene.referenceId.replace(/[^a-z0-9]+/gi, "_")}`;
  const previous = project.tilesets[copyId];
  const again = previous ? planSlots(previous, source, used) : undefined;
  if (previous && again && !again.conflict) {
    const grown = extendTileset(previous, source, again);
    return { tilesetId: copyId, mode: "copied", ...grown, conflict };
  }
  project.tilesets[copyId] = { ...completeTileset(source), id: copyId as TilesetId, name: `${source.name} · ${scene.referenceId}` };
  return { tilesetId: copyId, mode: "copied", tilesAdded: source.count, graftsAdded: (source.tileGrafts ?? []).length, conflict };
}

// ── 맵으로 옮기기 ────────────────────────────────────────────────────────────

export interface ReferenceImportTarget {
  /** Paste into this existing map (its tileset must be the installed one). Omit for a new map. */
  readonly mapId?: string;
  readonly x?: number;
  readonly y?: number;
  /** New map id/name (new-map mode only). */
  readonly newMapId?: string;
  readonly name?: string;
  /** Copy the reference's events too (new-map mode only; transfers into maps this project lacks are dropped). */
  readonly includeEvents?: boolean;
}

export interface ReferenceImportResult {
  readonly mapId: string;
  readonly created: boolean;
  readonly rect: { x: number; y: number; width: number; height: number };
  readonly clipped: boolean;
  readonly tileset: ReferenceTilesetInstall;
  readonly eventsCopied: number;
  readonly eventsSkipped: number;
  readonly extraLayers: string[];
}

function freshMapId(project: Project, base: string): string {
  let id = base, suffix = 2;
  while (project.maps[id]) id = `${base}_${suffix++}`;
  return id;
}

function referencesMissingMap(event: GameEvent, project: Project, allowed: ReadonlySet<string>): boolean {
  const ids = JSON.stringify(event).match(/"mapId":"([^"]+)"/g) ?? [];
  return ids.some(raw => {
    const mapId = raw.slice(9, -1);
    return !allowed.has(mapId) && !project.maps[mapId];
  });
}

function appendToMapTree(project: Project, mapId: string): void {
  if (!project.maps[project.mapTree.mapId]) project.mapTree = { mapId: mapId as MapId, children: [] };
  else if (project.mapTree.mapId !== mapId && !project.mapTree.children.some(child => child.mapId === mapId)) {
    project.mapTree.children.push({ mapId: mapId as MapId, children: [] });
  }
}

/** Install the tileset, then create a map from the scene or paste it into `target.mapId` at (x, y). */
export function importReferenceScene(project: Project, scene: RegionReferenceScene, target: ReferenceImportTarget = {}): ReferenceImportResult {
  const source = scene.map;
  if (target.mapId === undefined && source.worldmapSource) {
    const mapId = target.newMapId ?? freshMapId(project, `map_ref_${scene.referenceId.replace(/[^a-z0-9]+/gi, "_")}`);
    if (project.maps[mapId]) throw new Error(`이미 있는 맵 id 입니다: ${mapId}`);
    const tilesetId = `worldmap_${mapId}`;
    if (project.tilesets[tilesetId]) throw new Error(`전용 월드맵 타일셋이 이미 있습니다: ${tilesetId} — 다른 newMapId를 사용하세요.`);
    scene = { ...scene, tileset: { ...structuredClone(scene.tileset), id: tilesetId } };
    target = { ...target, newMapId: mapId };
  }
  const tileset = installReferenceTileset(project, scene);
  const sourceExtras = source as GameMap & ExtraLayerFields;
  const extraLayers = EXTRA_LAYER_KEYS.filter(key => Array.isArray(sourceExtras[key]));
  if (target.mapId === undefined) {
    const mapId = target.newMapId ?? freshMapId(project, `map_ref_${scene.referenceId.replace(/[^a-z0-9]+/gi, "_")}`);
    if (project.maps[mapId]) throw new Error(`이미 있는 맵 id 입니다: ${mapId}`);
    const events = target.includeEvents ? source.events ?? [] : [];
    const kept = events.filter(event => !referencesMissingMap(event, project, new Set([source.id])))
      .map(event => JSON.parse(JSON.stringify(event).replaceAll(`"mapId":"${source.id}"`, `"mapId":"${mapId}"`)) as GameEvent);
    const map: GameMap = {
      id: mapId as MapId,
      name: target.name ?? scene.name,
      width: source.width,
      height: source.height,
      tilesetId: tileset.tilesetId as TilesetId,
      tileSize: project.tilesets[tileset.tilesetId]!.tileSize,
      lowerTiles: [...source.lowerTiles],
      upperTiles: [...source.upperTiles],
      events: kept,
    };
    const extras = map as GameMap & ExtraLayerFields;
    for (const key of extraLayers) (extras as unknown as Record<string, unknown>)[key] = structuredClone(sourceExtras[key]);
    // A whole world map remains editable with its original geography and character size.
    if (source.worldmapSource) map.worldmapSource = structuredClone(source.worldmapSource);
    if (source.characterScale !== undefined) map.characterScale = source.characterScale;
    if (source.locations) map.locations = structuredClone(source.locations);
    project.maps[mapId] = map;
    appendToMapTree(project, mapId);
    if (!project.maps[project.startMapId]) {
      project.startMapId = mapId as MapId;
      project.startPos = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
    }
    return { mapId, created: true, rect: { x: 0, y: 0, width: map.width, height: map.height }, clipped: false, tileset,
      eventsCopied: kept.length, eventsSkipped: (source.events ?? []).length - kept.length, extraLayers };
  }
  const map = project.maps[target.mapId];
  if (!map) throw new Error(`맵을 찾을 수 없습니다: ${target.mapId}`);
  if (map.tilesetId !== tileset.tilesetId) {
    throw new Error(`맵 ${map.id} 의 타일셋(${map.tilesetId})이 장소의 타일셋(${tileset.tilesetId})과 달라 칸 번호가 다른 그림이 됩니다 — mapId 를 빼고 새 맵으로 가져오거나, ${tileset.tilesetId} 맵에 붙이세요.`);
  }
  const x0 = target.x ?? 0, y0 = target.y ?? 0;
  if (x0 >= map.width || y0 >= map.height || x0 + source.width <= 0 || y0 + source.height <= 0) {
    throw new Error(`(${x0},${y0}) 에 ${source.width}×${source.height} 를 놓으면 맵 ${map.width}×${map.height} 과 겹치지 않습니다.`);
  }
  const mapExtras = map as GameMap & ExtraLayerFields;
  for (const key of extraLayers) {
    const layer = mapExtras[key] as unknown[] | undefined;
    if (!layer) (mapExtras as unknown as Record<string, unknown>)[key] = new Array(map.width * map.height).fill(key === "shadowBits" ? 0 : -1);
  }
  let clipped = false;
  for (let sy = 0; sy < source.height; sy += 1) {
    for (let sx = 0; sx < source.width; sx += 1) {
      const tx = x0 + sx, ty = y0 + sy;
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) { clipped = true; continue; }
      const from = sy * source.width + sx, to = ty * map.width + tx;
      map.lowerTiles[to] = source.lowerTiles[from] ?? -1;
      map.upperTiles[to] = source.upperTiles[from] ?? -1;
      for (const key of extraLayers) {
        (mapExtras[key] as unknown as number[])[to] = (sourceExtras[key] as unknown as number[])[from] ?? (key === "shadowBits" ? 0 : -1);
      }
    }
  }
  const x = Math.max(0, x0), y = Math.max(0, y0);
  const rect = { x, y, width: Math.min(map.width, x0 + source.width) - x, height: Math.min(map.height, y0 + source.height) - y };
  return { mapId: map.id, created: false, rect, clipped, tileset, eventsCopied: 0, eventsSkipped: (source.events ?? []).length, extraLayers };
}
