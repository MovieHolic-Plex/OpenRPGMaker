// harnessSuggestion/structureKitRasterModel.ts
// 구조물 래스터 편집의 순수 변환 계층 — DOM·store 의존 없음(유닛 테스트 대상).
//
// 왜 rect·scale 을 인자로 받는가:
//   유닛 테스트 환경이 environment:"node" + 손수 만든 FakeElement 라
//   getBoundingClientRect() 가 전부 0 을 돌려준다. 함수 안에서 DOM 을 읽으면
//   테스트에서 항상 (0,0) 이 나와 검증이 무의미해진다. 호출부가 읽어서 넘긴다.

import { TILE_SIZE } from "@/assets/bundled";
import { TILE } from "@/project/defaults/constants";
import type { SectionStructureKitDef, StructureKitPart, StructureKitRow } from "@/project/types";

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
}

/**
 * 킷 크기 조절. 늘린 칸은 EMPTY, 줄이며 잘린 칸은 버린다.
 * 부위는 조용히 사라지지 않는다 — 클램프·삭제 개수를 돌려주어 호출부가 사용자에게 보고한다.
 */
export function resizeKit(kit: SectionStructureKitDef, width: number, height: number): ResizeResult {
  const nextWidth = Math.max(1, Math.floor(width));
  const nextHeight = Math.max(1, Math.floor(height));
  if (nextWidth === kit.width && nextHeight === kit.height) {
    return { kit, clamped: 0, dropped: 0 };
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

  return {
    kit: { ...kit, width: nextWidth, height: nextHeight, rows, parts },
    clamped,
    dropped,
  };
}
