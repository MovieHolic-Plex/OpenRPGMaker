// 오브젝트(킷·타일 그룹 도안·장소 조각)를 맵에 찍는다 — 조수 도구 stamp_object 의 핵심.
//
// 오브젝트는 원래 타일셋의 칸 번호로 적혀 있다. 대상 맵의 타일셋이 그 칸에서 같은 그림을 보이면 번호를 그대로 쓰고,
// 아니면 그 그림(시트 칸 또는 이식 원본)을 대상 타일셋 뒤에 이식(tileGrafts)으로 붙여 새 번호로 옮긴다. 같은 그림이
// 이미 이식돼 있으면 그 칸을 다시 쓴다. 그래서 생성 건물(fft-*)·성채 항구 나룻배 같은 장소 안 킷도 숲마을 맵에 찍힌다.
import { bundledChipsetFrameCount } from "@/assets/bundled";
import type { GameMap, Project, TileGraft, TilesetDef } from "./types";

export interface StampPattern {
  readonly width: number;
  readonly height: number;
  /** Row-major; -1 leaves the map cell as it is. */
  readonly lower: readonly number[];
  readonly upper: readonly number[];
}

export interface StampResult {
  readonly rect: { x: number; y: number; width: number; height: number };
  readonly clipped: boolean;
  readonly cells: number;
  readonly slotsAdded: number;
  readonly remapped: number;
  /** 이미 다른 위층 그림(나무 수관·지붕 등)이 있던 칸을 덮어쓴 칸들. 소품이 수관 위에 얹히는 실수를 알린다. */
  readonly coveredUpper: readonly { x: number; y: number }[];
}

type Picture = { chip: string; tile: number; tileSize?: number; tilesPerRow?: number } | null;

function frames(tileset: TilesetDef): number {
  return tileset.image.type === "bundled" ? bundledChipsetFrameCount(tileset.image.id) : tileset.count;
}

/** The picture slot `tile` shows as a graftable (sheet, cell) pair; null for blank or out of range. */
function pictureOf(tileset: TilesetDef, grafts: ReadonlyMap<number, TileGraft>, tile: number): Picture {
  if (tile < 0 || tile >= tileset.count) return null;
  const graft = grafts.get(tile);
  if (graft) return { chip: graft.sourceChipset, tile: graft.sourceTile,
    ...(graft.sourceTileSize ? { tileSize: graft.sourceTileSize } : {}), ...(graft.sourceTilesPerRow ? { tilesPerRow: graft.sourceTilesPerRow } : {}) };
  if (tile >= frames(tileset)) return null;
  // 업로드 그림판은 칸 배치를 키로 알 수 없다 — 이식이 그 타일셋의 칸 크기·줄 칸 수를 들고 간다.
  return tileset.image.type === "uploaded"
    ? { chip: tileset.image.id, tile, tileSize: tileset.tileSize, tilesPerRow: tileset.tilesPerRow }
    : { chip: tileset.image.id, tile };
}

const graftMap = (tileset: TilesetDef) => new Map((tileset.tileGrafts ?? []).map(graft => [graft.targetTile, graft]));

/**
 * Map every source tile to a target tile showing the same picture, appending grafts to `target` where needed.
 * Uploaded source sheets must already be in project.assets (the caller installs them).
 */
export function translateTiles(source: TilesetDef, target: TilesetDef, tiles: Iterable<number>): { map: Map<number, number>; slotsAdded: number } {
  if (source.tileSize !== target.tileSize) throw new Error(`칸 크기가 다르다(${source.tileSize}px → ${target.tileSize}px) — 같은 칸 크기의 맵에 찍으세요`);
  const sourceGrafts = graftMap(source);
  const targetGrafts = graftMap(target);
  const byPicture = new Map<string, number>();
  for (const [tile, graft] of targetGrafts) byPicture.set(`${graft.sourceChipset}:${graft.sourceTile}`, tile);
  const result = new Map<number, number>();
  let slotsAdded = 0;
  for (const tile of new Set(tiles)) {
    if (tile < 0) continue;
    const picture = pictureOf(source, sourceGrafts, tile);
    if (!picture) { result.set(tile, -1); continue; }
    // Same number, same picture (the common case: stamping a kit onto its own tileset).
    const own = pictureOf(target, targetGrafts, tile);
    if (own && own.chip === picture.chip && own.tile === picture.tile) { result.set(tile, tile); continue; }
    // The target's own sheet cell.
    if (target.image.id === picture.chip && picture.tile < frames(target) && !targetGrafts.has(picture.tile)) { result.set(tile, picture.tile); continue; }
    const key = `${picture.chip}:${picture.tile}`;
    const reused = byPicture.get(key);
    if (reused !== undefined) { result.set(tile, reused); continue; }
    const slot = target.count;
    target.count += 1;
    target.passability[slot] = structuredClone(source.passability[tile] ?? { up: true, down: true, left: true, right: true });
    target.priority[slot] = source.priority[tile] ?? "lower";
    target.terrain[slot] = source.terrain[tile] ?? 0;
    (target.tileMeta ??= [])[slot] = structuredClone(source.tileMeta?.[tile] ?? { label: "", description: "" });
    const graft: TileGraft = { targetTile: slot, sourceChipset: picture.chip, sourceTile: picture.tile,
      ...(picture.tileSize ? { sourceTileSize: picture.tileSize } : {}), ...(picture.tilesPerRow ? { sourceTilesPerRow: picture.tilesPerRow } : {}) };
    target.tileGrafts = [...(target.tileGrafts ?? []), graft];
    targetGrafts.set(slot, graft);
    byPicture.set(key, slot);
    result.set(tile, slot);
    slotsAdded += 1;
  }
  // Grafted rows are baked a row at a time; keep the tileset a whole number of rows.
  if (slotsAdded > 0) {
    const aligned = Math.ceil(target.count / target.tilesPerRow) * target.tilesPerRow;
    for (let slot = target.count; slot < aligned; slot += 1) {
      target.passability[slot] = { up: true, down: true, left: true, right: true };
      target.priority[slot] = "lower";
      target.terrain[slot] = 0;
      (target.tileMeta ??= [])[slot] = { label: "", description: "" };
    }
    target.count = aligned;
  }
  return { map: result, slotsAdded };
}

/** Copy uploaded sheets a stamp draws from into the project (never overwriting an existing asset id). */
export function installStampAssets(project: Project, assets: Project["assets"]["uploaded"]): void {
  for (const [assetId, asset] of Object.entries(assets)) {
    if (!project.assets.uploaded[assetId]) project.assets.uploaded[assetId] = structuredClone(asset);
  }
}

/** Stamp `pattern` (numbers of `source`) onto `map` at (x, y). The map's tileset may grow grafts. */
export function stampPattern(project: Project, map: GameMap, source: TilesetDef, pattern: StampPattern, x: number, y: number): StampResult {
  const target = project.tilesets[map.tilesetId];
  if (!target) throw new Error(`맵 ${map.id} 의 타일셋 ${map.tilesetId} 이 없습니다`);
  if (x >= map.width || y >= map.height || x + pattern.width <= 0 || y + pattern.height <= 0) {
    throw new Error(`(${x},${y}) 에 ${pattern.width}×${pattern.height} 를 놓으면 맵 ${map.width}×${map.height} 과 겹치지 않습니다`);
  }
  const translated = translateTiles(source, target, [...pattern.lower, ...pattern.upper]);
  let clipped = false, cells = 0;
  const coveredUpper: { x: number; y: number }[] = [];
  for (let py = 0; py < pattern.height; py += 1) {
    for (let px = 0; px < pattern.width; px += 1) {
      const tx = x + px, ty = y + py;
      const from = py * pattern.width + px;
      const lower = pattern.lower[from] ?? -1, upper = pattern.upper[from] ?? -1;
      if (lower < 0 && upper < 0) continue;
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) { clipped = true; continue; }
      const to = ty * map.width + tx;
      if (lower >= 0) map.lowerTiles[to] = translated.map.get(lower) ?? lower;
      if (upper >= 0) {
        const next = translated.map.get(upper) ?? upper;
        const before = map.upperTiles[to] ?? -1;
        if (before >= 0 && before !== next) coveredUpper.push({ x: tx, y: ty });
        map.upperTiles[to] = next;
      }
      cells += 1;
    }
  }
  const remapped = [...translated.map].filter(([from, to]) => from !== to && to >= 0).length;
  const rx = Math.max(0, x), ry = Math.max(0, y);
  return { rect: { x: rx, y: ry, width: Math.min(map.width, x + pattern.width) - rx, height: Math.min(map.height, y + pattern.height) - ry },
    clipped, cells, slotsAdded: translated.slotsAdded, remapped, coveredUpper };
}
