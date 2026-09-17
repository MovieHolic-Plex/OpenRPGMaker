import type { PassFlag, TileAiMetadata, TileGroupMetadata, TilesetDef } from "../types";
import {
  COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY,
  DEFAULT_TILES_PER_ROW,
  FOREST_TREES_ROWS,
  FOREST_TREES_TILE_COUNT,
  FOREST_TREES_TILE_OFFSET,
  TILE,
} from "./constants";

/**
 * 「숲 나무」 확장 띠(2026-09-18) — 혼합 칩셋(합본 마을+레트로 월드맵) 아래에 덧붙인 6행(180칸).
 *
 * 그림: public/assets/chipset-ext-forest-trees.png (480×96 RGBA). 사용자가 붙인 32px 격자 자연 시트에서
 * **나무·덤불만** 원본 픽셀 그대로 잘라 16px 칸에 맞춰 놓았다(축소 없음 — 큰 참나무 한 그루가 4×5 칸).
 * 시트 합성은 scripts/gen-combined-town-retro-world-chipset.mjs, 타일 번호는 FOREST_TREES_TILE_OFFSET(960)부터
 * 행 우선(30칸/행)이다.
 *
 * 칸 부류(각 물체의 `cells` 문자):
 *  · `C` 수관 — 상위 레이어·통행 가능(★). 사람이 나무 뒤로 걸어 들어가면 수관이 위에 그려진다.
 *  · `T` 밑동·덤불 몸통 — 하위 레이어·통행 불가. 투명 픽셀이 있어도 하위에 남고 잔디(240)를 받침으로 깐다.
 *  · `e` 가장자리 — 하위·통행 가능·잔디 받침. 수관 아랫단 귀퉁이와 뿌리 조각처럼 발 디딜 수 있는 장식.
 *  · `.` 빈 칸 — 그림도 없고 물체에 속하지 않는다(붓으로 찍어도 아무것도 안 그려진다).
 */
export type ForestTreeCellKind = "canopy" | "trunk" | "edge" | "empty";

export interface ForestTreeObject {
  readonly id: string;
  readonly label: string;
  /** 확장 띠 안의 좌상단(칸 좌표, 0 ≤ x < 30, 0 ≤ y < FOREST_TREES_ROWS). */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** h 개의 행, 각 행은 w 글자(C/T/e/.). */
  readonly cells: readonly string[];
}

export const FOREST_TREE_OBJECTS: readonly ForestTreeObject[] = [
  {
    id: "forest-wall",
    label: "숲 벽",
    x: 0, y: 0, w: 10, h: 6,
    cells: [
      "CCCCCCCCCC",
      "TTTTTTTTTT",
      "TTTTTTTTTT",
      "TTTTTTTTTT",
      "TTTTTTTTTT",
      "TTTTee....",
    ],
  },
  {
    id: "forest-column",
    label: "숲 기둥",
    x: 10, y: 0, w: 4, h: 6,
    cells: ["CCCC", "TTTT", "TTTT", "TTTT", "TTTT", "TTTT"],
  },
  {
    id: "big-oak",
    label: "큰 참나무",
    x: 14, y: 0, w: 4, h: 5,
    cells: ["CCCC", "CCCC", "CCCC", "eTTe", ".TT."],
  },
  {
    id: "tree",
    label: "활엽수",
    x: 18, y: 0, w: 3, h: 4,
    cells: ["CCC", "CCC", "eTe", "eTe"],
  },
  {
    id: "dark-tree",
    label: "짙은 나무",
    x: 21, y: 0, w: 2, h: 4,
    cells: ["CC", "CC", "TT", "TT"],
  },
  {
    id: "round-bush",
    label: "둥근 덤불",
    x: 23, y: 0, w: 3, h: 3,
    cells: ["TTT", "TTT", "TTT"],
  },
  {
    id: "dark-bush",
    label: "짙은 덤불",
    x: 26, y: 0, w: 3, h: 3,
    cells: ["TTT", "TTT", "TTT"],
  },
  {
    id: "small-bush",
    label: "작은 덤불",
    x: 23, y: 3, w: 2, h: 2,
    cells: ["TT", "TT"],
  },
];

const CELL_KIND: Readonly<Record<string, ForestTreeCellKind>> = { C: "canopy", T: "trunk", e: "edge", ".": "empty" };

/** 확장 띠 칸 좌표 → 혼합 칩셋 타일 번호. */
export function forestTreesTileId(x: number, y: number): number {
  return FOREST_TREES_TILE_OFFSET + y * DEFAULT_TILES_PER_ROW + x;
}

export interface ForestTreeCell {
  readonly tile: number;
  readonly kind: ForestTreeCellKind;
  readonly object: ForestTreeObject;
  /** 물체 안 상대 좌표. */
  readonly dx: number;
  readonly dy: number;
}

/** 확장 띠 180칸의 판정표(타일 번호 → 칸). 물체에 속하지 않는 칸은 없다(undefined). */
export const FOREST_TREE_CELLS: ReadonlyMap<number, ForestTreeCell> = (() => {
  const cells = new Map<number, ForestTreeCell>();
  for (const object of FOREST_TREE_OBJECTS) {
    if (object.cells.length !== object.h) throw new Error(`숲 나무 ${object.id}: 행 수 ${object.cells.length} ≠ h ${object.h}`);
    for (let dy = 0; dy < object.h; dy += 1) {
      const row = object.cells[dy]!;
      if (row.length !== object.w) throw new Error(`숲 나무 ${object.id}: ${dy}행 길이 ${row.length} ≠ w ${object.w}`);
      for (let dx = 0; dx < object.w; dx += 1) {
        const kind = CELL_KIND[row[dx]!];
        if (!kind) throw new Error(`숲 나무 ${object.id}: 모르는 칸 문자 '${row[dx]}'`);
        const x = object.x + dx, y = object.y + dy;
        if (x >= DEFAULT_TILES_PER_ROW || y >= FOREST_TREES_ROWS) throw new Error(`숲 나무 ${object.id}: 띠 밖 (${x},${y})`);
        const tile = forestTreesTileId(x, y);
        if (cells.has(tile)) throw new Error(`숲 나무 ${object.id}: 칸 ${tile} 이 ${cells.get(tile)!.object.id} 와 겹친다`);
        cells.set(tile, { tile, kind, object, dx, dy });
      }
    }
  }
  return cells;
})();

export function forestTreeObject(id: string): ForestTreeObject {
  const object = FOREST_TREE_OBJECTS.find((entry) => entry.id === id);
  if (!object) throw new Error(`숲 나무 물체 '${id}' 가 없다`);
  return object;
}

/** 이 타일 번호가 숲 나무 확장 띠에 속하는가(빈 칸 포함). */
export function isForestTreesTile(tile: number): boolean {
  return tile >= FOREST_TREES_TILE_OFFSET && tile < FOREST_TREES_TILE_OFFSET + FOREST_TREES_TILE_COUNT;
}

/** 이 타일셋이 숲 나무 확장 띠를 지닌 혼합 칩셋인가 — 마을 시공이 새 나무 킷을 고르는 판정. */
export function tilesetHasForestTrees(tileset: Pick<TilesetDef, "image" | "count"> | undefined): boolean {
  return tileset?.image.type === "bundled"
    && tileset.image.id === COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY
    && tileset.count >= FOREST_TREES_TILE_OFFSET + FOREST_TREES_TILE_COUNT;
}

/**
 * 하위 레이어에 그릴 때 잔디를 받침으로 깔아야 하는 칸인가 — 밑동·덤불·가장자리 전부.
 * 불투명한 칸에도 깔지만(숲 벽 안쪽) 그림이 가리므로 보이지 않고, 뚫린 칸에서만 효과가 난다.
 */
export function isForestTreesBackedTile(tile: number): boolean {
  const cell = FOREST_TREE_CELLS.get(tile);
  return cell !== undefined && (cell.kind === "trunk" || cell.kind === "edge");
}

const PASSABLE: PassFlag = { up: true, down: true, left: true, right: true };
const BLOCKED: PassFlag = { up: false, down: false, left: false, right: false };

const KIND_LABEL: Readonly<Record<ForestTreeCellKind, string>> = {
  canopy: "수관",
  trunk: "밑동",
  edge: "가장자리",
  empty: "",
};

/**
 * 혼합 칩셋 정의에 확장 띠 180칸의 통행·레이어·지형·라벨·그룹을 덧붙인다. 호출 전 배열 길이는
 * 정확히 FOREST_TREES_TILE_OFFSET 이어야 한다(위 960칸이 먼저 조립된 상태).
 */
export function appendForestTreesExtension(tileset: TilesetDef): void {
  if (tileset.passability.length !== FOREST_TREES_TILE_OFFSET || tileset.priority.length !== FOREST_TREES_TILE_OFFSET
    || tileset.terrain.length !== FOREST_TREES_TILE_OFFSET || (tileset.tileMeta?.length ?? 0) !== FOREST_TREES_TILE_OFFSET) {
    throw new Error(`숲 나무 확장은 ${FOREST_TREES_TILE_OFFSET}칸 뒤에 붙는다(현재 ${tileset.passability.length}칸).`);
  }
  const grassTerrain = tileset.terrain[TILE.GRASS] ?? 0;
  const meta = tileset.tileMeta ?? (tileset.tileMeta = []);
  for (let local = 0; local < FOREST_TREES_TILE_COUNT; local += 1) {
    const tile = FOREST_TREES_TILE_OFFSET + local;
    const cell = FOREST_TREE_CELLS.get(tile);
    const kind = cell?.kind ?? "empty";
    tileset.passability.push(kind === "trunk" ? { ...BLOCKED } : { ...PASSABLE });
    tileset.priority.push(kind === "canopy" ? "upper" : "lower");
    tileset.terrain.push(grassTerrain);
    // 물체 안의 빈 칸(`.`)도 그림이 없으니 라벨을 두지 않는다 — 팔레트에서 "큰 참나무 (1,5)" 같은 헛 라벨이 뜨면 안 된다.
    meta.push(cell && cell.kind !== "empty" ? cellMeta(cell) : { label: "", description: "", source: "bundled-default" });
  }
  tileset.count = FOREST_TREES_TILE_OFFSET + FOREST_TREES_TILE_COUNT;
  const groups = tileset.tileGroups ?? (tileset.tileGroups = []);
  for (const object of FOREST_TREE_OBJECTS) groups.push(objectGroup(object));
}

function cellMeta(cell: ForestTreeCell): TileAiMetadata {
  const { object, kind, dx, dy } = cell;
  const passage = kind === "canopy" ? "star" : kind === "trunk" ? "solid" : "passable";
  return {
    label: `${object.label} ${KIND_LABEL[kind]} (${dx + 1},${dy + 1})`,
    description: `숲 나무 확장 띠 — ${object.label} ${object.w}×${object.h} 칸의 (${dx + 1},${dy + 1}). ${describeKind(kind)}`,
    role: "prop",
    repeatability: "fixed",
    defaultLayer: kind === "canopy" ? "upper" : "lower",
    passage,
    source: "bundled-default",
    tags: ["숲", "나무", object.label, ...(kind === "canopy" ? ["투명", "수관"] : kind === "edge" ? ["투명", "가장자리"] : ["밑동"])],
  };
}

function describeKind(kind: ForestTreeCellKind): string {
  switch (kind) {
    case "canopy": return "수관은 상위 레이어(★)로 사람 위에 그려지고 지나갈 수 있다.";
    case "trunk": return "밑동·몸통은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 없다.";
    case "edge": return "가장자리 조각은 하위 레이어에 잔디 받침과 함께 그려지고 지나갈 수 있다.";
    case "empty": return "";
  }
}

function objectGroup(object: ForestTreeObject): TileGroupMetadata {
  const lowerTiles: number[] = [];
  const upperTiles: number[] = [];
  const tileIds: number[] = [];
  const cellLayers: ("lower" | "upper")[] = [];
  for (let dy = 0; dy < object.h; dy += 1) {
    for (let dx = 0; dx < object.w; dx += 1) {
      const tile = forestTreesTileId(object.x + dx, object.y + dy);
      const kind = FOREST_TREE_CELLS.get(tile)!.kind;
      if (kind === "empty") { lowerTiles.push(-1); upperTiles.push(-1); continue; }
      tileIds.push(tile);
      cellLayers.push(kind === "canopy" ? "upper" : "lower");
      if (kind === "canopy") { lowerTiles.push(TILE.GRASS); upperTiles.push(tile); }
      else { lowerTiles.push(tile); upperTiles.push(-1); }
    }
  }
  return {
    id: `forest-trees:${object.id}`,
    name: `숲 나무 · ${object.label}`,
    role: "prop",
    defaultLayer: "mixed",
    layerHome: "perCell",
    tileIds,
    cellLayers,
    description: `사용자 제공 숲 시트에서 옮긴 ${object.label}(${object.w}×${object.h} 칸). 수관은 상위, 밑동은 하위+잔디 받침.`,
    placementRules: "물체 전체를 한 덩이로 찍는다 — 수관 칸은 상위 레이어, 밑동·덤불 칸은 하위 레이어(통행 불가). 잔디 위에만 놓는다.",
    source: "bundled-default",
    confidence: "high",
    sourceRect: {
      x: object.x * 16,
      y: (FOREST_TREES_TILE_OFFSET / DEFAULT_TILES_PER_ROW + object.y) * 16,
      width: object.w * 16,
      height: object.h * 16,
    },
    previewMap: { width: object.w, height: object.h, lowerTiles, upperTiles },
    patternGrammar: { kind: "source_rect", parts: [], preserveCaps: false, repeat: "source_order" },
  };
}
