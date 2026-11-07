import { createBlankProject } from "../../src/project/defaults/defaultProject";
import { BUNDLED_EASYRPG_CHIPSET_ASSETS } from "../../src/assets/bundled";
import { autotileGroupsForTileset } from "../../src/project/defaults/autotileGroups";
import { autotileGroupLayer, shapeAutotileGroupAround, autotileVariantForMask, autotileNeighborMask } from "../../src/project/defaults/autotileEngine";
import { drawMapTileLayer } from "../../src/editor/mapTileDrawCore";
import { supportsChipsetQuarterComposition } from "../../src/editor/chipsetComposition";
import { chipsetQuarterComposition } from "../../src/project/defaults/terrainQuarterAutotile";
import { isLakeAutotileTile } from "../../src/project/defaults/lakeAutotile";
import { CanvasContext2D, createCanvas, decodePng, encodePng, tileAlphaCoverage, type RasterImage } from "./canvasShim";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { GameMap, TilesetDef, AutotileGroup } from "../../src/project/types";

const MAP = 24;
const SHAPE_ORIGIN = { x: 9, y: 9 };
const SCALE = 3;
const SHAPE_BOX = 5;

type ShapeName =
  | "isolated" | "stripH" | "stripV" | "block3" | "ring"
  | "bendL" | "tee" | "plus" | "innerCorner" | "block2";

interface ShapeSpec { readonly name: ShapeName; readonly cells: readonly { x: number; y: number }[]; readonly probe: readonly { x: number; y: number }[] }

function box(w: number, h: number, skip: readonly [number, number][] = []): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    if (skip.some(([sx, sy]) => sx === x && sy === y)) continue;
    out.push({ x, y });
  }
  return out;
}

const SHAPES: readonly ShapeSpec[] = [
  { name: "isolated", cells: [{ x: 2, y: 2 }], probe: [{ x: 2, y: 2 }] },
  { name: "stripH", cells: [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }], probe: [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 4, y: 2 }] },
  { name: "stripV", cells: [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }], probe: [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 3 }] },
  { name: "block3", cells: box(3, 3), probe: box(3, 3) },
  { name: "ring", cells: box(3, 3, [[1, 1]]), probe: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }] },
  { name: "bendL", cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }], probe: [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }] },
  { name: "tee", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }], probe: [{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 2 }] },
  { name: "plus", cells: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }], probe: [{ x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }] },
  { name: "innerCorner", cells: box(3, 3, [[0, 0]]), probe: [{ x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }] },
  { name: "block2", cells: box(2, 2), probe: box(2, 2) },
];

const NINE = [0b0000, 0b0001, 0b0010, 0b0100, 0b1000, 0b1110, 0b1101, 0b1011, 0b0111, 0b1111];

interface GroupReport {
  readonly tilesetId: string;
  readonly textureKey: string;
  readonly atlasPath: string | null;
  readonly groupId: string;
  readonly groupName: string;
  readonly layer: string;
  readonly neighborhood: number;
  readonly members: number;
  readonly roles: Record<string, number>;
  readonly distinctRoles: number;
  readonly distinctAcrossShapes: number;
  readonly innerVariantPresent: boolean;
  readonly innerCornerReached: string;
  readonly design: string[];
  readonly distinctValues: number;
  readonly failures: string[];
  readonly warnings: string[];
  readonly shapeTiles: Record<string, number[]>;
  readonly probeMasks: Record<string, number>;
  readonly png: string | null;
}

interface TilesetReport {
  readonly id: string;
  readonly textureKey: string;
  readonly atlasPath: string | null;
  readonly tileSize: number;
  readonly tilesPerRow: number;
  readonly count: number;
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  readonly atlasCapacity: number;
  readonly graftedBeyondAtlas: number;
  readonly groups: number;
  readonly tilesetsRows: string[];
}

const argv = process.argv.slice(2).filter((a) => a !== "--");
const outDir = argv[1] ?? "/tmp/autotile-audit";
const pngDir = join(outDir, "png");
mkdirSync(pngDir, { recursive: true });

const project = createBlankProject();
const texturePaths = new Map(BUNDLED_EASYRPG_CHIPSET_ASSETS.map((a) => [a.textureKey, a.path]));
const atlases = new Map<string, RasterImage | null>();

function atlasFor(path: string | null): RasterImage | null {
  if (!path) return null;
  if (atlases.has(path)) return atlases.get(path) ?? null;
  const abs = join(process.cwd(), "public", path);
  const image = existsSync(abs) ? decodePng(readFileSync(abs)) : null;
  atlases.set(path, image);
  return image;
}

function mapFrom(base: number, body: number, cells: readonly { x: number; y: number }[], layer: string): GameMap {
  const lowerTiles = new Array<number>(MAP * MAP).fill(layer === "upper" ? -1 : base);
  const upperTiles = new Array<number>(MAP * MAP).fill(layer === "upper" ? base : -1);
  const target = layer === "upper" ? upperTiles : lowerTiles;
  for (const cell of cells) target[(SHAPE_ORIGIN.y + cell.y) * MAP + SHAPE_ORIGIN.x + cell.x] = body;
  return {
    id: "audit",
    name: "audit",
    tilesetId: "",
    width: MAP,
    height: MAP,
    lowerTiles,
    upperTiles,
    events: [],
  } as unknown as GameMap;
}

function paintShape(tileset: TilesetDef, group: AutotileGroup, base: number, body: number, shape: ShapeSpec): GameMap {
  const layer = autotileGroupLayer(group);
  const map = mapFrom(base, body, shape.cells, layer);
  const view = layer === "upper" ? { width: MAP, height: MAP, lowerTiles: map.upperTiles } : map;
  const points = shape.cells.map((c) => ({ x: SHAPE_ORIGIN.x + c.x, y: SHAPE_ORIGIN.y + c.y }));
  shapeAutotileGroupAround(view, group, points);
  return map;
}

function probeTiles(map: GameMap, layer: string, shape: ShapeSpec): number[] {
  const tiles = layer === "upper" ? map.upperTiles : map.lowerTiles;
  return shape.probe.map((p) => tiles[(SHAPE_ORIGIN.y + p.y) * MAP + SHAPE_ORIGIN.x + p.x] ?? -9999);
}

function probeMasks(map: GameMap, layer: string, group: AutotileGroup, shape: ShapeSpec): Record<string, number> {
  const view = { width: MAP, height: MAP, lowerTiles: layer === "upper" ? map.upperTiles : map.lowerTiles };
  const connect = new Set(group.connectTileIds ?? group.memberTileIds);
  const out: Record<string, number> = {};
  for (const p of shape.probe) {
    const x = SHAPE_ORIGIN.x + p.x;
    const y = SHAPE_ORIGIN.y + p.y;
    out[`${p.x},${p.y}`] = autotileNeighborMask(view, x, y, (t) => connect.has(t), group.neighborhood ?? 4, group.edgeConnects === true || group.outsideConnects === true);
  }
  return out;
}

function pickBaseTile(tileset: TilesetDef, group: AutotileGroup, atlas: RasterImage | null): number {
  const memoKey = `${tileset.id}::${group.id}`;
  const cached = baseTileCache.get(memoKey);
  if (cached !== undefined) return cached;
  const connect = new Set(group.connectTileIds ?? group.memberTileIds);
  let found = -1;
  for (let tile = 0; tile < tileset.count; tile += 1) {
    if (connect.has(tile)) continue;
    if (!atlas) { found = tile; break; }
    if (tileAlphaCoverage(atlas, tile, tileset.tilesPerRow, tileset.tileSize) > 0.9) { found = tile; break; }
  }
  baseTileCache.set(memoKey, found);
  return found;
}

const baseTileCache = new Map<string, number>();

function groundTileFor(tileset: TilesetDef, group: AutotileGroup, atlas: RasterImage): number {
  const candidates = tileset.tileGroups?.find((g) => /ground|terrain|floor|바닥|지면|잔디/i.test(`${g.id} ${g.name}`))?.tileIds ?? [];
  const connect = new Set(group.connectTileIds ?? group.memberTileIds);
  for (const tile of candidates) {
    if (tile < 0 || tile >= tileset.count || connect.has(tile)) continue;
    if (tileAlphaCoverage(atlas, tile, tileset.tilesPerRow, tileset.tileSize) > 0.9) return tile;
  }
  return pickBaseTile(tileset, group, atlas);
}

function renderSheet(tileset: TilesetDef, group: AutotileGroup, base: number, body: number, atlas: RasterImage, path: string, groundTile: number): void {
  const cols = 5;
  const rows = Math.ceil(SHAPES.length / cols);
  const cell = SHAPE_BOX * tileset.tileSize * SCALE;
  const canvas = createCanvas(cols * cell, rows * cell);
  const ctx = new CanvasContext2D(canvas);
  const layer = autotileGroupLayer(group);
  SHAPES.forEach((shape, index) => {
    const map = paintShape(tileset, group, base, body, shape);
    if (layer === "upper") map.lowerTiles.fill(groundTile);
    const full = createCanvas(MAP * tileset.tileSize * SCALE, MAP * tileset.tileSize * SCALE);
    const fullCtx = new CanvasContext2D(full);
    // 편집기·시작 화면 캔버스와 같은 렌더 함수 — 쿼터 합성·호수 쿼터·받침까지 실제 경로를 탄다.
    drawMapTileLayer(fullCtx as unknown as CanvasRenderingContext2D, atlas as unknown as HTMLCanvasElement, map, tileset, "lower", SCALE);
    drawMapTileLayer(fullCtx as unknown as CanvasRenderingContext2D, atlas as unknown as HTMLCanvasElement, map, tileset, "upper", SCALE);
    const span = tileset.tileSize * SCALE;
    const ox = (index % cols) * cell;
    const oy = Math.floor(index / cols) * cell;
    ctx.drawImage(full, SHAPE_ORIGIN.x * span, SHAPE_ORIGIN.y * span, SHAPE_BOX * span, SHAPE_BOX * span, ox, oy, SHAPE_BOX * span, SHAPE_BOX * span);
  });
  writeFileSync(path, encodePng(canvas));
}

function auditGroup(tileset: TilesetDef, group: AutotileGroup): GroupReport {
  const textureKey = tileset.image.type === "bundled" ? tileset.image.id : `uploaded:${tileset.image.id}`;
  const atlasPath = texturePaths.get(textureKey) ?? null;
  const atlas = atlasFor(atlasPath);
  const failures: string[] = [];
  const warnings: string[] = [];
  const nb = group.neighborhood ?? 4;
  const layer = autotileGroupLayer(group);
  const body = group.variantMap[String(nb === 8 ? 255 : 15)] ?? group.memberTileIds[0]!;

  const roles: Record<string, number> = {};
  for (const mask of NINE) {
    const value = autotileVariantForMask(group, mask);
    roles[String(mask)] = value ?? -1;
  }
  const distinctRoles = new Set(Object.values(roles).filter((v) => v >= 0)).size;

  const shapeTiles: Record<string, number[]> = {};
  const probeMasksOut: Record<string, number> = {};
  const all = new Set<number>();
  for (const shape of SHAPES) {
    const map = paintShape(tileset, group, pickBaseTile(tileset, group, atlas), body, shape);
    const tiles = probeTiles(map, layer, shape);
    shapeTiles[shape.name] = tiles;
    for (const tile of tiles) all.add(tile);
    const masks = probeMasks(map, layer, group, shape);
    for (const [key, value] of Object.entries(masks)) probeMasksOut[`${shape.name}:${key}`] = value;
  }

  const grafted = new Set((tileset.tileGrafts ?? []).map((g) => g.targetTile));
  for (const [tileKey, tiles] of Object.entries({ ...shapeTiles, ...Object.fromEntries(NINE.map((m) => [`role_${m}`, [roles[String(m)] ?? -1]])) })) {
    for (const tile of tiles) {
      if (grafted.has(tile)) continue;
      if (tile < 0 || tile >= tileset.count) failures.push(`out-of-range:${tileKey}=${tile} (count ${tileset.count})`);
      else if (atlas) {
        const coverage = tileAlphaCoverage(atlas, tile, tileset.tilesPerRow, tileset.tileSize);
        if (coverage === 0 && layer !== "upper") failures.push(`transparent:${tileKey}=${tile} (alpha 0)`);
      }
    }
  }

  // 내부(오목) 모서리 마스크 = 상하좌우 모두 이어지고 대각 하나만 빠진 칸(255 - NE/SE/SW/NW).
  const fullMask = nb === 8 ? 255 : 15;
  const fullTile = group.variantMap[String(fullMask)];
  const innerMasks = [255 - 16, 255 - 32, 255 - 64, 255 - 128];
  const innerTiles = nb === 8 ? innerMasks.map((m) => autotileVariantForMask(group, m)) : [];
  const innerVariantPresent = innerTiles.some((t) => typeof t === "number" && t !== fullTile);
  const distinctValues = new Set(Object.values(group.variantMap)).size;
  const composer = !!group.composer;
  const phase = !!group.phaseVariants;
  const docNoEdges = group.memberTileIds.some((t) => /가장자리를 그리지 않는다|no edges/i.test(tileset.tileMeta?.[t]?.description ?? ""));
  const darkWall = /dark-wall|dark_wall/.test(group.id);
  const design: string[] = [];
  if (composer) design.push("composer(나무 조립기가 2~4층을 그린다)");
  if (docNoEdges) design.push("문서화된 평면 채움(가장자리를 그리지 않는다)");
  if (darkWall) design.push("366 저장 계약(쏘더 시점 쿼터 합성)");
  const quarterRendered = supportsChipsetQuarterComposition(tileset) && SHAPES.some((shape) => {
    const map = paintShape(tileset, group, pickBaseTile(tileset, group, atlas), body, shape);
    return shape.probe.some((p) => {
      const x = SHAPE_ORIGIN.x + p.x, y = SHAPE_ORIGIN.y + p.y;
      const tile = map.lowerTiles[y * MAP + x]!;
      return isLakeAutotileTile(tile, tileset) || chipsetQuarterComposition(map, tileset, x, y) !== null;
    });
  });
  if (quarterRendered) design.push("쿼터 합성 렌더(저장 칸 수보다 그려지는 모양이 많다)");
  const byDesignFlat = composer || docNoEdges || darkWall;
  const innerCornerShape = shapeTiles["innerCorner"] ?? [];
  const innerProbe = innerCornerShape[0];
  let innerCornerReached = "n/a";
  if (nb === 8 && !byDesignFlat) {
    if (innerProbe === undefined) innerCornerReached = "missing";
    else if (!innerVariantPresent) innerCornerReached = "no-inner-art(16모양)";
    else if (innerProbe === fullTile) innerCornerReached = "no (엔진이 몸통을 썼다)";
    else innerCornerReached = "yes";
    if (innerCornerReached.startsWith("no (")) failures.push("inner-corner-unreachable");
    if (innerCornerReached.startsWith("no-inner-art")) warnings.push("no-inner-corner-art: 8방 선언이지만 대각을 보지 않는 16모양 그림");
  }

  if (all.size <= 1) {
    if (byDesignFlat) warnings.push(`intentional-single-tile: ${design.join(", ")}`);
    else failures.push(`no-op-dead: ${all.size} distinct tile(s) across ${SHAPES.length} shapes`);
  }
  const expectedRoles = Math.min(nb === 8 ? 9 : 5, distinctValues);
  if (!byDesignFlat && !quarterRendered && distinctValues > 1 && distinctRoles < expectedRoles) failures.push(`scrambled-roles:${distinctRoles} distinct of expected ${expectedRoles}`);
  if (phase) warnings.push("phaseVariants(칸 위치로 2×2 몸통 선택) — 붓은 x,y 를 넘긴다");

  const pngName = `${tileset.id}__${group.id}`.replace(/[^a-zA-Z0-9_.-]/g, "_");
  let png: string | null = null;
  if (atlas) {
    png = `png/${pngName}.png`;
    renderSheet(tileset, group, pickBaseTile(tileset, group, atlas), body, atlas, join(pngDir, `${pngName}.png`), groundTileFor(tileset, group, atlas));
  } else {
    failures.push("no-atlas");
  }

  return {
    tilesetId: tileset.id,
    textureKey,
    atlasPath,
    groupId: group.id,
    groupName: group.name,
    layer,
    neighborhood: nb,
    members: group.memberTileIds.length,
    roles,
    distinctRoles,
    distinctAcrossShapes: all.size,
    innerVariantPresent,
    innerCornerReached,
    design,
    distinctValues,
    failures,
    warnings,
    shapeTiles,
    probeMasks: probeMasksOut,
    png,
  };
}

const tilesetReports: TilesetReport[] = [];
const groupReports: GroupReport[] = [];

for (const [id, tileset] of Object.entries(project.tilesets)) {
  const textureKey = tileset.image.type === "bundled" ? tileset.image.id : `uploaded:${tileset.image.id}`;
  const atlasPath = texturePaths.get(textureKey) ?? null;
  const atlas = atlasFor(atlasPath);
  const rows: string[] = [];
  const capacity = atlas ? Math.floor(atlas.width / tileset.tileSize) * Math.floor(atlas.height / tileset.tileSize) : 0;
  const graftedBeyond = (tileset.tileGrafts ?? []).filter((g) => g.targetTile >= capacity).length;
  if (atlas) {
    const cols = Math.floor(atlas.width / tileset.tileSize);
    if (cols !== tileset.tilesPerRow) rows.push(`tilesPerRow=${tileset.tilesPerRow} but atlas has ${cols} columns`);
    const unaccounted = tileset.count - capacity - graftedBeyond;
    if (unaccounted > 0) rows.push(`count=${tileset.count} exceeds atlas capacity ${capacity} by ${unaccounted} tile(s) with no graft`);
  }
  const groups = autotileGroupsForTileset(tileset);
  tilesetReports.push({
    id,
    textureKey,
    atlasPath,
    tileSize: tileset.tileSize,
    tilesPerRow: tileset.tilesPerRow,
    count: tileset.count,
    atlasWidth: atlas?.width ?? 0,
    atlasHeight: atlas?.height ?? 0,
    atlasCapacity: capacity,
    graftedBeyondAtlas: graftedBeyond,
    groups: groups.length,
    tilesetsRows: rows,
  });
  if (!atlas && groups.length > 0) {
    for (const group of groups) {
      groupReports.push({
        tilesetId: id, textureKey, atlasPath, groupId: group.id, groupName: group.name,
        layer: autotileGroupLayer(group), neighborhood: group.neighborhood ?? 4,
        members: group.memberTileIds.length, roles: {}, distinctRoles: 0, distinctAcrossShapes: 0,
        innerVariantPresent: false, innerCornerReached: "n/a", design: [], distinctValues: 0, failures: ["no-atlas"], warnings: [],
        shapeTiles: {}, probeMasks: {}, png: null,
      });
    }
    continue;
  }
  for (const group of groups) groupReports.push(auditGroup(tileset, group));
}

const summary = {
  generatedAt: new Date().toISOString(),
  tilesets: tilesetReports.length,
  tilesetsWithGroups: tilesetReports.filter((t) => t.groups > 0).length,
  groups: groupReports.length,
  pass: groupReports.filter((g) => g.failures.length === 0).length,
  fail: groupReports.filter((g) => g.failures.length > 0).length,
  failCauses: countCauses(groupReports),
  tilesetRowIssues: tilesetReports.filter((t) => t.tilesetsRows.length > 0),
};

function countCauses(reports: readonly GroupReport[]): Record<string, number> {
  const causes: Record<string, number> = {};
  for (const report of reports) for (const failure of report.failures) {
    const key = failure.split(":")[0]!;
    causes[key] = (causes[key] ?? 0) + 1;
  }
  return causes;
}

writeFileSync(argv[0] ?? "/tmp/autotile-audit/audit.json", JSON.stringify({ summary, tilesets: tilesetReports, groups: groupReports }, null, 1));
console.log(JSON.stringify(summary, null, 1));
