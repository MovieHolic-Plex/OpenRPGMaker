// RPG Maker MV/MZ 시트 묶음 → OPRN 평면 아틀라스의 칸 번호 배치. 픽셀을 보지 않는 순수 계산이다.
//
// 에디터는 MV 오토타일 규격을 모른다(TilesetKind 는 rpg2k|custom). 그래서 오토타일은 모든 모양을
// 평타일로 펼쳐 싣는다. 같은 시트 목록이면 언제나 같은 번호가 나와야 참고문서·조립법의 번호가
// 맞는다 — 배치 규칙을 바꾸면 이미 만든 프리셋 번호가 전부 어긋난다.
//
// 배치: 시트 하나 = 16칸 폭 패널(A5 는 8칸), 패널을 4줄(lane)에 쌓아 64칸 폭. 줄마다 가장 낮은 곳에 넣는다.

import { type AutotileShapeKind, quarterTable } from "./autotile";

export const MV_TILE_SIZE = 48;
export const MV_LANES = 4;
export const MV_PANEL_WIDTH = 16;
export const MV_ATLAS_COLUMNS = MV_LANES * MV_PANEL_WIDTH;

export type MvSheetPart = "A1" | "A2" | "A3" | "A4" | "A5" | "B";

/** 시트 안의 한 원본. 오토타일은 블록 원점(48px 칸 단위)과 표, 평타일은 칸 좌표. */
export type MvCellSource =
  | { readonly kind: "autotile"; readonly shapeKind: AutotileShapeKind; readonly blockX: number; readonly blockY: number; readonly shape: number }
  | { readonly kind: "flat"; readonly cellX: number; readonly cellY: number };

export interface MvCell {
  readonly sheet: string;
  readonly part: MvSheetPart;
  /** 오토타일 종류 번호(A1~A4) 또는 시트 안 칸 번호(A5·B, 행 우선). */
  readonly kind: number;
  /** 오토타일 모양 번호, 평타일은 0. */
  readonly shape: number;
  readonly source: MvCellSource;
}

export interface MvSheetSpec {
  /** 원본 파일 이름(확장자 포함). 앞 두 글자로 A1~A5 를 가르고, 나머지는 B~E 물체 시트다. */
  readonly file: string;
  readonly width: number;
  readonly height: number;
}

export interface MvAtlasPanel {
  readonly sheet: string;
  readonly part: MvSheetPart;
  readonly lane: number;
  readonly row: number;
  readonly rows: number;
  readonly width: number;
  readonly firstTile: number;
  readonly count: number;
}

export interface MvAtlasLayout {
  readonly columns: number;
  readonly rows: number;
  readonly count: number;
  readonly panels: readonly MvAtlasPanel[];
  /** 아틀라스 칸 번호 → 원본. 빈 칸(패널 사이)은 없다. */
  readonly cells: ReadonlyMap<number, MvCell>;
}

export function mvSheetPart(file: string): MvSheetPart {
  const head = file.slice(0, 2);
  return head === "A1" || head === "A2" || head === "A3" || head === "A4" || head === "A5" ? head : "B";
}

/** MV A1 종류 → 블록 원점과 표. 애니 물은 첫 프레임만 쓴다. */
function a1Block(kind: number): { blockX: number; blockY: number; shapeKind: AutotileShapeKind } {
  if (kind === 0) return { blockX: 0, blockY: 0, shapeKind: "floor" };
  if (kind === 1) return { blockX: 0, blockY: 3, shapeKind: "floor" };
  if (kind === 2) return { blockX: 6, blockY: 0, shapeKind: "floor" };
  if (kind === 3) return { blockX: 6, blockY: 3, shapeKind: "floor" };
  const tx = kind % 8;
  const ty = Math.floor(kind / 8);
  const blockX = Math.floor(tx / 4) * 8;
  const blockY = ty * 6 + (Math.floor(tx / 2) % 2) * 3;
  return kind % 2 === 0 ? { blockX, blockY, shapeKind: "floor" } : { blockX: blockX + 6, blockY, shapeKind: "waterfall" };
}

function autotileCells(sheet: string, part: MvSheetPart, kind: number, blockX: number, blockY: number, shapeKind: AutotileShapeKind): MvCell[] {
  return quarterTable(shapeKind).map((_, shape) => ({
    sheet, part, kind, shape, source: { kind: "autotile", shapeKind, blockX, blockY, shape },
  }));
}

/** 시트 하나를 셀 목록으로 편다. 순서가 곧 패널 안 칸 순서다. */
export function mvSheetCells(spec: MvSheetSpec): MvCell[] {
  const part = mvSheetPart(spec.file);
  const cells: MvCell[] = [];
  if (part === "A1") {
    for (let kind = 0; kind < 16; kind += 1) {
      const block = a1Block(kind);
      cells.push(...autotileCells(spec.file, part, kind, block.blockX, block.blockY, block.shapeKind));
    }
  } else if (part === "A2") {
    for (let kind = 0; kind < 32; kind += 1) cells.push(...autotileCells(spec.file, part, kind, (kind % 8) * 2, Math.floor(kind / 8) * 3, "floor"));
  } else if (part === "A3") {
    for (let kind = 0; kind < 32; kind += 1) cells.push(...autotileCells(spec.file, part, kind, (kind % 8) * 2, Math.floor(kind / 8) * 2, "wall"));
  } else if (part === "A4") {
    for (let kind = 0; kind < 48; kind += 1) {
      const ty = Math.floor(kind / 8) + 10;
      const blockY = Math.floor((ty - 10) * 2.5 + (ty % 2 === 1 ? 0.5 : 0));
      cells.push(...autotileCells(spec.file, part, kind, (kind % 8) * 2, blockY, ty % 2 === 1 ? "wall" : "floor"));
    }
  } else {
    const columns = Math.floor(spec.width / MV_TILE_SIZE);
    const rows = Math.floor(spec.height / MV_TILE_SIZE);
    for (let cellY = 0; cellY < rows; cellY += 1) {
      for (let cellX = 0; cellX < columns; cellX += 1) {
        cells.push({ sheet: spec.file, part, kind: cellY * columns + cellX, shape: 0, source: { kind: "flat", cellX, cellY } });
      }
    }
  }
  return cells;
}

/** A1~A4 오토타일 종류가 바닥형·벽형·폭포형 중 무엇인지. A5·B 는 undefined. */
export function mvAutotileShapeKind(part: MvSheetPart, kind: number): AutotileShapeKind | undefined {
  if (part === "A1") return a1Block(kind).shapeKind;
  if (part === "A2") return "floor";
  if (part === "A3") return "wall";
  if (part === "A4") return (Math.floor(kind / 8) + 10) % 2 === 1 ? "wall" : "floor";
  return undefined;
}

export function layoutMvAtlas(sheets: readonly MvSheetSpec[]): MvAtlasLayout {
  const laneRows = new Array<number>(MV_LANES).fill(0);
  const panels: MvAtlasPanel[] = [];
  const cells = new Map<number, MvCell>();
  for (const spec of sheets) {
    const sheetCells = mvSheetCells(spec);
    const part = mvSheetPart(spec.file);
    const width = part === "A5" ? 8 : MV_PANEL_WIDTH;
    const rows = Math.ceil(sheetCells.length / width);
    let lane = 0;
    for (let i = 1; i < MV_LANES; i += 1) if (laneRows[i]! < laneRows[lane]!) lane = i;
    const row = laneRows[lane]!;
    laneRows[lane] = row + rows;
    sheetCells.forEach((cell, i) => {
      cells.set((row + Math.floor(i / width)) * MV_ATLAS_COLUMNS + lane * MV_PANEL_WIDTH + (i % width), cell);
    });
    panels.push({ sheet: spec.file, part, lane, row, rows, width, firstTile: row * MV_ATLAS_COLUMNS + lane * MV_PANEL_WIDTH, count: sheetCells.length });
  }
  const rows = Math.max(...laneRows);
  return { columns: MV_ATLAS_COLUMNS, rows, count: rows * MV_ATLAS_COLUMNS, panels, cells };
}

/** (시트, 종류, 모양) → 아틀라스 칸 번호. 조립법·참고문서가 원본 좌표로 칸을 가리킬 때 쓴다. */
export function mvTileIndex(layout: MvAtlasLayout): (sheet: string, kind: number, shape?: number) => number | undefined {
  const index = new Map<string, number>();
  for (const [tile, cell] of layout.cells) index.set(`${cell.sheet}\u0000${cell.kind}\u0000${cell.shape}`, tile);
  return (sheet, kind, shape = 0) => index.get(`${sheet}\u0000${kind}\u0000${shape}`);
}
