import { TILE } from "@/project/defaults/constants";
import { roleCapabilities } from "@/project/tileRoles";
import { isTreeCanopyTileId, isTreeTrunkTileId } from "@/project/tilesetHarness";
import type { TileGroupMetadata, TileGroupRole, TilesetDef } from "@/project/types";

const EMPTY_TILE = TILE.EMPTY;
const MAX_SAMPLE_SIZE = 6;
const TREE_COUNT = 3;

type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;
type PatternPartRole = PatternGrammar["parts"][number]["role"];
type JunctionSide = "above" | "below" | "leftOf" | "rightOf";
type JunctionAction = "omit" | "replace";
type OverlayWhen = "diagonalCorner" | "eaveEnd" | "innerCorner" | "ridge";
type Layer = "lower" | "upper";
type Point = { readonly x: number; readonly y: number };

type StructureJunctionRule = { readonly action: JunctionAction; readonly atRoles?: readonly string[]; readonly replaceWith?: readonly number[]; readonly side: JunctionSide; readonly withRole: TileGroupRole };
type StructureOverlayRule = { readonly tileIds: readonly number[]; readonly when: OverlayWhen };

type MetadataJunctionRule = TileGroupMetadata extends { readonly junctions?: readonly (infer Rule)[] } ? Rule : StructureJunctionRule;
type MetadataOverlayRule = TileGroupMetadata extends { readonly overlays?: readonly (infer Rule)[] } ? Rule : StructureOverlayRule;
type GroupSampleJunctionRule = MetadataJunctionRule & StructureJunctionRule;
type GroupSampleOverlayRule = MetadataOverlayRule & StructureOverlayRule;

export type GroupSampleInput = {
  readonly cellLayers?: readonly Layer[] | null;
  readonly junctions?: readonly GroupSampleJunctionRule[] | null;
  readonly overlays?: readonly GroupSampleOverlayRule[] | null;
  readonly role: TileGroupRole;
  readonly tileIds: readonly number[];
  readonly patternGrammar?: PatternGrammar | null;
};

export type GroupSample = {
  readonly h: number;
  readonly lower: number[];
  readonly upper: number[];
  readonly w: number;
};

const NINE_SLICE_ROLES: readonly PatternPartRole[] = ["topLeft", "top", "topRight", "left", "center", "right", "bottomLeft", "bottom", "bottomRight"];
const PATTERN_PART_ROLES: readonly PatternPartRole[] = [...NINE_SLICE_ROLES, "bottomCap", "leftCap", "repeatBody", "rightCap", "topCap"];

export function buildGroupSample(tileset: TilesetDef, input: GroupSampleInput): GroupSample {
  const sample = buildBaseGroupSample(tileset, input);
  applyJunctions(sample, tileset, input);
  applyOverlays(sample, tileset, input.overlays ?? []);
  return sample;
}

function buildBaseGroupSample(tileset: TilesetDef, input: GroupSampleInput): GroupSample {
  const grammar = input.patternGrammar;
  const caps = roleCapabilities(tileset, input.role);
  if (grammar?.kind === "repeatable_block") return repeatableBlockSample(tileset, input);
  if (grammar?.kind === "nine_slice_expandable" || caps.sampleAs === "nineSlice") return nineSliceSample(tileset, input);
  if (grammar?.kind === "vertical_expandable") return verticalSample(tileset, input);
  if (grammar?.kind === "horizontal_expandable") return horizontalSample(tileset, input);
  if (grammar?.kind === "autotile_3x3") return autotileSample(tileset, input);
  // 문법 없는 prop 은 정확히 2타일(침엽수 등)일 때만 세로 쌍. 벤치·소품 가방(3+)은 세로로 묶지 않는다.
  if (!grammar && caps.sampleAs === "verticalPair" && input.tileIds.length === 2) return verticalSample(tileset, input);
  if (caps.sampleAs === "roof") return roofSample(tileset, input);
  return fallbackSample(tileset, input);
}

function repeatableBlockSample(tileset: TilesetDef, input: GroupSampleInput): GroupSample {
  const grammar = input.patternGrammar;
  const width = Math.min(MAX_SAMPLE_SIZE, grammar?.blockWidth ?? 1);
  const height = Math.min(MAX_SAMPLE_SIZE, grammar?.blockHeight ?? 1);
  const sample = emptySample(width, height);
  const tiles = repeatTiles(tileset, grammar, input.tileIds);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const tile = tiles[index] ?? EMPTY_TILE;
      const layer = input.cellLayers?.length === width * height ? input.cellLayers[index] : undefined;
      if (layer) placeOnLayer(sample, x, y, tile, layer);
      else place(sample, tileset, input.role, x, y, tile);
    }
  }
  return sample;
}

function nineSliceSample(tileset: TilesetDef, input: GroupSampleInput): GroupSample {
  const sample = emptySample(3, 3);
  const tiles = NINE_SLICE_ROLES.map((role, index) => partTile(tileset, input.patternGrammar, role, input.tileIds[index]));
  for (let index = 0; index < tiles.length; index += 1) {
    place(sample, tileset, input.role, index % 3, Math.floor(index / 3), tiles[index] ?? EMPTY_TILE);
  }
  return sample;
}

function verticalSample(tileset: TilesetDef, input: GroupSampleInput): GroupSample {
  const w = Math.min(MAX_SAMPLE_SIZE, TREE_COUNT * 2 - 1);
  const sample = emptySample(w, 2, defaultGrassTile(tileset));
  const top = partTile(tileset, input.patternGrammar, "top", partTile(tileset, input.patternGrammar, "topCap", input.tileIds[0]));
  const bottom = partTile(tileset, input.patternGrammar, "bottom", partTile(tileset, input.patternGrammar, "bottomCap", input.tileIds[1] ?? top));
  for (let tree = 0; tree < TREE_COUNT; tree += 1) {
    const x = tree * 2;
    if (x >= w) break;
    place(sample, tileset, "prop", x, 0, top);
    place(sample, tileset, "prop", x, 1, bottom);
  }
  return sample;
}

function horizontalSample(tileset: TilesetDef, input: GroupSampleInput): GroupSample {
  const w = Math.min(MAX_SAMPLE_SIZE, 5);
  const sample = emptySample(w, 1, backdropTile(tileset, input));
  const body = repeatTiles(tileset, input.patternGrammar, input.tileIds.slice(1, -1));
  place(sample, tileset, input.role, 0, 0, partTile(tileset, input.patternGrammar, "leftCap", input.tileIds[0]));
  for (let x = 1; x < w - 1; x += 1) {
    place(sample, tileset, input.role, x, 0, body[(x - 1) % body.length] ?? EMPTY_TILE);
  }
  place(sample, tileset, input.role, w - 1, 0, partTile(tileset, input.patternGrammar, "rightCap", input.tileIds[input.tileIds.length - 1]));
  return sample;
}

function autotileSample(tileset: TilesetDef, input: GroupSampleInput): GroupSample {
  const sample = emptySample(3, 3);
  for (let index = 0; index < 9; index += 1) {
    place(sample, tileset, input.role, index % 3, Math.floor(index / 3), validTile(tileset, input.tileIds[index]));
  }
  return sample;
}

function roofSample(tileset: TilesetDef, input: GroupSampleInput): GroupSample {
  const w = Math.min(MAX_SAMPLE_SIZE, Math.max(1, Math.min(4, input.tileIds.length)));
  const h = input.tileIds.length > w ? 2 : 1;
  const sample = emptySample(w, h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const tile = input.tileIds[y * w + x] ?? input.tileIds[x] ?? EMPTY_TILE;
      place(sample, tileset, input.role, x, y, validTile(tileset, tile));
    }
  }
  return sample;
}

function fallbackSample(tileset: TilesetDef, input: GroupSampleInput): GroupSample {
  const w = Math.max(1, Math.min(MAX_SAMPLE_SIZE, input.tileIds.length));
  const sample = emptySample(w, 1, backdropTile(tileset, input));
  for (let x = 0; x < w; x += 1) {
    place(sample, tileset, input.role, x, 0, validTile(tileset, input.tileIds[x]));
  }
  return sample;
}

function emptySample(w: number, h: number, lowerTile: number = EMPTY_TILE): GroupSample {
  return {
    h,
    lower: Array.from({ length: w * h }, () => lowerTile),
    upper: Array.from({ length: w * h }, () => EMPTY_TILE),
    w,
  };
}

function place(sample: GroupSample, tileset: TilesetDef, role: TileGroupRole, x: number, y: number, tile: number): void {
  const index = y * sample.w + x;
  if (tile === EMPTY_TILE) return;
  if (targetLayer(tileset, role, tile) === "upper") sample.upper[index] = tile;
  else sample.lower[index] = tile;
}

function placeOnLayer(sample: GroupSample, x: number, y: number, tile: number, layer: Layer): void {
  const index = y * sample.w + x;
  if (tile === EMPTY_TILE) return;
  if (layer === "upper") sample.upper[index] = tile;
  else sample.lower[index] = tile;
}

function targetLayer(tileset: TilesetDef, role: TileGroupRole, tile: number): Layer {
  // 숲: 수관 upper + 밑동 lower — 같은 칸에 겹쳐야 숲이 된다.
  if (isTreeCanopyTileId(tile)) return "upper";
  if (isTreeTrunkTileId(tile)) return "lower";
  if (role === "prop") return "upper";
  return tileset.priority[tile] === "upper" ? "upper" : "lower";
}

function partTile(tileset: TilesetDef, grammar: PatternGrammar | null | undefined, role: PatternPartRole, fallback: number | undefined): number {
  return validTile(tileset, grammar?.parts.find((part) => part.role === role)?.tileIds[0] ?? fallback);
}

function repeatTiles(tileset: TilesetDef, grammar: PatternGrammar | null | undefined, fallback: readonly number[]): readonly number[] {
  const tiles = grammar?.parts.find((part) => part.role === "repeatBody")?.tileIds ?? fallback;
  const valid = tiles.map((tile) => validTile(tileset, tile)).filter((tile) => tile !== EMPTY_TILE);
  return valid.length > 0 ? valid : [EMPTY_TILE];
}

function validTile(tileset: TilesetDef, tile: number | undefined): number {
  return tile !== undefined && Number.isInteger(tile) && tile >= 0 && tile < tileset.count ? tile : EMPTY_TILE;
}

function defaultGrassTile(tileset: TilesetDef): number {
  if (TILE.GRASS >= 0 && TILE.GRASS < tileset.count) return TILE.GRASS;
  const firstLower = tileset.priority.findIndex((layer) => layer === "lower");
  return firstLower >= 0 ? firstLower : EMPTY_TILE;
}

function backdropTile(tileset: TilesetDef, input: GroupSampleInput): number {
  return input.role === "prop" || input.tileIds.some((tile) => targetLayer(tileset, input.role, validTile(tileset, tile)) === "upper")
    ? defaultGrassTile(tileset)
    : EMPTY_TILE;
}

function applyJunctions(sample: GroupSample, tileset: TilesetDef, input: GroupSampleInput): void {
  for (const rule of input.junctions ?? []) {
    const points = junctionPoints(sample, rule);
    let index = 0;
    for (const point of points) {
      clearCell(sample, point);
      if (rule.action === "replace") {
        const replacement = validTile(tileset, rule.replaceWith?.[index] ?? rule.replaceWith?.[0]);
        if (replacement !== EMPTY_TILE) place(sample, tileset, input.role, point.x, point.y, replacement);
      }
      index += 1;
    }
  }
}

function applyOverlays(sample: GroupSample, tileset: TilesetDef, overlays: readonly GroupSampleOverlayRule[]): void {
  for (const overlay of overlays) {
    const points = overlayPoints(sample, overlay.when);
    let index = 0;
    for (const point of points) {
      const tile = validTile(tileset, overlay.tileIds[index] ?? overlay.tileIds[0]);
      const cell = cellIndex(sample, point);
      if (tile !== EMPTY_TILE) sample.upper[cell] = tile;
      index += 1;
    }
  }
}

function junctionPoints(sample: GroupSample, rule: GroupSampleJunctionRule): readonly Point[] {
  if (rule.atRoles && rule.atRoles.length > 0) {
    const points: Point[] = [];
    for (const role of rule.atRoles) {
      if (isPatternPartRole(role)) points.push(...rolePoints(sample, role));
    }
    if (points.length > 0) return points;
  }
  return sidePoints(sample, rule.side);
}

function rolePoints(sample: GroupSample, role: PatternPartRole): readonly Point[] {
  const midX = Math.floor(sample.w / 2);
  const midY = Math.floor(sample.h / 2);
  const lastX = sample.w - 1;
  const lastY = sample.h - 1;
  const map = {
    bottom: [{ x: midX, y: lastY }],
    bottomCap: [{ x: midX, y: lastY }],
    bottomLeft: [{ x: 0, y: lastY }],
    bottomRight: [{ x: lastX, y: lastY }],
    center: [{ x: midX, y: midY }],
    left: [{ x: 0, y: midY }],
    leftCap: [{ x: 0, y: midY }],
    repeatBody: [{ x: midX, y: midY }],
    right: [{ x: lastX, y: midY }],
    rightCap: [{ x: lastX, y: midY }],
    top: [{ x: midX, y: 0 }],
    topCap: [{ x: midX, y: 0 }],
    topLeft: [{ x: 0, y: 0 }],
    topRight: [{ x: lastX, y: 0 }],
  } satisfies Record<PatternPartRole, readonly Point[]>;
  return map[role];
}

function sidePoints(sample: GroupSample, side: JunctionSide): readonly Point[] {
  const lastX = sample.w - 1;
  const lastY = sample.h - 1;
  const map = {
    above: rowPoints(sample, 0),
    below: rowPoints(sample, lastY),
    leftOf: columnPoints(sample, 0),
    rightOf: columnPoints(sample, lastX),
  } satisfies Record<JunctionSide, readonly Point[]>;
  return map[side];
}

function overlayPoints(sample: GroupSample, when: OverlayWhen): readonly Point[] {
  const midX = Math.floor(sample.w / 2);
  const midY = Math.floor(sample.h / 2);
  const lastX = sample.w - 1;
  const lastY = sample.h - 1;
  const map = {
    diagonalCorner: [{ x: 0, y: 0 }, { x: lastX, y: 0 }, { x: 0, y: lastY }, { x: lastX, y: lastY }],
    eaveEnd: [{ x: 0, y: lastY }, { x: lastX, y: lastY }],
    innerCorner: [{ x: midX, y: midY }],
    ridge: [{ x: midX, y: 0 }],
  } satisfies Record<OverlayWhen, readonly Point[]>;
  return map[when];
}

function rowPoints(sample: GroupSample, y: number): readonly Point[] {
  return Array.from({ length: sample.w }, (_, x) => ({ x, y }));
}

function columnPoints(sample: GroupSample, x: number): readonly Point[] {
  return Array.from({ length: sample.h }, (_, y) => ({ x, y }));
}

function clearCell(sample: GroupSample, point: Point): void {
  const index = cellIndex(sample, point);
  sample.lower[index] = EMPTY_TILE;
  sample.upper[index] = EMPTY_TILE;
}

function cellIndex(sample: GroupSample, point: Point): number {
  return point.y * sample.w + point.x;
}

function isPatternPartRole(value: string): value is PatternPartRole {
  return PATTERN_PART_ROLES.some((role) => role === value);
}
