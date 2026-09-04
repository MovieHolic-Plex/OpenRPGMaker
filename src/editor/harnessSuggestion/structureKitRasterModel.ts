// harnessSuggestion/structureKitRasterModel.ts
// 구조물 래스터 편집의 순수 변환 계층 — DOM·store 의존 없음(유닛 테스트 대상).
//
// 왜 rect·scale 을 인자로 받는가:
//   유닛 테스트 환경이 environment:"node" + 손수 만든 FakeElement 라
//   getBoundingClientRect() 가 전부 0 을 돌려준다. 함수 안에서 DOM 을 읽으면
//   테스트에서 항상 (0,0) 이 나와 검증이 무의미해진다. 호출부가 읽어서 넘긴다.

import { TILE_SIZE } from "@/assets/bundled";
import { structureKitSize } from "@/editor/harnessSuggestion/structureKitModel";
import type { InteriorObjectDef } from "@/editor/interiorObjectCatalog";
import type { PaletteStampCell } from "@/editor/tilePaletteStamp";
import { TILE } from "@/project/defaults/constants";
import type {
  SectionStructureKitDef,
  StructureGrowthAxis,
  StructureKitCellHint,
  StructureKitPart,
  StructureKitPartKind,
  StructureKitRow,
} from "@/project/types";

export type KitLayer = "lower" | "upper";

/** 화면 좌표 → 칸 좌표. 킷 경계 밖이면 null. */
export function cellAtPoint(
  rect: { readonly left: number; readonly top: number },
  scale: number,
  clientX: number,
  clientY: number,
  size: { readonly width: number; readonly height: number },
): { readonly cx: number; readonly cy: number } | null {
  const cellPx = TILE_SIZE * Math.max(1, scale);
  const cx = Math.floor((clientX - rect.left) / cellPx);
  const cy = Math.floor((clientY - rect.top) / cellPx);
  if (cx < 0 || cy < 0 || cx >= size.width || cy >= size.height) return null;
  return { cx, cy };
}

/** 한 칸의 타일 번호. 없으면 EMPTY. */
export function tileAt(
  kit: SectionStructureKitDef,
  cx: number,
  cy: number,
  layer: KitLayer,
): number {
  const row = kit.rows[cy];
  if (!row) return TILE.EMPTY;
  return (layer === "upper" ? row.upperTiles?.[cx] : row.tiles[cx]) ?? TILE.EMPTY;
}

/** 한 칸을 칠한 새 킷. 경계 밖이면 원본을 그대로 돌려준다(참조 동일). */
export function paintCell(
  kit: SectionStructureKitDef,
  cx: number,
  cy: number,
  layer: KitLayer,
  tile: number,
): SectionStructureKitDef {
  if (cx < 0 || cy < 0 || cx >= kit.width || cy >= kit.height) return kit;
  const rows = kit.rows.map((row, index) => {
    if (index !== cy) return row;
    return writeCell(row, kit.width, cx, layer, tile);
  });
  return { ...kit, rows };
}

function writeCell(row: StructureKitRow, width: number, cx: number, layer: KitLayer, tile: number): StructureKitRow {
  if (layer === "lower") {
    const tiles = [...row.tiles];
    tiles[cx] = tile;
    return { ...row, tiles };
  }
  // 상층 배열은 내용이 있을 때만 기록하는 직렬화 규약이라, 없던 행에는 여기서 만든다.
  const upperTiles = row.upperTiles ? [...row.upperTiles] : new Array<number>(width).fill(TILE.EMPTY);
  upperTiles[cx] = tile;
  return { ...row, upperTiles };
}

export interface ResizeResult {
  readonly kit: SectionStructureKitDef;
  /** 경계에 걸쳐 크기가 줄어든 부위 수. */
  readonly clamped: number;
  /** 경계 밖으로 완전히 나가 삭제된 부위 수. */
  readonly dropped: number;
  /** 경계 밖으로 나가 삭제된 칸 힌트 수. 1×1 이라 클램프 여지가 없어 부위와 따로 센다. */
  readonly droppedHints: number;
}

/**
 * 킷 크기 조절. 늘린 칸은 EMPTY, 줄이며 잘린 칸은 버린다.
 * 부위는 조용히 사라지지 않는다 — 클램프·삭제 개수를 돌려주어 호출부가 사용자에게 보고한다.
 */
export function resizeKit(kit: SectionStructureKitDef, width: number, height: number): ResizeResult {
  const nextWidth = Math.max(1, Math.floor(width));
  const nextHeight = Math.max(1, Math.floor(height));
  if (nextWidth === kit.width && nextHeight === kit.height) {
    return { kit, clamped: 0, dropped: 0, droppedHints: 0 };
  }

  const rows: StructureKitRow[] = [];
  for (let y = 0; y < nextHeight; y += 1) {
    const source = kit.rows[y];
    const tiles = new Array<number>(nextWidth).fill(TILE.EMPTY);
    let upperTiles: number[] | undefined;
    for (let x = 0; x < nextWidth; x += 1) {
      tiles[x] = source?.tiles[x] ?? TILE.EMPTY;
      const upper = source?.upperTiles?.[x] ?? TILE.EMPTY;
      if (upper !== TILE.EMPTY) {
        upperTiles ??= new Array<number>(nextWidth).fill(TILE.EMPTY);
        upperTiles[x] = upper;
      }
    }
    rows.push(upperTiles ? { tiles, upperTiles } : { tiles });
  }

  let clamped = 0;
  let dropped = 0;
  const parts: StructureKitPart[] = [];
  for (const part of kit.parts ?? []) {
    if (part.dx >= nextWidth || part.dy >= nextHeight) {
      dropped += 1;
      continue;
    }
    const w = Math.min(part.w, nextWidth - part.dx);
    const h = Math.min(part.h, nextHeight - part.dy);
    if (w !== part.w || h !== part.h) clamped += 1;
    parts.push({ ...part, w, h });
  }

  // 칸 힌트는 1×1 이라 줄일 여지가 없다 — 밖으로 나가면 삭제만 있다.
  // 모든 힌트가 사라지면 키 자체를 떼어낸다(setCellHint/removeCellHint 와 같은 생략 규약) —
  // 생성자가 kit 을 그대로 펼치므로 담아 둔 cellHints 를 명시적으로 분해해 놓는다.
  const { cellHints: existingHints, ...base } = kit;
  const keptHints = (existingHints ?? []).filter((hint) => hint.dx < nextWidth && hint.dy < nextHeight);
  const droppedHints = (existingHints ?? []).length - keptHints.length;

  return {
    kit: {
      ...base,
      width: nextWidth,
      height: nextHeight,
      rows,
      parts,
      ...(keptHints.length > 0 ? { cellHints: keptHints } : {}),
    },
    clamped,
    dropped,
    droppedHints,
  };
}

export interface PartRect {
  readonly dx: number;
  readonly dy: number;
  readonly w: number;
  readonly h: number;
}

/** 드래그 두 점(어느 방향이든) → 좌상단 + 크기. */
export function normalizeDragRect(
  a: { readonly cx: number; readonly cy: number },
  b: { readonly cx: number; readonly cy: number },
): PartRect {
  const dx = Math.min(a.cx, b.cx);
  const dy = Math.min(a.cy, b.cy);
  return { dx, dy, w: Math.abs(a.cx - b.cx) + 1, h: Math.abs(a.cy - b.cy) + 1 };
}

/** 부위 추가. id 는 호출부가 발급한다 — 순수 함수를 지키기 위해 randomUuid 를 안에서 부르지 않는다. */
export function addPart(
  kit: SectionStructureKitDef,
  rect: PartRect,
  kind: StructureKitPartKind,
  id: string,
): SectionStructureKitDef {
  const dx = clamp(rect.dx, 0, kit.width - 1);
  const dy = clamp(rect.dy, 0, kit.height - 1);
  const part: StructureKitPart = {
    id,
    kind,
    dx,
    dy,
    w: clamp(rect.w, 1, kit.width - dx),
    h: clamp(rect.h, 1, kit.height - dy),
  };
  return { ...kit, parts: [...(kit.parts ?? []), part] };
}

export function updatePart(
  kit: SectionStructureKitDef,
  partId: string,
  patch: Partial<Pick<StructureKitPart, "kind" | "dx" | "dy" | "w" | "h" | "note">>,
): SectionStructureKitDef {
  const parts = kit.parts ?? [];
  if (!parts.some((part) => part.id === partId)) return kit;
  return {
    ...kit,
    parts: parts.map((part) => (part.id === partId ? { ...part, ...patch } : part)),
  };
}

export function removePart(kit: SectionStructureKitDef, partId: string): SectionStructureKitDef {
  const parts = kit.parts ?? [];
  if (!parts.some((part) => part.id === partId)) return kit;
  return { ...kit, parts: parts.filter((part) => part.id !== partId) };
}

/** 칸 힌트 하나 조회. 없으면 undefined. 한 칸에 힌트는 하나만 있다(dx,dy 가 키). */
export function cellHintAt(
  kit: SectionStructureKitDef,
  dx: number,
  dy: number,
): StructureKitCellHint | undefined {
  return (kit.cellHints ?? []).find((hint) => hint.dx === dx && hint.dy === dy);
}

/**
 * 한 칸의 힌트를 쓴다.
 *
 * `growth`/`note` 를 `null` 로 주면 그 필드를 **지우고**, 생략(undefined)하면 기존 값을 둔다 —
 * 둘을 구분하지 않으면 "축만 바꾸기"가 사람이 적어 둔 메모를 조용히 지운다.
 * 둘 다 마지막에 비면 항목 자체를 떼어낸다 — 뜻 없는 `{dx,dy}` 를 남기면 AI 에게
 * "이 칸에 뭔가 적혀 있다"는 거짓 신호를 주고 파일에도 그대로 쌓인다.
 */
export function setCellHint(
  kit: SectionStructureKitDef,
  dx: number,
  dy: number,
  patch: { readonly growth?: StructureGrowthAxis | null; readonly note?: string | null },
): SectionStructureKitDef {
  if (dx < 0 || dy < 0 || dx >= kit.width || dy >= kit.height) return kit;
  const hints = kit.cellHints ?? [];
  const existing = hints.find((hint) => hint.dx === dx && hint.dy === dy);
  const growth = patch.growth === undefined ? existing?.growth : (patch.growth ?? undefined);
  const rawNote = patch.note === undefined ? existing?.note : (patch.note ?? undefined);
  const note = rawNote && rawNote.trim() ? rawNote : undefined;
  if (growth === undefined && note === undefined) return removeCellHint(kit, dx, dy);
  const next: StructureKitCellHint = {
    dx,
    dy,
    ...(growth === undefined ? {} : { growth }),
    ...(note === undefined ? {} : { note }),
  };
  return {
    ...kit,
    cellHints: existing ? hints.map((hint) => (hint === existing ? next : hint)) : [...hints, next],
  };
}

export function removeCellHint(kit: SectionStructureKitDef, dx: number, dy: number): SectionStructureKitDef {
  const hints = kit.cellHints ?? [];
  const remaining = hints.filter((hint) => hint.dx !== dx || hint.dy !== dy);
  if (remaining.length === hints.length) return kit;
  if (remaining.length === 0) {
    const { cellHints: _emptied, ...rest } = kit;
    return rest;
  }
  return { ...kit, cellHints: remaining };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** 셀 목록 → 행렬. 상층 배열은 내용이 있는 행에만 기록(기존 직렬화 규약과 같다). */
export function bakeCellsToRows(
  cells: readonly PaletteStampCell[],
  width: number,
  height: number,
): StructureKitRow[] {
  const lower: number[][] = [];
  const upper: number[][] = [];
  for (let y = 0; y < height; y += 1) {
    lower.push(new Array<number>(width).fill(TILE.EMPTY));
    upper.push(new Array<number>(width).fill(TILE.EMPTY));
  }
  for (const cell of cells) {
    if (cell.dx < 0 || cell.dy < 0 || cell.dx >= width || cell.dy >= height) continue;
    (cell.layer === "upper" ? upper : lower)[cell.dy]![cell.dx] = cell.tile;
  }
  return lower.map((tiles, y) => {
    const upperRow = upper[y]!;
    return upperRow.some((tile) => tile !== TILE.EMPTY) ? { tiles, upperTiles: upperRow } : { tiles };
  });
}

/**
 * 무엇을 복제하든 결과는 section 이다.
 */
export function bakeStructureKit(kit: SectionStructureKitDef, id: string, name: string): SectionStructureKitDef {
  const size = structureKitSize(kit);
  const rows = kit.rows.map((row) => ({ tiles: [...row.tiles], ...(row.upperTiles ? { upperTiles: [...row.upperTiles] } : {}) }));
  return {
    id,
    kind: "section",
    name,
    width: size.width,
    height: size.height,
    rows,
    ...(kit.parts && kit.parts.length > 0 ? { parts: kit.parts.map((part) => ({ ...part })) } : {}),
    ...(kit.cellHints && kit.cellHints.length > 0
      ? { cellHints: kit.cellHints.map((hint) => ({ ...hint })) }
      : {}),
    ...(kit.ai ? { ai: { ...kit.ai, tags: kit.ai.tags ? [...kit.ai.tags] : undefined } } : {}),
    learnedFrom: "db-authored",
  };
}

/**
 * 실내 오브젝트 → section.
 */
export function bakeInteriorObject(object: InteriorObjectDef, id: string, name: string): SectionStructureKitDef {
  return {
    id,
    kind: "section",
    name,
    width: Math.max(1, object.width),
    height: Math.max(1, object.height),
    rows: bakeCellsToRows(
      object.cells.map((cell) => ({ dx: cell.dx, dy: cell.dy, layer: cell.layer, tile: cell.tile })),
      Math.max(1, object.width),
      Math.max(1, object.height),
    ),
    learnedFrom: "db-authored",
    ai: {
      description: "",
      placementRules: "",
      ...(object.role ? { interiorRole: object.role } : {}),
      snap: object.snap,
      themes: [...object.themes],
    },
  };
}

/** '우물' → '우물 사본' → '우물 사본 2' … 이미 쓰는 이름을 피한다. */
export function copyName(baseName: string, existingNames: readonly string[]): string {
  const taken = new Set(existingNames);
  const first = `${baseName} 사본`;
  if (!taken.has(first)) return first;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${first} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${first} ${Date.now()}`;
}
