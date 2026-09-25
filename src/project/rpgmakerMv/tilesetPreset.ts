// MV/MZ 팩 프리셋 + 사용자가 올린 원본 시트 → 조수가 바로 깔 수 있는 OPRN 타일셋.
//
// 조수는 그림을 보지 않고 이름표·묶음·참고문서만 보고 깐다(openwiki/teaching-assistant-tilesets.md).
// 그래서 여기서 붙이는 것이 전부다:
//   - 칸마다 통행·레이어(홈 레이어는 잠근 tileMeta.defaultLayer, ★ 는 priority)
//   - 오토타일 종류마다 AutotileGroup(이웃 → 모양) + 이름 붙은 tileGroup(fill_region 재료)
//   - 물체마다 구조물 킷(learnedFrom "pack-preset", stamp_tileset_object 가 찍는다)
//   - 참고문서 한 용도: 조립 지침 · 재료 목록 · 물체 목록 · 예시 두 레이어 배열 + 그림(사용자 원본에서 굽는다)
// 그림은 전부 사용자 원본에서 이 자리에서 만든다. 저장소에는 그림이 없다(재배포 금지 팩).

import type {
  AutotileGroup, PassFlag, SectionStructureKitDef, TileAiMetadata, TileGroupMetadata, TileGroupRole, TilesetDef,
} from "../types";
import type { TilesetReferenceCategory, TilesetReferenceImage } from "../tilesetReferences";
import { autotileNeighborMask } from "../defaults/autotileEngine";
import { paintAuto, stampKit } from "./packPaint";
import { autotileVariantMap, quarterTable } from "./autotile";
import { bakeMvAtlas, tileOpacity, type RgbaImage } from "./bake";
import { drawNumber } from "./digitFont";
import { layoutMvAtlas, mvAutotileShapeKind, mvSheetPart, mvTileIndex, MV_TILE_SIZE, type MvAtlasLayout } from "./layout";
import type { MvAutotileRole, MvObjectKind, MvPackObject, MvPackPreset } from "./packPreset";

export interface MvPackBuildInput {
  readonly preset: MvPackPreset;
  /** 파일 이름 → 디코딩한 원본. 빠진 시트의 칸은 투명으로 남는다. */
  readonly sheets: ReadonlyMap<string, RgbaImage>;
  readonly tilesetId: string;
  readonly assetId: string;
  /** RGBA → data:image/png;base64 (브라우저는 canvas, Node 는 pngjs). */
  readonly encodePng: (image: RgbaImage) => string;
}

export interface MvPackExampleMap {
  readonly width: number;
  readonly height: number;
  readonly lowerTiles: number[];
  readonly upperTiles: number[];
}

export interface MvPackBuildResult {
  readonly tileset: TilesetDef;
  readonly atlas: RgbaImage;
  readonly layout: MvAtlasLayout;
  readonly example: MvPackExampleMap;
}

const PASS: PassFlag = { up: true, down: true, left: true, right: true };
const BLOCK: PassFlag = { up: false, down: false, left: false, right: false };

/** 쓰임새 → (홈 레이어, ★ 여부, 통행, 그룹 역할). */
const ROLE_RULES: Record<MvAutotileRole, { home: "lower" | "upper"; star: boolean; pass: boolean; group: TileGroupRole }> = {
  ground: { home: "lower", star: false, pass: true, group: "terrain" },
  road: { home: "lower", star: false, pass: true, group: "terrain" },
  water: { home: "lower", star: false, pass: false, group: "water" },
  roof: { home: "lower", star: false, pass: false, group: "roof" },
  wall: { home: "lower", star: false, pass: false, group: "wall" },
  mark: { home: "upper", star: false, pass: true, group: "terrain" },
  plant: { home: "upper", star: false, pass: true, group: "terrain" },
  fence: { home: "upper", star: false, pass: false, group: "fence" },
  trim: { home: "upper", star: true, pass: true, group: "terrain" },
};

const ROLE_WORDS: Record<MvAutotileRole, string> = {
  ground: "걷는 바닥", road: "차도", water: "물(막힘)", roof: "옥상·지붕(막힘)", wall: "외벽(막힘)",
  mark: "바닥 위 겹침 표시(통행)", fence: "겹침 울타리·난간(막힘)", plant: "겹침 풀(통행)", trim: "벽·물 위 겹침 장식",
};

const OBJECT_WORDS: Record<MvObjectKind, string> = {
  decal: "바닥 표시", prop: "막힌 물체", tall: "키 큰 물체(밑줄만 막힘)", wallmount: "벽·옥상 부착", door: "문(걸을 수 있음)", overhead: "머리 위",
};

function meta(label: string, description: string, home: "lower" | "upper", extra: Partial<TileAiMetadata> = {}): TileAiMetadata {
  // 홈 레이어를 잠근다 — 커스텀 타일셋은 잠긴 defaultLayer 가 없으면 priority 를 홈으로 읽는다(tileLayerClassification).
  // 이 팩의 priority 는 ★(캐릭터 위) 뜻으로만 쓴다.
  return { label, description, defaultLayer: home, locked: true, source: "imported", ...extra };
}

function sheetColumns(sheets: ReadonlyMap<string, RgbaImage>, file: string): number {
  return Math.floor((sheets.get(file)?.width ?? 768) / MV_TILE_SIZE);
}

/** 물체 칸의 아틀라스 번호. 투명한 칸은 -1. */
function objectCells(object: MvPackObject, input: MvPackBuildInput, index: ReturnType<typeof mvTileIndex>, atlas: RgbaImage, columns: number): number[][] {
  const sheetCols = sheetColumns(input.sheets, object.sheet);
  const rows: number[][] = [];
  for (let dy = 0; dy < object.h; dy += 1) {
    const row: number[] = [];
    for (let dx = 0; dx < object.w; dx += 1) {
      const tile = index(object.sheet, (object.y + dy) * sheetCols + object.x + dx);
      row.push(tile === undefined || tileOpacity(atlas, columns, tile) === 0 ? -1 : tile);
    }
    rows.push(row);
  }
  return rows;
}

function objectCellSolid(object: MvPackObject, dx: number, dy: number): boolean {
  if (object.kind === "prop") return true;
  if (object.kind === "tall") return object.solid ? object.solid.some(([x, y]) => x === dx && y === dy) : dy === object.h - 1;
  return false;
}

function objectCellStar(object: MvPackObject, dx: number, dy: number): boolean {
  if (object.kind === "overhead" || object.kind === "wallmount") return true;
  if (object.kind === "tall") return !objectCellSolid(object, dx, dy);
  return false;
}

export function buildMvPackTileset(input: MvPackBuildInput): MvPackBuildResult {
  const { preset } = input;
  const specs = preset.sheets.map((sheet) => {
    const image = input.sheets.get(sheet.file);
    // 빠진 시트도 칸 번호는 자리를 지킨다 — 표준 크기로 배치한다.
    const part = mvSheetPart(sheet.file);
    const fallback = part === "A5" ? { width: 384, height: 768 } : part === "A1" || part === "A2" ? { width: 768, height: 576 }
      : part === "A3" ? { width: 768, height: 384 } : part === "A4" ? { width: 768, height: 720 } : { width: 768, height: 768 };
    return { file: sheet.file, width: image?.width ?? fallback.width, height: image?.height ?? fallback.height };
  });
  const layout = layoutMvAtlas(specs);
  const atlas = bakeMvAtlas(layout, input.sheets);
  const index = mvTileIndex(layout);
  const count = layout.count;
  const columns = layout.columns;

  const passability: PassFlag[] = Array.from({ length: count }, () => ({ ...PASS }));
  const priority: ("lower" | "upper")[] = new Array(count).fill("lower");
  const tileMeta: TileAiMetadata[] = Array.from({ length: count }, () => ({ label: "", description: "" }));
  for (const [tile, cell] of layout.cells) {
    // 이름 없는 물체 칸도 위층이 집이다(MV 기본 ○ = 통행·캐릭터 아래).
    if (cell.part === "B") tileMeta[tile] = meta("", "", "upper");
  }

  const tileGroups: TileGroupMetadata[] = [];
  const autotileGroups: AutotileGroup[] = [];
  const materialIndex: { name: string; role: MvAutotileRole | "flat"; body: number; description?: string }[] = [];
  for (const entry of preset.autotiles) {
    const part = mvSheetPart(entry.sheet);
    const shapeKind = mvAutotileShapeKind(part, entry.kind);
    if (!shapeKind) continue;
    const shapes: number[] = [];
    for (let shape = 0; shape < quarterTable(shapeKind).length; shape += 1) {
      const tile = index(entry.sheet, entry.kind, shape);
      if (tile !== undefined) shapes.push(tile);
    }
    if (shapes.length === 0) continue;
    const rule = ROLE_RULES[entry.role];
    const description = entry.description ?? ROLE_WORDS[entry.role];
    shapes.forEach((tile, shape) => {
      passability[tile] = rule.pass ? { ...PASS } : { ...BLOCK };
      priority[tile] = rule.star ? "upper" : "lower";
      tileMeta[tile] = meta(entry.name, shape === 0 ? description : `${description} — 자동 모양 ${shape}`, rule.home, {
        role: rule.group, passage: rule.pass ? "passable" : "solid", tags: [entry.role],
      });
    });
    const groupId = `mvpack-${preset.id}-${part}-${entry.sheet.replace(/\W+/g, "_")}-${entry.kind}`;
    autotileGroups.push({
      id: groupId,
      name: entry.name,
      neighborhood: shapeKind === "floor" ? 8 : 4,
      // MV 는 맵 밖을 같은 재료로 본다 — 맵 가장자리까지 깐 보도·물에 테두리가 생기지 않는다.
      outsideConnects: true,
      memberTileIds: shapes,
      variantMap: autotileVariantMap(shapeKind, shapes),
      ...(rule.home === "upper" ? { layer: "upper" as const } : {}),
    });
    tileGroups.push({
      id: groupId,
      name: entry.name,
      role: rule.group,
      defaultLayer: rule.home,
      layerHome: rule.home,
      tileIds: shapes,
      description: `${description}. 몸통 ${shapes[0]} 하나로 칠하면 이웃에 맞춰 모양이 바뀐다.`,
      placementRules: rule.home === "upper" ? "바닥 위에 겹쳐 깐다(위층). 아래층 지면은 그대로 둔다." : "아래층에 면으로 깐다.",
      origin: "ai",
      confidence: "high",
      source: "imported",
      patternGrammar: { kind: "autotile_3x3", parts: [{ role: "center", tileIds: [shapes[0]!] }], preserveCaps: false, repeat: "center" },
    });
    materialIndex.push({ name: entry.name, role: entry.role, body: shapes[0]!, ...(entry.description ? { description: entry.description } : {}) });
  }

  for (const flat of preset.flats) {
    const tile = index(flat.sheet, flat.cell);
    if (tile === undefined) continue;
    const blocked = flat.role === "wall" || flat.role === "roof";
    passability[tile] = blocked ? { ...BLOCK } : { ...PASS };
    const group: TileGroupRole = flat.role === "wall" ? "wall" : flat.role === "roof" ? "roof" : "terrain";
    tileMeta[tile] = meta(flat.name, flat.description ?? "평타일(오토타일 아님)", "lower", { role: group, passage: blocked ? "solid" : "passable", tags: [flat.role] });
    tileGroups.push({
      id: `mvpack-${preset.id}-flat-${flat.sheet.replace(/\W+/g, "_")}-${flat.cell}`,
      name: flat.name, role: group, defaultLayer: "lower", layerHome: "lower", tileIds: [tile],
      description: flat.description ?? "평타일(오토타일 아님)", placementRules: "아래층에 한 칸씩 또는 면으로 깐다.",
      origin: "ai", confidence: "high", source: "imported",
    });
    materialIndex.push({ name: flat.name, role: "flat", body: tile, ...(flat.description ? { description: flat.description } : {}) });
  }

  const structureKits: SectionStructureKitDef[] = [];
  const objectIndex: { object: MvPackObject; rows: number[][] }[] = [];
  for (const object of preset.objects) {
    const rows = objectCells(object, input, index, atlas, columns);
    if (rows.every((row) => row.every((tile) => tile < 0))) continue;
    rows.forEach((row, dy) => row.forEach((tile, dx) => {
      if (tile < 0) return;
      const solid = objectCellSolid(object, dx, dy);
      passability[tile] = solid ? { ...BLOCK } : { ...PASS };
      priority[tile] = objectCellStar(object, dx, dy) ? "upper" : "lower";
      tileMeta[tile] = meta(object.name, `${object.description ?? OBJECT_WORDS[object.kind]} — ${object.w}×${object.h} 물체 ${object.id} 의 (${dx},${dy}) 칸`, "upper", {
        role: "prop", passage: solid ? "solid" : "passable", tags: [object.id],
      });
    }));
    structureKits.push({
      id: object.id,
      kind: "section",
      name: object.name,
      width: object.w,
      height: object.h,
      tileSize: MV_TILE_SIZE,
      rows: rows.map((row) => ({ tiles: row.map(() => -1), upperTiles: row })),
      ai: {
        description: object.description ?? OBJECT_WORDS[object.kind],
        placementRules: OBJECT_WORDS[object.kind],
        tags: [object.kind, preset.id, ...(object.onRoad ? ["on-road"] : [])],
        role: "prop",
        layerHome: "upper",
        ...(object.growth ? { growthAxis: object.growth } : { repeatability: "fixed" as const }),
        origin: "ai",
        confidence: "high",
      },
      learnedFrom: "pack-preset",
    });
    objectIndex.push({ object, rows });
  }

  const tilesetBase: TilesetDef = {
    id: input.tilesetId,
    name: preset.name,
    kind: "custom",
    image: { type: "uploaded", id: input.assetId },
    tileSize: MV_TILE_SIZE,
    tilesPerRow: columns,
    count,
    passability,
    priority,
    terrain: new Array(count).fill(0),
    tileMeta,
    tileGroups,
    autotileGroups,
    structureKits,
    mvPack: { presetId: preset.id, version: preset.version, ...plainWallMap(preset, index) },
  };
  const example = buildExampleBlock(tilesetBase, preset);
  const referenceDocuments = buildReferences(input, tilesetBase, atlas, materialIndex, objectIndex, example);
  return { tileset: { ...tilesetBase, referenceDocuments }, atlas, layout, example };
}

/** 창 난 외벽의 모양별 칸 → 창 없는 짝의 같은 모양 칸. */
function plainWallMap(preset: MvPackPreset, index: ReturnType<typeof mvTileIndex>): { plainWalls?: Record<string, number> } {
  const plainWalls: Record<string, number> = {};
  for (const pair of preset.plainWalls ?? []) {
    const shapeKind = mvAutotileShapeKind(mvSheetPart(pair.sheet), pair.kind);
    if (!shapeKind || mvAutotileShapeKind(mvSheetPart(pair.sheet), pair.plainKind) !== shapeKind) continue;
    for (let shape = 0; shape < quarterTable(shapeKind).length; shape += 1) {
      const from = index(pair.sheet, pair.kind, shape);
      const to = index(pair.sheet, pair.plainKind, shape);
      if (from !== undefined && to !== undefined) plainWalls[String(from)] = to;
    }
  }
  return Object.keys(plainWalls).length > 0 ? { plainWalls } : {};
}

// ───────────────────────── 예시 블록 ─────────────────────────

/** 참고문서 예시: 가로 차도 + 보도 + 붉은 벽돌 가게 + 회색 사무실 + 공원 한 귀퉁이. 22×15. */
function buildExampleBlock(tileset: TilesetDef, preset: MvPackPreset): MvPackExampleMap {
  const width = 22;
  const height = 15;
  const map: MvPackExampleMap = { width, height, lowerTiles: new Array(width * height).fill(-1), upperTiles: new Array(width * height).fill(-1) };
  if (preset.id !== "rasak-modern-city") return map;
  paintAuto(tileset, map, "회색 콘크리트 보도", 0, 0, width, height);
  // 건물 두 채를 층 띠로 쌓는다(작가 모텔·유리 상가): 옥상 2줄 → 창 난 위층 3줄(=3개 층) → 창 없는 1층 1줄.
  paintAuto(tileset, map, "짙은 옥상(붉은 벽돌 테두리)", 1, 0, 8, 2);
  paintAuto(tileset, map, "붉은 벽돌 외벽 창문", 1, 2, 8, 3);
  paintAuto(tileset, map, "붉은 벽돌 외벽", 1, 5, 8, 1);
  paintAuto(tileset, map, "회색 옥상", 11, 0, 9, 2);
  paintAuto(tileset, map, "회색 외벽 유리창 줄", 11, 2, 9, 2);
  paintAuto(tileset, map, "회색 유리 상가 외벽", 11, 4, 9, 2);
  // 차도 5줄 + 중앙선.
  paintAuto(tileset, map, "아스팔트 차도", 0, 8, width, 5);
  paintAuto(tileset, map, "잔디", 0, 13, 7, 2);
  // 차양은 문 윗칸 줄(4행), 문은 맨 아래 줄(5행)이 밑. 차양 줄무늬가 문 윗칸을 덮는다.
  stampKit(tileset, map, "glass_door_bright", 4, 4);
  stampKit(tileset, map, "awning_red", 3, 4, { keepDoors: true });
  stampKit(tileset, map, "metal_door", 15, 4);
  stampKit(tileset, map, "satellite_dish", 16, 0);
  for (let x = 0; x < width; x += 2) stampKit(tileset, map, "lane_line_horizontal", x, 10);
  for (let y = 8; y < 13; y += 1) stampKit(tileset, map, "crosswalk_for_horizontal_road", 9, y);
  for (let y = 8; y < 13; y += 1) stampKit(tileset, map, "crosswalk_for_horizontal_road", 10, y);
  // 보도가 2줄이라 1×3 가로등은 건물 사이 틈(9~10열)·끝(21열)에 세운다 — 건물 앞에 세우면 머리가 외벽 창을 가린다.
  stampKit(tileset, map, "street_lamp_left", 9, 5);
  stampKit(tileset, map, "street_lamp_left", 21, 5);
  stampKit(tileset, map, "trash_can", 7, 6);
  stampKit(tileset, map, "vending_soda", 20, 6);
  stampKit(tileset, map, "fire_hydrant", 18, 7);
  stampKit(tileset, map, "park_bench", 3, 13);
  stampKit(tileset, map, "cone_tree", 1, 13);
  stampKit(tileset, map, "cone_tree", 5, 13);
  return map;
}

// ───────────────────────── 참고문서 ─────────────────────────

function blank(width: number, height: number, rgb: readonly [number, number, number] = [96, 96, 104]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) data.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
  return { width, height, data };
}

function blitTile(dst: RgbaImage, atlas: RgbaImage, columns: number, tile: number, dx: number, dy: number): void {
  if (tile < 0) return;
  const sx = (tile % columns) * MV_TILE_SIZE;
  const sy = Math.floor(tile / columns) * MV_TILE_SIZE;
  for (let y = 0; y < MV_TILE_SIZE; y += 1) {
    const ty = dy + y;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < MV_TILE_SIZE; x += 1) {
      const tx = dx + x;
      if (tx < 0 || tx >= dst.width) continue;
      const s = ((sy + y) * atlas.width + sx + x) * 4;
      const a = atlas.data[s + 3]! / 255;
      if (a === 0) continue;
      const d = (ty * dst.width + tx) * 4;
      for (let c = 0; c < 3; c += 1) dst.data[d + c] = Math.round(atlas.data[s + c]! * a + dst.data[d + c]! * (1 - a));
      dst.data[d + 3] = 255;
    }
  }
}

/** 두 레이어 맵을 그린다(아래층 → 위층). */
export function renderMvMap(map: MvPackExampleMap, atlas: RgbaImage, columns: number): RgbaImage {
  const image = blank(map.width * MV_TILE_SIZE, map.height * MV_TILE_SIZE, [0, 0, 0]);
  for (const layer of [map.lowerTiles, map.upperTiles]) {
    layer.forEach((tile, i) => blitTile(image, atlas, columns, tile, (i % map.width) * MV_TILE_SIZE, Math.floor(i / map.width) * MV_TILE_SIZE));
  }
  return image;
}

/** 오토타일 재료를 4×3 조각(모양이 보이게)으로 번호 붙여 늘어놓는다. */
function materialSheet(tileset: TilesetDef, atlas: RgbaImage, entries: readonly { name: string; body: number }[], start: number): RgbaImage {
  const perRow = 6;
  const cell = 3 * 32 + 8;
  const rows = Math.ceil(entries.length / perRow);
  const image = blank(perRow * (4 * 32 + 8), rows * cell);
  const small = 32;
  entries.forEach((entry, i) => {
    const group = tileset.autotileGroups?.find((g) => g.memberTileIds[0] === entry.body);
    const patch: MvPackExampleMap = { width: 4, height: 3, lowerTiles: new Array(12).fill(-1), upperTiles: new Array(12).fill(-1) };
    const mask = [1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1];
    mask.forEach((on, k) => { if (on) patch.lowerTiles[k] = entry.body; });
    if (group) {
      const members = new Set(group.memberTileIds);
      const view = { width: 4, height: 3, lowerTiles: patch.lowerTiles };
      const shaped = patch.lowerTiles.map((tile, k) => {
        if (!members.has(tile)) return tile;
        const m = autotileNeighborMask(view, k % 4, Math.floor(k / 4), (t) => members.has(t), group.neighborhood ?? 4);
        return group.variantMap[String(m)] ?? tile;
      });
      patch.lowerTiles.splice(0, 12, ...shaped);
    } else {
      patch.lowerTiles.fill(entry.body);
    }
    const full = renderMvMap(patch, atlas, tileset.tilesPerRow);
    const ox = (i % perRow) * (4 * small + 8);
    const oy = Math.floor(i / perRow) * cell;
    // 48 → 32 로 줄인다(한 장에 많이 담는다).
    for (let y = 0; y < 3 * small; y += 1) for (let x = 0; x < 4 * small; x += 1) {
      const s = ((Math.floor(y * 1.5)) * full.width + Math.floor(x * 1.5)) * 4;
      const d = ((oy + y) * image.width + ox + x) * 4;
      if (patch.lowerTiles[Math.floor(y / small) * 4 + Math.floor(x / small)]! < 0) continue;
      image.data.set(full.data.subarray(s, s + 4), d);
    }
    drawNumber(image, ox + 1, oy + 1, start + i, 2);
  });
  return image;
}

function objectSheet(atlas: RgbaImage, columns: number, objects: readonly { object: MvPackObject; rows: number[][] }[], start: number): RgbaImage {
  const box = 4 * 40 + 8;
  const perRow = 6;
  const image = blank(perRow * box, Math.ceil(objects.length / perRow) * box);
  objects.forEach(({ object, rows }, i) => {
    const patch: MvPackExampleMap = { width: object.w, height: object.h, lowerTiles: new Array(object.w * object.h).fill(-1), upperTiles: rows.flat() };
    const full = renderMvMap(patch, atlas, columns);
    const scale = Math.min(40 / MV_TILE_SIZE, (box - 8) / (Math.max(object.w, object.h) * MV_TILE_SIZE));
    const ox = (i % perRow) * box + 4;
    const oy = Math.floor(i / perRow) * box + 4;
    for (let y = 0; y < full.height * scale; y += 1) for (let x = 0; x < full.width * scale; x += 1) {
      const s = (Math.floor(y / scale) * full.width + Math.floor(x / scale)) * 4;
      if (full.data[s] === 0 && full.data[s + 1] === 0 && full.data[s + 2] === 0) continue;
      image.data.set(full.data.subarray(s, s + 4), ((oy + y) * image.width + ox + x) * 4);
    }
    drawNumber(image, ox - 3, oy - 3, start + i, 2);
  });
  return image;
}

function grid(map: MvPackExampleMap, layer: "lowerTiles" | "upperTiles"): string {
  const lines: string[] = [];
  for (let y = 0; y < map.height; y += 1) lines.push(map[layer].slice(y * map.width, (y + 1) * map.width).join(","));
  return lines.join("\n");
}

function buildReferences(
  input: MvPackBuildInput,
  tileset: TilesetDef,
  atlas: RgbaImage,
  materials: readonly { name: string; role: MvAutotileRole | "flat"; body: number; description?: string }[],
  objects: readonly { object: MvPackObject; rows: number[][] }[],
  example: MvPackExampleMap,
): TilesetReferenceCategory[] {
  const { preset } = input;
  const images: TilesetReferenceImage[] = [];
  const autos = materials.filter((m) => m.role !== "flat");
  const byRole = (roles: readonly (MvAutotileRole | "flat")[]) => materials.filter((m) => roles.includes(m.role));
  const numbered = new Map<string, number>();
  autos.forEach((m, i) => numbered.set(m.name, i + 1));
  const chunk = 48;
  for (let i = 0; i < autos.length; i += chunk) {
    const part = autos.slice(i, i + chunk);
    images.push({
      id: `materials-${i / chunk + 1}`,
      name: `재료 견본 ${i + 1}~${i + part.length}`,
      caption: `오토타일 재료 ${i + 1}~${i + part.length}번. 번호는 「재료 목록」 문서의 번호와 같다. 4×3 조각으로 가장자리 모양을 보인다.`,
      dataUrl: input.encodePng(materialSheet(tileset, atlas, part, i + 1)),
    });
  }
  images.push({
    id: "objects",
    name: `물체 견본 1~${objects.length}`,
    caption: "물체 번호는 「물체 목록」 문서의 번호와 같다.",
    dataUrl: input.encodePng(objectSheet(atlas, tileset.tilesPerRow, objects, 1)),
  });
  images.push({
    id: "example-block",
    name: "예시 블록 22×15",
    caption: "「예시 블록」 문서의 두 레이어 배열을 그대로 그린 것. 위쪽 두 건물, 가운데 보도, 가로 차도와 횡단보도, 왼쪽 아래 잔디.",
    dataUrl: input.encodePng(renderMvMap(example, atlas, tileset.tilesPerRow)),
  });

  const materialLines = (title: string, roles: readonly (MvAutotileRole | "flat")[]) => {
    const list = byRole(roles);
    if (list.length === 0) return "";
    return `## ${title}\n${list.map((m) => `- ${numbered.get(m.name) ? `${numbered.get(m.name)}. ` : ""}"${m.name}" (몸통 ${m.body})${m.description ? ` — ${m.description}` : ""}`).join("\n")}\n`;
  };
  const materialsDoc = [
    "# 재료 목록",
    "`fill_region material:\"이름\"` 에 따옴표 안 이름을 그대로 넣는다. 번호는 재료 견본 그림의 번호다.",
    "오토타일은 몸통 번호 하나로 칠하면 도구가 이웃에 맞춰 모양을 바꾼다 — 가장자리 번호를 직접 고르지 않는다.",
    "",
    materialLines("차도", ["road"]),
    materialLines("보도·광장·잔디(걷는 바닥)", ["ground"]),
    materialLines("물(막힘)", ["water"]),
    materialLines("옥상·지붕(건물 윗면, 막힘)", ["roof"]),
    materialLines("외벽(건물 앞면, 막힘)", ["wall"]),
    materialLines("겹침 — 바닥 위에 깐다(위층)", ["mark", "plant", "fence", "trim"]),
    materialLines("평타일(오토타일 아님, paint_tiles 로 한 칸씩)", ["flat"]),
  ].join("\n");
  const objectsDoc = [
    "# 물체 목록",
    "`stamp_tileset_object objectId:\"id\" base:{x,y}` — (x,y) 는 물체가 땅에 닿는 맨 아래 줄의 왼쪽 칸(또는 at = 왼쪽 위 칸). 번호는 물체 견본 그림의 번호다.",
    "",
    ...objects.map(({ object }, i) => `- ${i + 1}. \`${object.id}\` "${object.name}" ${object.w}×${object.h} · ${OBJECT_WORDS[object.kind]}${object.growth ? ` · ${object.growth === "both" ? "가로·세로" : object.growth === "horizontal" ? "가로" : "세로"}로 이어 찍기` : ""}${object.description ? ` — ${object.description}` : ""}`),
  ].join("\n");
  const exampleDoc = [
    "# 예시 블록 22×15 (두 레이어 배열)",
    "그림 「예시 블록」과 같은 맵이다. -1 은 빈 칸. 이 배열을 그대로 흉내 내면 제작자 프리뷰와 같은 짜임이 나온다.",
    "- 0~2행: 붉은 벽돌 가게 옥상(x1~8)·회색 사무실 옥상(x11~19). 3~5행: 외벽. 문은 외벽 맨 아래 줄.",
    "- 6~7행: 보도(가로등·쓰레기통·자판기·소화전). 8~12행: 아스팔트 차도, 10행 가운데 차선, x9~10 횡단보도.",
    "- 13~14행: 잔디(원뿔 나무·벤치).",
    "",
    "## lowerTiles",
    "```",
    grid(example, "lowerTiles"),
    "```",
    "## upperTiles",
    "```",
    grid(example, "upperTiles"),
    "```",
  ].join("\n");
  const sheetsDoc = [
    "# 팩 정보",
    `- 팩: ${preset.pack} (${preset.author}) — ${preset.url}`,
    `- 크레딧(게임에 표기): ${preset.credit}`,
    `- 라이선스: ${preset.license}`,
    `- 칸 크기 48px, 아틀라스 ${tileset.tilesPerRow}칸 폭 × ${Math.ceil(tileset.count / tileset.tilesPerRow)}줄 = ${tileset.count}칸. 시트 ${preset.sheets.length}장을 펼쳤다.`,
    "- 레이어: 바닥·차도·물·옥상·외벽 = 아래층. 물체·겹침 오토타일 = 위층. 도구가 알아서 놓는다.",
    "- 통행: 물·옥상·외벽·울타리·물체 밑칸은 막힘. 키 큰 물체의 윗칸·문·바닥 표시는 통행.",
  ].join("\n");
  return [{
    id: `mvpack-${preset.id}`,
    name: `${preset.name} 까는 법`,
    description: `${preset.pack} 도시 야외를 까는 순서·재료 이름·물체 id·예시 배열. 칠하기 전에 전부 읽는다.`,
    documents: [
      { id: "guide", name: "까는 순서", markdown: preset.guide },
      { id: "materials", name: "재료 목록", markdown: materialsDoc },
      { id: "objects", name: "물체 목록", markdown: objectsDoc },
      { id: "example", name: "예시 블록", markdown: exampleDoc },
      { id: "pack", name: "팩 정보", markdown: sheetsDoc },
    ],
    images,
  }];
}
